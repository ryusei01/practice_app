"""
LLM連携のAIエンドポイント（学習プラン・画像・テキストからの問題生成）。
`ai.py` から分離し、uvicorn の reload が古いモジュールキャッシュのままになる場合でも
`main.py` の import で確実にルートが登録されるようにする。
"""
import base64
import csv
import io
import logging
import re

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import List, Optional

from pydantic import BaseModel, Field

from ..utils.content_languages import (
    ai_language_hint,
    normalize_content_language_list,
    parse_query_content_languages,
)
from ..services.learning_plan_generator import get_learning_plan_generator
from ..services.llm_router import AllLLMProvidersFailed, complete_text, complete_vision

router = APIRouter()
logger = logging.getLogger(__name__)


class GenerateLearningPlanRequest(BaseModel):
    goal: str = Field(..., min_length=1, max_length=2000)
    weeks: int = Field(4, ge=1, le=24)
    daily_hours: float = Field(1.0, ge=0.25, le=24.0)
    weak_categories: List[str] = Field(default_factory=list)


@router.post("/generate-learning-plan")
async def generate_learning_plan(request: GenerateLearningPlanRequest):
    """
    クラウド LLM（Gemini → Hugging Face → Groq）で学習プランを生成する。
    """
    gen = get_learning_plan_generator()
    try:
        result = await gen.generate(
            goal=request.goal.strip(),
            weeks=request.weeks,
            daily_hours=request.daily_hours,
            weak_categories=[c.strip() for c in request.weak_categories if c and str(c).strip()],
        )
        return result
    except AllLLMProvidersFailed as e:
        logger.warning("Learning plan: all LLM providers failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="AIサービスに接続できませんでした。GEMINI_API_KEY / HF_TOKEN / GROQ_API_KEY のいずれかを設定し、しばらくしてから再度お試しください。",
        )
    except httpx.TimeoutException as e:
        logger.warning("LLM timeout (learning plan): %s", e)
        raise HTTPException(
            status_code=504,
            detail="学習プランの生成がタイムアウトしました。しばらくしてから再度お試しください。",
        )
    except Exception as e:
        logger.exception("Learning plan generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# --- Shared CSV parsing for LLM-generated quiz output ---

_QUIZ_CSV_RULES = """Output ONLY valid CSV with this header (no markdown fences, no commentary):
question_text,question_type,option_1,option_2,option_3,option_4,correct_answer,explanation,difficulty,category

Rules:
- Mix question types: multiple_choice, true_false, text_input
- For multiple_choice: fill option_1 through option_4, and set correct_answer to 1, 2, 3, or 4
- For true_false: leave options empty, correct_answer is "true" or "false"
- For text_input: leave options empty, correct_answer is the answer text
- difficulty: 0.0 to 1.0
- Be accurate — do not fabricate information not present in the source material"""


def _normalize_multiple_choice_correct_answer(
    correct_answer: str | None,
    options: list[str] | None,
) -> str | None:
    value = (correct_answer or "").strip()
    if not value:
        return None

    if value in {"1", "2", "3", "4"}:
        index = int(value) - 1
        if not options or index < len(options):
            return value
        return None

    if value.upper() in {"A", "B", "C", "D"}:
        index = ord(value.upper()) - ord("A")
        if not options or index < len(options):
            return str(index + 1)
        return None

    stripped = value
    if len(value) > 2 and value[0] in "ABCDabcd1234" and value[1] in ").、:：":
        stripped = value[2:].strip()

    if options:
        for index, option in enumerate(options):
            if option.strip() == value or option.strip() == stripped:
                return str(index + 1)

    return None


def _parse_quiz_csv(raw_text: str) -> list[dict]:
    """Parse CSV-formatted quiz output from an LLM into a list of question dicts."""
    csv_text = raw_text.strip()
    csv_text = re.sub(r"^```(?:csv)?\s*\n?", "", csv_text)
    csv_text = re.sub(r"\n?```\s*$", "", csv_text)

    questions: list[dict] = []
    try:
        reader = csv.DictReader(io.StringIO(csv_text))
        for row in reader:
            q_text = (row.get("question_text") or "").strip()
            c_answer = (row.get("correct_answer") or "").strip()
            if not q_text or not c_answer:
                continue

            opts = [row.get(f"option_{i}", "").strip() for i in range(1, 5)]
            options = [o for o in opts if o] or None

            q_type = (row.get("question_type") or "").strip()
            if not q_type:
                if options:
                    q_type = "multiple_choice"
                elif c_answer.lower() in ("true", "false"):
                    q_type = "true_false"
                else:
                    q_type = "text_input"

            normalized_correct_answer = c_answer
            if q_type == "multiple_choice":
                normalized_correct_answer = _normalize_multiple_choice_correct_answer(
                    c_answer,
                    options,
                )
                if not normalized_correct_answer:
                    continue

            diff_str = (row.get("difficulty") or "0.5").strip()
            try:
                difficulty = max(0.0, min(1.0, float(diff_str)))
            except ValueError:
                difficulty = 0.5

            questions.append({
                "question_text": q_text,
                "question_type": q_type,
                "options": options,
                "correct_answer": normalized_correct_answer,
                "explanation": (row.get("explanation") or "").strip() or None,
                "difficulty": difficulty,
                "category": (row.get("category") or "").strip() or None,
            })
    except Exception as e:
        logger.warning("Failed to parse LLM CSV output: %s\nRaw: %s", e, csv_text[:500])

    return questions


# --- Image OCR → Question Generation ---

_VISION_SYSTEM_PROMPT = f"""You are a quiz generator. Given an image (textbook page, whiteboard, notes, etc.),
extract the content and generate quiz questions in CSV format.

{_QUIZ_CSV_RULES}
- Generate 3-10 questions based on the image content
- Use the same language as the image content
- Be accurate — do not fabricate information not present in the image
"""


@router.post("/generate-from-image")
async def generate_from_image(
    file: UploadFile = File(...),
    count: int = Query(5, ge=1, le=20),
    content_language: Optional[str] = Query(
        None,
        description="Output language (legacy single). Ignored if content_languages is set.",
    ),
    content_languages: Optional[List[str]] = Query(
        None,
        description="Output languages: repeat param, e.g. content_languages=ja&content_languages=en",
    ),
):
    """Generate quiz questions from an image using a vision LLM."""
    parsed = parse_query_content_languages(content_languages, content_language)
    if content_languages:
        for x in content_languages:
            if x not in ("ja", "en"):
                raise HTTPException(
                    status_code=422,
                    detail="content_languages values must be ja or en",
                )
    if content_language is not None and content_language not in ("ja", "en"):
        raise HTTPException(
            status_code=422,
            detail="content_language must be ja or en",
        )

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10 MB)")

    b64_image = base64.b64encode(contents).decode("utf-8")

    lang_hint = ""
    if parsed:
        lang_hint = ai_language_hint(normalize_content_language_list(parsed, None))

    mime = (file.content_type or "image/jpeg").split(";")[0].strip() or "image/jpeg"

    try:
        raw_text, _prov = await complete_vision(
            system=_VISION_SYSTEM_PROMPT + lang_hint,
            user_text=f"Generate approximately {count} questions from this image.",
            mime_type=mime,
            image_b64=b64_image,
            temperature=0.3,
            max_tokens=8192,
            timeout=120.0,
        )
    except AllLLMProvidersFailed as e:
        logger.error("Vision LLM all providers failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="画像からの問題生成サービスに接続できませんでした。APIキー（Gemini / Hugging Face / Groq）と画像モデル設定を確認してください。",
        )
    except httpx.HTTPError as e:
        logger.error("Vision LLM call failed: %s", e)
        raise HTTPException(status_code=502, detail="画像認識モデルからエラー応答がありました。")

    questions = _parse_quiz_csv(raw_text)

    if not questions:
        raise HTTPException(
            status_code=422,
            detail="Could not generate questions from this image. Try a clearer image or different content.",
        )

    return {"questions": questions, "total": len(questions)}


