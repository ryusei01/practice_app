"""
Google 翻訳の非公式 Web エンドポイントを呼び出す薄いラッパー。

deep-translator は PYSEC-2022-252 の対象のため依存を外し、
deep-translator の GoogleTranslator と同等のコンストラクタ・translate シグネチャを維持する。
（リクエスト形式は MIT ライセンスの deep-translator に準拠）
"""
from __future__ import annotations

import re
from typing import Any, Optional

import httpx
from bs4 import BeautifulSoup

_GOOGLE_M_URL = "https://translate.google.com/m"

# よく使う言語名 → Google コード（deep-translator のサブセット）
_LANGUAGE_NAMES: dict[str, str] = {
    "english": "en",
    "japanese": "ja",
    "korean": "ko",
    "chinese (simplified)": "zh-CN",
    "chinese (traditional)": "zh-TW",
    "french": "fr",
    "german": "de",
    "spanish": "es",
    "italian": "it",
    "portuguese": "pt",
    "russian": "ru",
    "arabic": "ar",
    "hindi": "hi",
    "indonesian": "id",
    "vietnamese": "vi",
    "thai": "th",
    "turkish": "tr",
    "polish": "pl",
    "dutch": "nl",
    "swedish": "sv",
    "norwegian": "no",
    "danish": "da",
    "finnish": "fi",
    "czech": "cs",
    "hungarian": "hu",
    "romanian": "ro",
    "ukrainian": "uk",
    "greek": "el",
    "hebrew": "iw",
    "persian": "fa",
    "bengali": "bn",
    "tamil": "ta",
    "telugu": "te",
    "malay": "ms",
    "filipino": "tl",
    "latin": "la",
}

_CODE_RE = re.compile(r"^[a-z]{2,3}(-[a-zA-Z0-9]+)?$", re.IGNORECASE)


def _normalize_lang(raw: str) -> str:
    s = raw.strip()
    if not s or s.lower() == "auto":
        return "auto"
    key = s.lower()
    if key in _LANGUAGE_NAMES:
        return _LANGUAGE_NAMES[key]
    if s in _LANGUAGE_NAMES.values():
        return s
    for v in _LANGUAGE_NAMES.values():
        if v.lower() == s.lower():
            return v
    if _CODE_RE.fullmatch(s):
        return s
    raise ValueError(f"Unsupported language: {raw!r}")


class GoogleTranslator:
    """deep_translator.GoogleTranslator と互換の最小実装。"""

    def __init__(
        self,
        source: str = "auto",
        target: str = "en",
        proxies: Optional[dict[str, Any]] = None,
        **kwargs: Any,
    ):
        self.proxies = proxies
        self._kwargs = kwargs
        self._source = _normalize_lang(source)
        self._target = _normalize_lang(target)

    def translate(self, text: str, **kwargs: Any) -> str:
        if not isinstance(text, str):
            raise TypeError("text must be str")
        text = text.strip()
        if self._source == self._target or not text:
            return text
        if len(text) >= 5000:
            raise ValueError("text must be shorter than 5000 characters")

        return self._translate_once(text, omit_hl=False)

    def _translate_once(self, text: str, *, omit_hl: bool) -> str:
        params: dict[str, str] = {
            "tl": self._target,
            "sl": self._source,
            "q": text,
        }
        if not omit_hl and self._kwargs.get("hl") is not None:
            params["hl"] = str(self._kwargs["hl"])

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        }
        proxy = None
        if self.proxies:
            proxy = self.proxies.get("https") or self.proxies.get("http")

        with httpx.Client(proxy=proxy, headers=headers, timeout=30.0) as client:
            r = client.get(_GOOGLE_M_URL, params=params)
        if r.status_code == 429:
            raise RuntimeError("Too many requests to Google Translate")
        if r.status_code < 200 or r.status_code > 299:
            raise RuntimeError(f"Google Translate HTTP {r.status_code}")

        soup = BeautifulSoup(r.text, "html.parser")
        element = soup.find("div", class_="t0")
        if not element:
            element = soup.find("div", class_="result-container")
        if not element:
            raise RuntimeError(f"Translation not found for: {text[:80]!r}")

        out = element.get_text(strip=True)
        if out == text.strip():
            alpha_src = "".join(ch for ch in text.strip() if ch.isalnum())
            alpha_out = "".join(ch for ch in out if ch.isalnum())
            if alpha_src and alpha_out and alpha_src == alpha_out:
                if omit_hl:
                    return text.strip()
                if self._kwargs.get("hl") is not None:
                    return self._translate_once(text, omit_hl=True)
                return text.strip()
        return out
