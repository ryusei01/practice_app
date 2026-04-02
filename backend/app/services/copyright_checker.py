"""
著作権チェックサービス（GPT-OSS via Ollama）

販売者が問題集を公開する前に、コンテンツが著作権を侵害していないかを
GPT-OSS モデル（Ollama 経由・無料・ローカル実行）で自動評価する。

使用モデル: gpt-oss-20b（設定: OLLAMA_COPYRIGHT_CHECK_MODEL）
  - 16GB VRAM 以内で動作
  - Apache 2.0 ライセンス・商用無料
  - ollama pull gpt-oss-20b で事前ダウンロード要
"""
import json
import logging
import re
from typing import Optional

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a copyright compliance auditor for an educational quiz platform.
Your task is to analyze educational question set content and determine if it shows signs
of being directly copied from copyrighted materials such as textbooks, standardized tests,
paid courses, or other published works.

You MUST respond ONLY with a valid JSON object in the following format, with no additional text:
{"risk_level": "low"|"medium"|"high", "reasons": ["reason1", "reason2"], "recommendation": "brief advice in Japanese"}

HIGH risk indicators (respond with "high"):
- Explicit copyright notices (e.g. "© 2024 Publisher", "All rights reserved")
- Publisher or author names embedded in questions
- Standardized test question formatting (e.g. "Which of the following BEST describes...")
- Specific references to named textbooks or paid courses
- Verbatim passages that appear to be from known publications
- Highly specific proprietary terminology unique to a single publication

MEDIUM risk indicators (respond with "medium"):
- Questions that follow a distinctive style of a known test series
- Content that closely resembles commercially available materials
- Multiple questions on very narrow specialized topics without original framing

LOW risk indicators (respond with "low"):
- Original phrasing and creative content
- General knowledge questions with common vocabulary
- Questions based on publicly available information
- Clearly original educational content"""


class CopyrightChecker:
    """GPT-OSS（Ollama経由）を使った著作権リスク評価"""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_COPYRIGHT_CHECK_MODEL
        self.timeout = 120.0  # LLM 推論は時間がかかるため長めに設定

    def _build_content_text(
        self,
        title: str,
        description: Optional[str],
        question_texts: list[str],
    ) -> str:
        """チェック対象のテキストを結合する（先頭 2000 文字に収める）"""
        parts = [f"Title: {title}"]
        if description:
            parts.append(f"Description: {description}")
        if question_texts:
            combined_questions = " | ".join(question_texts)
            parts.append(f"Questions: {combined_questions}")
        full_text = "\n".join(parts)
        return full_text[:2000]

    def _parse_response(self, raw: str) -> dict:
        """
        Ollama の生レスポンスから JSON を抽出してパースする。
        モデルが余分なテキストを出力した場合にも対応。
        """
        # JSON ブロックを探す
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not json_match:
            logger.warning("GPT-OSS response contains no JSON: %s", raw[:200])
            return {
                "risk_level": "medium",
                "reasons": ["AIの応答を解析できませんでした。手動でご確認ください。"],
                "recommendation": "コンテンツを手動で確認してください。",
            }

        try:
            data = json.loads(json_match.group())
            risk = data.get("risk_level", "medium")
            if risk not in ("low", "medium", "high"):
                risk = "medium"
            return {
                "risk_level": risk,
                "reasons": data.get("reasons", []),
                "recommendation": data.get("recommendation", ""),
            }
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse GPT-OSS JSON: %s | raw: %s", e, raw[:200])
            return {
                "risk_level": "medium",
                "reasons": ["AIの応答のJSON解析に失敗しました。手動でご確認ください。"],
                "recommendation": "コンテンツを手動で確認してください。",
            }

    async def check(
        self,
        title: str,
        description: Optional[str],
        question_texts: list[str],
    ) -> dict:
        """
        著作権リスクを評価する。

        Args:
            title: 問題集タイトル
            description: 問題集の説明
            question_texts: 問題文のリスト

        Returns:
            {
                "risk_level": "low" | "medium" | "high",
                "reasons": [...],
                "recommendation": "...",
                "raw_response": "...",
            }

        Raises:
            httpx.ConnectError: Ollama が起動していない場合
            httpx.TimeoutException: タイムアウトした場合
        """
        content = self._build_content_text(title, description, question_texts)
        prompt = (
            f"{SYSTEM_PROMPT}\n\n"
            f"Analyze the following educational content:\n\n{content}\n\n"
            "JSON response:"
        )

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,  # 一貫した判定のため低温に設定
                "num_predict": 512,
            },
        }

        logger.info("Calling GPT-OSS (%s) for copyright check on: %s", self.model, title)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        raw_response = data.get("response", "")
        result = self._parse_response(raw_response)
        result["raw_response"] = raw_response

        logger.info(
            "Copyright check result for '%s': risk_level=%s",
            title,
            result["risk_level"],
        )
        return result


# シングルトンインスタンス（アプリ起動時に1回だけ生成）
_checker: Optional[CopyrightChecker] = None


def get_copyright_checker() -> CopyrightChecker:
    global _checker
    if _checker is None:
        _checker = CopyrightChecker()
    return _checker
