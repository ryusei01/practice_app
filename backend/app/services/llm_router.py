"""
クラウド LLM のフォールバック連鎖: Gemini → Hugging Face Inference（router）→ Groq。
いずれかがレート制限・障害・空応答のとき次へ進む。キー未設定のプロバイダはスキップ。
"""
from __future__ import annotations

import logging
from typing import Any, List, Optional, Tuple

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)

GEMINI_GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class AllLLMProvidersFailed(Exception):
    """すべてのプロバイダで失敗したとき。"""

    def __init__(self, attempts: List[str]):
        self.attempts = attempts
        super().__init__("; ".join(attempts) if attempts else "no providers configured")


def llm_cloud_configured() -> bool:
    """テキスト用クラウド LLM が 1 つでも設定されているか。"""
    return bool(
        (settings.GEMINI_API_KEY or "").strip()
        or (settings.HF_TOKEN or "").strip()
        or (settings.GROQ_API_KEY or "").strip()
    )


def _should_fallback_http(status: int) -> bool:
    """次のプロバイダへ回す HTTP ステータス（クォータ・レート・一時障害など）。"""
    if status in (400, 401, 402, 403, 404, 408, 422, 429, 500, 502, 503, 504):
        return True
    return False


def _gemini_extract_text(data: dict) -> str:
    if data.get("error") and not data.get("candidates"):
        err = data["error"]
        raise ValueError(
            err.get("message", str(err)) if isinstance(err, dict) else str(err)
        )
    cands = data.get("candidates") or []
    if not cands:
        err = data.get("error", {})
        msg = err.get("message", "no candidates") if isinstance(err, dict) else "no candidates"
        raise ValueError(msg)
    parts = (cands[0].get("content") or {}).get("parts") or []
    texts = [p.get("text", "") for p in parts if isinstance(p, dict) and "text" in p]
    out = "".join(texts).strip()
    if not out:
        raise ValueError("empty Gemini text")
    return out


def _openai_style_extract(data: dict) -> str:
    ch = data.get("choices") or []
    if not ch:
        err = data.get("error", {})
        msg = err.get("message", "no choices")
        raise ValueError(msg)
    msg = ch[0].get("message") or {}
    content = msg.get("content")
    if content is None:
        raise ValueError("empty message content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        # マルチモーダル応答のテキスト部分のみ
        chunks = []
        for p in content:
            if isinstance(p, dict) and p.get("type") == "text":
                chunks.append(p.get("text") or "")
        return "".join(chunks).strip()
    raise ValueError("unexpected message content shape")


async def _gemini_text(
    client: httpx.AsyncClient,
    *,
    model: str,
    system: str,
    user: str,
    temperature: float,
    max_output_tokens: int,
    timeout: float,
) -> str:
    url = GEMINI_GENERATE_URL.format(model=model)
    body: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
        },
    }
    r = await client.post(
        url,
        params={"key": settings.GEMINI_API_KEY.strip()},
        json=body,
        timeout=timeout,
    )
    if r.status_code != 200:
        r.raise_for_status()
    return _gemini_extract_text(r.json())


async def _gemini_vision(
    client: httpx.AsyncClient,
    *,
    model: str,
    system: str,
    user_text: str,
    mime_type: str,
    image_b64: str,
    temperature: float,
    max_output_tokens: int,
    timeout: float,
) -> str:
    url = GEMINI_GENERATE_URL.format(model=model)
    body: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": user_text},
                    {"inline_data": {"mime_type": mime_type, "data": image_b64}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
        },
    }
    r = await client.post(
        url,
        params={"key": settings.GEMINI_API_KEY.strip()},
        json=body,
        timeout=timeout,
    )
    if r.status_code != 200:
        r.raise_for_status()
    return _gemini_extract_text(r.json())


async def _openai_compatible_chat(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: List[dict],
    temperature: float,
    max_tokens: int,
    timeout: float,
) -> str:
    url = f"{base_url.rstrip('/')}/chat/completions"
    r = await client.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        },
        timeout=timeout,
    )
    if r.status_code != 200:
        r.raise_for_status()
    return _openai_style_extract(r.json())


