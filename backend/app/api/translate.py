"""
翻訳API
問題文・回答・説明文などを自動翻訳する
ローカルLLM（Ollama）とGoogleTranslatorの両方に対応
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from deep_translator import GoogleTranslator
from ..services.local_translator import LocalTranslator
from ..services.textbook_translator import TextbookTranslator
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# ローカル翻訳サービスのインスタンス（必要に応じて初期化）
_local_translator: Optional[LocalTranslator] = None


def get_translator():
    """翻訳サービスを取得（ローカルLLMまたはGoogleTranslator）"""
    global _local_translator

    if settings.USE_LOCAL_TRANSLATION:
        if _local_translator is None:
            _local_translator = LocalTranslator(
                base_url=settings.OLLAMA_BASE_URL
            )
        return _local_translator
    else:
        return None  # GoogleTranslatorを使用


class TranslateRequest(BaseModel):
    """翻訳リクエスト"""
    text: str
    source_lang: str = "auto"  # 自動検出
    target_lang: str  # 翻訳先言語 (en, ja, etc.)


class TranslateResponse(BaseModel):
    """翻訳レスポンス"""
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str


@router.post("/translate", response_model=TranslateResponse)
async def translate_text(request: TranslateRequest):
    """
    テキストを翻訳する

    Args:
        request: 翻訳リクエスト

    Returns:
        TranslateResponse: 翻訳結果

    Raises:
        HTTPException: 翻訳エラー
    """
    try:
        if not request.text.strip():
            raise HTTPException(
                status_code=400,
                detail="テキストが空です"
            )

        translator = get_translator()

        # ローカルLLMを使用する場合
        if translator is not None:
            try:
                translated = await translator.translate(
                    text=request.text,
                    target_lang=request.target_lang,
                    source_lang=request.source_lang if request.source_lang != "auto" else None
                )
            except Exception as e:
                logger.warning(f"Local translation failed, falling back to Google: {str(e)}")
                # フォールバック: GoogleTranslatorを使用
                translator_google = GoogleTranslator(
                    source=request.source_lang,
                    target=request.target_lang
                )
                translated = translator_google.translate(request.text)
        else:
            # Google Translatorを使用
            translator_google = GoogleTranslator(
                source=request.source_lang,
                target=request.target_lang
            )
            translated = translator_google.translate(request.text)

        # 翻訳結果が空の場合は元のテキストを返す
        if not translated:
            translated = request.text

        logger.info(f"Translation: {request.source_lang} -> {request.target_lang}")

        return TranslateResponse(
            original_text=request.text,
            translated_text=translated,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )

    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"翻訳エラー: {str(e)}"
        )


class BatchTranslateRequest(BaseModel):
    """一括翻訳リクエスト"""
    texts: list[str]
    source_lang: str = "auto"
    target_lang: str


class BatchTranslateResponse(BaseModel):
    """一括翻訳レスポンス"""
    translations: list[dict]  # [{"original": "", "translated": ""}]
    source_lang: str
    target_lang: str


@router.post("/translate/batch", response_model=BatchTranslateResponse)
async def translate_batch(request: BatchTranslateRequest):
    """
    複数のテキストを一括翻訳する

    Args:
        request: 一括翻訳リクエスト

    Returns:
        BatchTranslateResponse: 翻訳結果リスト
    """
    try:
        if not request.texts:
            raise HTTPException(
                status_code=400,
                detail="翻訳するテキストがありません"
            )

        translator = get_translator()

        # ローカルLLMを使用する場合
        if translator is not None:
            try:
                results = await translator.translate_batch(
                    texts=request.texts,
                    target_lang=request.target_lang,
                    source_lang=request.source_lang if request.source_lang != "auto" else None
                )
                translations = results
            except Exception as e:
                logger.warning(f"Local batch translation failed, falling back to Google: {str(e)}")
                # フォールバック: GoogleTranslatorを使用
                translator_google = GoogleTranslator(
                    source=request.source_lang,
                    target=request.target_lang
                )
                translations = []
                for text in request.texts:
                    if not text.strip():
                        translations.append({"original": text, "translated": text})
                        continue
                    try:
                        translated = translator_google.translate(text)
                        if not translated:
                            translated = text
                        translations.append({"original": text, "translated": translated})
                    except Exception as e2:
                        logger.warning(f"Failed to translate text: {str(e2)}")
                        translations.append({"original": text, "translated": text})
        else:
            # Google Translatorを使用
            translator_google = GoogleTranslator(
                source=request.source_lang,
                target=request.target_lang
            )

            translations = []
            for text in request.texts:
                if not text.strip():
                    # 空のテキストはそのまま
                    translations.append({
                        "original": text,
                        "translated": text
                    })
                    continue

                try:
                    translated = translator_google.translate(text)
                    if not translated:
                        translated = text

                    translations.append({
                        "original": text,
                        "translated": translated
                    })
                except Exception as e:
                    logger.warning(f"Failed to translate text: {str(e)}")
                    # エラーの場合は元のテキストを使用
                    translations.append({
                        "original": text,
                        "translated": text
                    })

        logger.info(f"Batch translation: {len(translations)} texts translated")

        return BatchTranslateResponse(
            translations=translations,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch translation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"一括翻訳エラー: {str(e)}"
        )


class QuestionTranslateRequest(BaseModel):
    """問題翻訳リクエスト"""
    question_text: str
    correct_answer: str
    explanation: Optional[str] = None
    target_lang: str
    source_lang: str = "auto"


class QuestionTranslateResponse(BaseModel):
    """問題翻訳レスポンス"""
    question_text: str
    correct_answer: str
    explanation: Optional[str] = None
    source_lang: str
    target_lang: str


@router.post("/translate/question", response_model=QuestionTranslateResponse)
async def translate_question(request: QuestionTranslateRequest):
    """
    問題（問題文、正解、説明）を翻訳する

    Args:
        request: 問題翻訳リクエスト

    Returns:
        QuestionTranslateResponse: 翻訳結果
    """
    try:
        texts = [request.question_text, request.correct_answer]
        if request.explanation:
            texts.append(request.explanation)

        translator = get_translator()

        # ローカルLLMを使用する場合
        if translator is not None:
            try:
                results = await translator.translate_batch(
                    texts=texts,
                    target_lang=request.target_lang,
                    source_lang=request.source_lang if request.source_lang != "auto" else None
                )
                translated_texts = [r["translated"] for r in results]
            except Exception as e:
                logger.warning(f"Local translation failed, falling back to Google: {str(e)}")
                # フォールバック: GoogleTranslatorを使用
                translator_google = GoogleTranslator(
                    source=request.source_lang,
                    target=request.target_lang
                )
                translated_texts = [translator_google.translate(text) for text in texts]
        else:
            # Google Translatorを使用
            translator_google = GoogleTranslator(
                source=request.source_lang,
                target=request.target_lang
            )
            translated_texts = [translator_google.translate(text) for text in texts]

        return QuestionTranslateResponse(
            question_text=translated_texts[0],
            correct_answer=translated_texts[1],
            explanation=translated_texts[2] if request.explanation else None,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )

    except Exception as e:
        logger.error(f"Question translation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"問題翻訳エラー: {str(e)}"
        )


class TextbookTranslateRequest(BaseModel):
    """教科書翻訳リクエスト"""
    markdown_text: str
    target_lang: str
    source_lang: str = "auto"


class TextbookTranslateResponse(BaseModel):
    """教科書翻訳レスポンス"""
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str


@router.post("/translate/textbook", response_model=TextbookTranslateResponse)
async def translate_textbook(request: TextbookTranslateRequest):
    """
    教科書（Markdown）を翻訳する

    Args:
        request: 教科書翻訳リクエスト

    Returns:
        TextbookTranslateResponse: 翻訳結果
    """
    try:
        if not request.markdown_text.strip():
            raise HTTPException(
                status_code=400,
                detail="教科書テキストが空です"
            )

        # #region agent log
        with open(r'h:\document\program\project\practice_app\.cursor\debug.log', 'a', encoding='utf-8') as f:
            f.write(f'{{"timestamp":{int(__import__("time").time()*1000)},"location":"translate.py:345","message":"translate_textbook API called","data":{{"source_lang":"{request.source_lang}","target_lang":"{request.target_lang}","text_length":{len(request.markdown_text)},"source_lang_will_be":"{request.source_lang if request.source_lang != "auto" else "None"}"}},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}}\n')
        # #endregion
        translator = TextbookTranslator()
        translated = await translator.translate_markdown(
            markdown_text=request.markdown_text,
            target_lang=request.target_lang,
            source_lang=request.source_lang if request.source_lang != "auto" else None
        )
        # #region agent log
        with open(r'h:\document\program\project\practice_app\.cursor\debug.log', 'a', encoding='utf-8') as f:
            f.write(f'{{"timestamp":{int(__import__("time").time()*1000)},"location":"translate.py:352","message":"translate_markdown returned","data":{{"translated_length":{len(translated)},"translated_preview":"{translated[:200].replace(chr(34),chr(92)+chr(34))}"}},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}}\n')
        # #endregion
        logger.info(f"Textbook translation: {request.source_lang} -> {request.target_lang}")

        return TextbookTranslateResponse(
            original_text=request.markdown_text,
            translated_text=translated,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )

    except Exception as e:
        logger.error(f"Textbook translation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"教科書翻訳エラー: {str(e)}"
        )


@router.get("/translate/status")
async def get_translation_status():
    """
    翻訳サービスの状態を取得

    Returns:
        翻訳サービスの状態（ローカルLLMが利用可能かどうか）
    """
    translator = get_translator()
    
    if translator is not None:
        is_available = await translator.is_available()
        return {
            "use_local": True,
            "available": is_available,
            "model": settings.OLLAMA_TRANSLATION_MODEL,
            "base_url": settings.OLLAMA_BASE_URL
        }
    else:
        return {
            "use_local": False,
            "available": True,
            "service": "GoogleTranslator"
        }
