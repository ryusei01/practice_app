"""問題集の content_languages（ja / en の複数指定）の正規化と API 向けシリアライズ。"""
from __future__ import annotations

from typing import Any, List, Optional, Sequence

ALLOWED = frozenset({"ja", "en"})


def normalize_content_language_list(
    languages: Optional[Sequence[str]],
    legacy: Optional[str] = None,
) -> List[str]:
    out: list[str] = []
    if languages:
        for x in languages:
            if x in ALLOWED and x not in out:
                out.append(x)
    if not out and legacy in ALLOWED:
        out = [legacy]
    if not out:
        out = ["ja"]
    return out


def serialize_from_question_set_row(qs: Any) -> tuple[list[str], str]:
    """ORM の QuestionSet から (content_languages, 互換用 primary content_language)。"""
    raw = getattr(qs, "content_languages", None)
    legacy = getattr(qs, "content_language", None) or "ja"
    if isinstance(raw, list) and len(raw) > 0:
        langs = normalize_content_language_list(raw, None)
        if langs:
            return langs, langs[0]
    langs = normalize_content_language_list(None, legacy if legacy in ALLOWED else None)
    return langs, langs[0]


def ai_language_hint(langs: List[str]) -> str:
    """LLM プロンプト用の言語指示。"""
    uniq = normalize_content_language_list(langs, None)
    if uniq == ["ja"]:
        return "\nIMPORTANT: Generate all questions and answers in Japanese."
    if uniq == ["en"]:
        return "\nIMPORTANT: Generate all questions and answers in English."
    return (
        "\nIMPORTANT: This deck includes both Japanese and English. "
        "Mix or alternate languages by question as appropriate (e.g. roughly half in Japanese and half in English), "
        "unless the source material clearly favors one language."
    )


def parse_query_content_languages(
    content_languages: Optional[Sequence[str]],
    content_language: Optional[str],
) -> Optional[List[str]]:
    """generate-from-image などのクエリから一覧を組み立てる。未指定なら None。"""
    out: list[str] = []
    if content_languages:
        for x in content_languages:
            if x in ALLOWED and x not in out:
                out.append(x)
    if content_language in ALLOWED and content_language not in out:
        out.append(content_language)
    if not out:
        return None
    return out

