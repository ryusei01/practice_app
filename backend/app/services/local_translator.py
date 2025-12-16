"""
ローカルLLMを使用した翻訳サービス
Ollamaを使用してローカルで翻訳を実行
"""
import httpx
import logging
from typing import Optional, Dict, List
from ..core.config import settings

logger = logging.getLogger(__name__)


class LocalTranslator:
    """ローカルLLM（Ollama）を使用した翻訳サービス"""

    def __init__(self, base_url: str = "http://localhost:11434"):
        """
        初期化

        Args:
            base_url: OllamaのベースURL（デフォルト: http://localhost:11434）
        """
        self.base_url = base_url
        self.model = getattr(settings, "OLLAMA_TRANSLATION_MODEL", "llama3.2:1b")
        self.timeout = 60.0  # タイムアウト（秒）

    def _get_language_code(self, lang: str) -> str:
        """
        言語コードを取得

        Args:
            lang: 言語名（"ja", "en", "japanese", "english"など）

        Returns:
            言語コード（"Japanese", "English"など）
        """
        lang_lower = lang.lower()
        if lang_lower in ["ja", "japanese", "日本語"]:
            return "Japanese"
        elif lang_lower in ["en", "english", "英語"]:
            return "English"
        elif lang_lower in ["zh", "chinese", "中国語"]:
            return "Chinese"
        elif lang_lower in ["ko", "korean", "韓国語"]:
            return "Korean"
        elif lang_lower in ["es", "spanish", "スペイン語"]:
            return "Spanish"
        elif lang_lower in ["fr", "french", "フランス語"]:
            return "French"
        elif lang_lower in ["de", "german", "ドイツ語"]:
            return "German"
        else:
            return lang.capitalize()

    def _detect_language(self, text: str) -> str:
        """
        テキストの言語を自動検出（簡易版）

        Args:
            text: 検出するテキスト

        Returns:
            言語コード（"Japanese" or "English"）
        """
        # 日本語の文字が含まれているかチェック
        japanese_chars = any(
            "\u3040" <= char <= "\u309F"  # ひらがな
            or "\u30A0" <= char <= "\u30FF"  # カタカナ
            or "\u4E00" <= char <= "\u9FAF"  # 漢字
            for char in text
        )

        return "Japanese" if japanese_chars else "English"

    async def translate(
        self,
        text: str,
        target_lang: str,
        source_lang: Optional[str] = None,
    ) -> str:
        """
        テキストを翻訳

        Args:
            text: 翻訳するテキスト
            target_lang: 翻訳先言語
            source_lang: 翻訳元言語（Noneの場合は自動検出）

        Returns:
            翻訳されたテキスト

        Raises:
            Exception: 翻訳エラー
        """
        if not text.strip():
            return text

        # 言語コードを取得
        if source_lang is None or source_lang == "auto":
            source_lang = self._detect_language(text)

        source_lang_code = self._get_language_code(source_lang)
        target_lang_code = self._get_language_code(target_lang)

        # 同じ言語の場合は翻訳不要
        if source_lang_code == target_lang_code:
            return text

        # プロンプトを作成
        prompt = f"""Translate the following text from {source_lang_code} to {target_lang_code}.
Only output the translated text, without any explanation or additional text.

Text to translate:
{text}

Translation:"""

        try:
            # Ollama APIを呼び出し
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                    },
                )

                if response.status_code != 200:
                    logger.error(
                        f"Ollama API error: {response.status_code} - {response.text}"
                    )
                    raise Exception(f"Ollama API error: {response.status_code}")

                result = response.json()
                translated = result.get("response", "").strip()

                # 翻訳結果が空の場合は元のテキストを返す
                if not translated:
                    logger.warning("Translation result is empty, returning original text")
                    return text

                logger.info(
                    f"Translation successful: {source_lang_code} -> {target_lang_code}"
                )
                return translated

        except httpx.TimeoutException:
            logger.error("Translation timeout")
            raise Exception("翻訳がタイムアウトしました。Ollamaが起動しているか確認してください。")
        except httpx.ConnectError:
            logger.error("Cannot connect to Ollama")
            raise Exception(
                "Ollamaに接続できません。Ollamaが起動しているか確認してください。"
            )
        except Exception as e:
            logger.error(f"Translation error: {str(e)}")
            raise Exception(f"翻訳エラー: {str(e)}")

    async def translate_batch(
        self,
        texts: List[str],
        target_lang: str,
        source_lang: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        """
        複数のテキストを一括翻訳

        Args:
            texts: 翻訳するテキストのリスト
            target_lang: 翻訳先言語
            source_lang: 翻訳元言語（Noneの場合は自動検出）

        Returns:
            翻訳結果のリスト [{"original": "", "translated": ""}, ...]
        """
        results = []

        for text in texts:
            if not text.strip():
                results.append({"original": text, "translated": text})
                continue

            try:
                translated = await self.translate(text, target_lang, source_lang)
                results.append({"original": text, "translated": translated})
            except Exception as e:
                logger.warning(f"Failed to translate text: {str(e)}")
                # エラーの場合は元のテキストを使用
                results.append({"original": text, "translated": text})

        return results

    async def is_available(self) -> bool:
        """
        Ollamaが利用可能かチェック

        Returns:
            True: 利用可能、False: 利用不可
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False