# --- Text → Question Generation ---

_TEXT_SYSTEM_PROMPT = f"""You are a quiz generator. Given a block of text (from a textbook, notes, article, etc.),
generate quiz questions in CSV format that test understanding of the content.

{_QUIZ_CSV_RULES}
- Use the same language as the provided text
- Prioritize multiple_choice questions for factual content
- Generate questions that cover the key concepts in the text
- Do not fabricate information not present in the text
"""


class GenerateFromTextRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=50000)
    count: Optional[int] = Field(None, ge=1, le=30)
    content_language: Optional[str] = Field(None, pattern=r"^(ja|en)$")
    content_languages: Optional[List[str]] = None


@router.post("/generate-from-text")
async def generate_from_text(request: GenerateFromTextRequest):
    """Generate quiz questions from user-provided text using a local LLM."""
    lang_hint = ""
    if request.content_languages:
        for x in request.content_languages:
            if x not in ("ja", "en"):
                raise HTTPException(status_code=422, detail="content_languages must be ja and/or en")
        lang_hint = ai_language_hint(
            normalize_content_language_list(request.content_languages, None)
        )
    elif request.content_language:
        lang_hint = ai_language_hint(
            normalize_content_language_list([request.content_language], None)
        )

    if request.count:
        count_instruction = f"Generate approximately {request.count} questions from the following text:"
    else:
        count_instruction = (
            "Determine the appropriate number of questions based on the length and density of the text. "
            "Short texts: 3-5 questions. Medium texts: 5-10. Long/dense texts: 10-20. "
            "Generate questions from the following text:"
        )

    user = (
        f"{count_instruction}\n\n"
        f"---\n{request.text}\n---"
    )

    try:
        raw_text, _prov = await complete_text(
            system=_TEXT_SYSTEM_PROMPT + lang_hint,
            user=user,
            temperature=0.3,
            max_tokens=8192,
            timeout=120.0,
        )
    except AllLLMProvidersFailed as e:
        logger.warning("Text generation: all LLM providers failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="AIサービスに接続できませんでした。APIキー（Gemini / Hugging Face / Groq）を確認してください。",
        )
    except httpx.TimeoutException as e:
        logger.warning("LLM timeout (text generation): %s", e)
        raise HTTPException(
            status_code=504,
            detail="問題生成がタイムアウトしました。テキストを短くするか、しばらくしてから再度お試しください。",
        )

    questions = _parse_quiz_csv(raw_text)

    if not questions:
        raise HTTPException(
            status_code=422,
            detail="テキストから問題を生成できませんでした。別のテキストで再度お試しください。",
        )

    return {"questions": questions, "total": len(questions)}