async def complete_text(
    *,
    system: str,
    user: str,
    temperature: float,
    max_tokens: int,
    timeout: float = 180.0,
) -> Tuple[str, str]:
    """
    テキスト完了。戻り値: (assistant_text, provider_name)
    """
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    attempts: List[str] = []

    async with httpx.AsyncClient() as client:
        key = (settings.GEMINI_API_KEY or "").strip()
        if key:
            try:
                text = await _gemini_text(
                    client,
                    model=settings.GEMINI_MODEL.strip(),
                    system=system,
                    user=user,
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    timeout=timeout,
                )
                logger.info("LLM text ok via gemini model=%s", settings.GEMINI_MODEL)
                return text, "gemini"
            except httpx.HTTPStatusError as e:
                msg = f"gemini HTTP {e.response.status_code}"
                attempts.append(msg)
                if _should_fallback_http(e.response.status_code):
                    logger.warning("LLM gemini fallback: %s", msg)
                else:
                    raise
            except Exception as e:
                attempts.append(f"gemini: {e}")
                logger.warning("LLM gemini fallback: %s", e)

        hf = (settings.HF_TOKEN or "").strip()
        if hf:
            try:
                text = await _openai_compatible_chat(
                    client,
                    base_url=settings.HF_CHAT_BASE_URL,
                    api_key=hf,
                    model=settings.HF_CHAT_MODEL.strip(),
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                )
                logger.info("LLM text ok via huggingface model=%s", settings.HF_CHAT_MODEL)
                return text, "huggingface"
            except httpx.HTTPStatusError as e:
                msg = f"huggingface HTTP {e.response.status_code}"
                attempts.append(msg)
                if _should_fallback_http(e.response.status_code):
                    logger.warning("LLM huggingface fallback: %s", msg)
                else:
                    raise
            except Exception as e:
                attempts.append(f"huggingface: {e}")
                logger.warning("LLM huggingface fallback: %s", e)

        gq = (settings.GROQ_API_KEY or "").strip()
        if gq:
            try:
                text = await _openai_compatible_chat(
                    client,
                    base_url=settings.GROQ_BASE_URL,
                    api_key=gq,
                    model=settings.GROQ_MODEL.strip(),
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                )
                logger.info("LLM text ok via groq model=%s", settings.GROQ_MODEL)
                return text, "groq"
            except httpx.HTTPStatusError as e:
                msg = f"groq HTTP {e.response.status_code}"
                attempts.append(msg)
                logger.warning("LLM groq failed: %s", msg)
                raise AllLLMProvidersFailed(attempts + [msg]) from e
            except Exception as e:
                attempts.append(f"groq: {e}")
                logger.warning("LLM groq failed: %s", e)
                raise AllLLMProvidersFailed(attempts) from e

    raise AllLLMProvidersFailed(attempts or ["no API keys (GEMINI_API_KEY, HF_TOKEN, GROQ_API_KEY)"])


async def complete_vision(
    *,
    system: str,
    user_text: str,
    mime_type: str,
    image_b64: str,
    temperature: float,
    max_tokens: int,
    timeout: float = 120.0,
) -> Tuple[str, str]:
    """画像＋テキスト。OpenAI 互換は user.content に text + image_url を載せる。"""
    attempts: List[str] = []

    data_url = f"data:{mime_type};base64,{image_b64}"
    oai_user_content: List[dict] = [
        {"type": "text", "text": user_text},
        {"type": "image_url", "image_url": {"url": data_url}},
    ]
    messages_hf_groq = [
        {"role": "system", "content": system},
        {"role": "user", "content": oai_user_content},
    ]

    async with httpx.AsyncClient() as client:
        key = (settings.GEMINI_API_KEY or "").strip()
        if key:
            try:
                text = await _gemini_vision(
                    client,
                    model=settings.GEMINI_VISION_MODEL.strip(),
                    system=system,
                    user_text=user_text,
                    mime_type=mime_type,
                    image_b64=image_b64,
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    timeout=timeout,
                )
                logger.info("LLM vision ok via gemini model=%s", settings.GEMINI_VISION_MODEL)
                return text, "gemini"
            except httpx.HTTPStatusError as e:
                msg = f"gemini vision HTTP {e.response.status_code}"
                attempts.append(msg)
                if _should_fallback_http(e.response.status_code):
                    logger.warning("LLM gemini vision fallback: %s", msg)
                else:
                    raise
            except Exception as e:
                attempts.append(f"gemini vision: {e}")
                logger.warning("LLM gemini vision fallback: %s", e)

        hf = (settings.HF_TOKEN or "").strip()
        if hf:
            try:
                text = await _openai_compatible_chat(
                    client,
                    base_url=settings.HF_CHAT_BASE_URL,
                    api_key=hf,
                    model=settings.HF_VISION_MODEL.strip(),
                    messages=messages_hf_groq,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                )
                logger.info("LLM vision ok via huggingface model=%s", settings.HF_VISION_MODEL)
                return text, "huggingface"
            except httpx.HTTPStatusError as e:
                msg = f"huggingface vision HTTP {e.response.status_code}"
                attempts.append(msg)
                if _should_fallback_http(e.response.status_code):
                    logger.warning("LLM huggingface vision fallback: %s", msg)
                else:
                    raise
            except Exception as e:
                attempts.append(f"huggingface vision: {e}")
                logger.warning("LLM huggingface vision fallback: %s", e)

        gq = (settings.GROQ_API_KEY or "").strip()
        if gq:
            try:
                text = await _openai_compatible_chat(
                    client,
                    base_url=settings.GROQ_BASE_URL,
                    api_key=gq,
                    model=settings.GROQ_VISION_MODEL.strip(),
                    messages=messages_hf_groq,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                )
                logger.info("LLM vision ok via groq model=%s", settings.GROQ_VISION_MODEL)
                return text, "groq"
            except httpx.HTTPStatusError as e:
                msg = f"groq vision HTTP {e.response.status_code}"
                attempts.append(msg)
                raise AllLLMProvidersFailed(attempts + [msg]) from e
            except Exception as e:
                attempts.append(f"groq vision: {e}")
                raise AllLLMProvidersFailed(attempts) from e

    raise AllLLMProvidersFailed(attempts or ["no API keys for vision"])
