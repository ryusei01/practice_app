"""
翻訳API
問題文・回答・説明文などを自動翻訳する
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from deep_translator import GoogleTranslator
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


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

        # Google Translatorを使用
        translator = GoogleTranslator(
            source=request.source_lang,
            target=request.target_lang
        )

        translated = translator.translate(request.text)

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

        translator = GoogleTranslator(
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
                translated = translator.translate(text)
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
