"""
AI関連のAPIエンドポイント
"""
import base64
import csv
import io
import json
import logging
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from pydantic import BaseModel, Field

from ..core.database import get_db
from ..core.config import settings
from ..ai import QuestionRecommender, ScorePredictor
from ..services.learning_plan_generator import get_learning_plan_generator

router = APIRouter()
logger = logging.getLogger(__name__)


class RecommendationRequest(BaseModel):
    user_id: str
    question_set_id: str
    count: int = 10
    target_difficulty: Optional[float] = None


class RecommendationResponse(BaseModel):
    question_ids: List[str]
    count: int


class ScorePredictionRequest(BaseModel):
    user_id: str
    question_set_id: Optional[str] = None
    max_score: int = 100


class GenerateLearningPlanRequest(BaseModel):
    goal: str = Field(..., min_length=1, max_length=2000)
    weeks: int = Field(4, ge=1, le=24)
    daily_hours: float = Field(1.0, ge=0.25, le=24.0)
    weak_categories: List[str] = Field(default_factory=list)


@router.post("/generate-learning-plan")
async def generate_learning_plan(request: GenerateLearningPlanRequest):
    """
    Ollama（GPT-OSS 等）で学習プランを生成する。
    接続失敗時は 503、それ以外のサーバエラーは 500。
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
    except httpx.ConnectError as e:
        logger.warning("Ollama connect error (learning plan): %s", e)
        raise HTTPException(
            status_code=503,
            detail="ローカルLLM（Ollama）に接続できません。Ollama を起動し、モデルを取得してから再度お試しください。",
        )
    except httpx.TimeoutException as e:
        logger.warning("Ollama timeout (learning plan): %s", e)
        raise HTTPException(
            status_code=504,
            detail="学習プランの生成がタイムアウトしました。しばらくしてから再度お試しください。",
        )
    except httpx.HTTPStatusError as e:
        logger.warning("Ollama HTTP error (learning plan): %s", e)
        raise HTTPException(
            status_code=502,
            detail="ローカルLLMからエラー応答がありました。Ollama のログを確認してください。",
        )
    except Exception as e:
        logger.exception("Learning plan generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommend", response_model=RecommendationResponse)
async def recommend_questions(
    request: RecommendationRequest,
    db: Session = Depends(get_db)
):
    """
    AIによる問題推薦

    ユーザーの回答履歴から最適な問題を選定して返す
    """
    recommender = QuestionRecommender(db)

    try:
        question_ids = recommender.recommend_questions(
            user_id=request.user_id,
            question_set_id=request.question_set_id,
            count=request.count,
            target_difficulty=request.target_difficulty
        )

        return RecommendationResponse(
            question_ids=question_ids,
            count=len(question_ids)
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict-score")
async def predict_score(
    request: ScorePredictionRequest,
    db: Session = Depends(get_db)
):
    """
    AIによる予想スコア算出

    ユーザーの回答履歴から今受験したら取れそうなスコアを予測
    """
    predictor = ScorePredictor(db)

    try:
        prediction = predictor.predict_score(
            user_id=request.user_id,
            question_set_id=request.question_set_id,
            max_score=request.max_score
        )

        return prediction
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/category-predictions/{user_id}")
async def get_category_predictions(
    user_id: str,
    max_score: int = 100,
    db: Session = Depends(get_db)
):
    """
    カテゴリ別の予想スコアを取得
    """
    predictor = ScorePredictor(db)

    try:
        predictions = predictor.get_category_predictions(
            user_id=user_id,
            max_score=max_score
        )
        return predictions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/improvement-suggestions/{user_id}")
async def get_improvement_suggestions(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    学習改善の提案を取得
    """
    predictor = ScorePredictor(db)

    try:
        suggestions = predictor.get_improvement_suggestions(user_id=user_id)
        return {"suggestions": suggestions}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/adaptive-difficulty/{user_id}/{category}")
async def get_adaptive_difficulty(
    user_id: str,
    category: str,
    db: Session = Depends(get_db)
):
    """
    次の問題の推奨難易度を取得（適応型学習）
    """
    recommender = QuestionRecommender(db)

    try:
        difficulty = recommender.get_next_adaptive_difficulty(
            user_id=user_id,
            category=category
        )
        return {
            "category": category,
            "recommended_difficulty": difficulty
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Image OCR → Question Generation ---

_VISION_SYSTEM_PROMPT = """You are a quiz generator. Given an image (textbook page, whiteboard, notes, etc.),
extract the content and generate quiz questions in CSV format.

Output ONLY valid CSV with this header (no markdown fences, no commentary):
question_text,question_type,option_1,option_2,option_3,option_4,correct_answer,explanation,difficulty,category

Rules:
- Generate 3-10 questions based on the image content
- Mix question types: multiple_choice, true_false, text_input
- For multiple_choice: fill option_1 through option_4, correct_answer must match one option exactly
- For true_false: leave options empty, correct_answer is "true" or "false"
- For text_input: leave options empty, correct_answer is the answer text
- difficulty: 0.0 to 1.0
- Use the same language as the image content
- Be accurate — do not fabricate information not present in the image
"""


@router.post("/generate-from-image")
async def generate_from_image(
    file: UploadFile = File(...),
    count: int = Query(5, ge=1, le=20),
):
    """Generate quiz questions from an image using a vision LLM."""
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10 MB)")

    b64_image = base64.b64encode(contents).decode("utf-8")

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_VISION_MODEL,
                    "prompt": f"{_VISION_SYSTEM_PROMPT}\n\nGenerate approximately {count} questions from this image.",
                    "images": [b64_image],
                    "stream": False,
                    "options": {"temperature": 0.3},
                },
            )
            response.raise_for_status()
            result = response.json()
            raw_text = result.get("response", "")

    except httpx.HTTPError as e:
        logger.error("Vision LLM call failed: %s", e)
        raise HTTPException(status_code=502, detail="Vision model unavailable. Ensure Ollama is running with a vision model.")

    # Parse CSV output
    csv_text = raw_text.strip()
    # Remove markdown fences if present
    csv_text = re.sub(r"^```(?:csv)?\s*\n?", "", csv_text)
    csv_text = re.sub(r"\n?```\s*$", "", csv_text)

    questions = []
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

            diff_str = (row.get("difficulty") or "0.5").strip()
            try:
                difficulty = max(0.0, min(1.0, float(diff_str)))
            except ValueError:
                difficulty = 0.5

            questions.append({
                "question_text": q_text,
                "question_type": q_type,
                "options": options,
                "correct_answer": c_answer,
                "explanation": (row.get("explanation") or "").strip() or None,
                "difficulty": difficulty,
                "category": (row.get("category") or "").strip() or None,
            })
    except Exception as e:
        logger.warning("Failed to parse vision LLM CSV output: %s\nRaw: %s", e, csv_text[:500])

    if not questions:
        raise HTTPException(
            status_code=422,
            detail="Could not generate questions from this image. Try a clearer image or different content.",
        )

    return {"questions": questions, "total": len(questions)}
