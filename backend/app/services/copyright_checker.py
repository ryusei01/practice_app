"""
著作権チェックサービス（Gemini → Hugging Face → Groq）。

販売者が問題集を公開する前に、コンテンツが著作権を侵害していないかを
クラウド LLM で自動評価する。モデルは環境変数（GEMINI_* / HF_* / GROQ_*）で指定。
"""
import json
import logging
import re
from typing import Optional

from .llm_router import complete_text, llm_cloud_configured

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
    """クラウド LLM を使った著作権リスク評価"""

    def __init__(self) -> None:
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
        モデル生テキストから JSON を抽出してパースする。
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
            AllLLMProvidersFailed: 全プロバイダが失敗した場合（呼び出し元で HTTP に変換）
        """
        content = self._build_content_text(title, description, question_texts)
        user = (
            f"Analyze the following educational content:\n\n{content}\n\n"
            "JSON response:"
        )

        logger.info("Calling cloud LLM for copyright check on: %s", title)

        raw_response, _prov = await complete_text(
            system=SYSTEM_PROMPT,
            user=user,
            temperature=0.1,
            max_tokens=512,
            timeout=self.timeout,
        )
        result = self._parse_response(raw_response)
        result["raw_response"] = raw_response

        logger.info(
            "Copyright check result for '%s': risk_level=%s",
            title,
            result["risk_level"],
        )
        return result

    async def is_available(self) -> bool:
        """クラウド LLM の API キーが 1 つでも設定されているか。"""
        return llm_cloud_configured()


# シングルトンインスタンス（アプリ起動時に1回だけ生成）
_checker: Optional[CopyrightChecker] = None


def get_copyright_checker() -> CopyrightChecker:
    global _checker
    if _checker is None:
        _checker = CopyrightChecker()
    return _checker
