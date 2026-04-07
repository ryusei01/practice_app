"""
記述式採点サービス（独自テキスト類似度ベース）

- ルーブリック項目ごとに独自テキスト類似度で部分点を付与
- 誤概念（ミスコンセプション）の分類
- 同義語・言い換えはレーベンシュタイン距離 + トークン重複で吸収
- 外部ライブラリ不使用
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Optional


def _normalize(text: str) -> str:
    """NFKC正規化 + 小文字 + 空白正規化"""
    t = unicodedata.normalize('NFKC', text).strip().lower()
    return re.sub(r'\s+', ' ', t)


def _remove_punctuation(text: str) -> str:
    return re.sub(
        r'[、。，．,!！?？;；:：\'\"\'\'""（）()\[\]【】『』「」\-\s]',
        '', text,
    )


def _levenshtein(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return _levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            cost = 0 if c1 == c2 else 1
            curr.append(min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost))
        prev = curr
    return prev[-1]


def _levenshtein_similarity(s1: str, s2: str) -> float:
    longer = max(len(s1), len(s2))
    if longer == 0:
        return 1.0
    return (longer - _levenshtein(s1, s2)) / longer


def _token_overlap(a: str, b: str) -> float:
    """トークン（単語 or 文字 n-gram）の重複率"""
    ta = set(a.split()) if ' ' in a else set(_char_ngrams(a, 2))
    tb = set(b.split()) if ' ' in b else set(_char_ngrams(b, 2))
    if not ta or not tb:
        return 0.0
    inter = ta & tb
    return len(inter) / max(len(ta), len(tb))


def _char_ngrams(text: str, n: int = 2) -> list[str]:
    """文字 n-gram を生成"""
    return [text[i:i + n] for i in range(max(0, len(text) - n + 1))]


def text_similarity(a: str, b: str) -> float:
    """
    独自テキスト類似度（0.0–1.0）。
    レーベンシュタイン類似度とトークン重複率の加重平均。
    """
    na = _remove_punctuation(_normalize(a))
    nb = _remove_punctuation(_normalize(b))
    if not na or not nb:
        return 0.0
    lev_sim = _levenshtein_similarity(na, nb)
    tok_sim = _token_overlap(na, nb)
    return 0.6 * lev_sim + 0.4 * tok_sim


# --- ルーブリック・誤概念の型 ---

@dataclass
class RubricItem:
    """ルーブリック1項目"""
    id: str
    text: str
    weight: float = 1.0


@dataclass
class MisconceptionItem:
    """誤概念の定義（代表フレーズのリストで照合）"""
    id: str
    label: str
    example_phrases: list[str]


@dataclass
class RubricScoreDetail:
    """ルーブリック1項目ごとのスコア"""
    rubric_id: str
    similarity: float
    partial_score: float
    weight: float


@dataclass
class MisconceptionMatch:
    """誤概念マッチ結果"""
    misconception_id: str
    label: str
    similarity: float


@dataclass
class EmbeddingGradingResult:
    """採点の結果"""
    total_raw: float
    max_raw: float
    normalized_score: float  # 0–100
    details: list[RubricScoreDetail] = field(default_factory=list)
    misconceptions: list[MisconceptionMatch] = field(default_factory=list)
    feedback_summary: str = ""


DEFAULT_FULL_MATCH_THRESHOLD = 0.78
DEFAULT_PARTIAL_MATCH_THRESHOLD = 0.58


def _partial_score(sim: float, full_thresh: float, partial_thresh: float) -> float:
    if sim >= full_thresh:
        return 1.0
    if sim >= partial_thresh:
        return 0.5
    return 0.0


def score_with_rubric(
    answer: str,
    rubrics: list[RubricItem],
    full_threshold: float = DEFAULT_FULL_MATCH_THRESHOLD,
    partial_threshold: float = DEFAULT_PARTIAL_MATCH_THRESHOLD,
    **_kwargs,
) -> EmbeddingGradingResult:
    """
    ルーブリックに基づき記述式回答を採点。
    独自テキスト類似度を使用。
    """
    max_raw = sum(r.weight for r in rubrics)
    if not answer or not rubrics:
        return EmbeddingGradingResult(
            total_raw=0.0, max_raw=max_raw, normalized_score=0.0,
            details=[], feedback_summary="回答が空です。",
        )

    details: list[RubricScoreDetail] = []
    total_raw = 0.0

    for r in rubrics:
        sim = text_similarity(answer, r.text)
        partial = _partial_score(sim, full_threshold, partial_threshold)
        weighted = partial * r.weight
        total_raw += weighted
        details.append(RubricScoreDetail(
            rubric_id=r.id,
            similarity=round(sim, 4),
            partial_score=partial,
            weight=r.weight,
        ))

    normalized = (total_raw / max_raw * 100.0) if max_raw > 0 else 0.0
    feedback = _build_rubric_feedback(details, rubrics)

    return EmbeddingGradingResult(
        total_raw=round(total_raw, 2),
        max_raw=max_raw,
        normalized_score=round(normalized, 1),
        details=details,
        feedback_summary=feedback,
    )


def _build_rubric_feedback(
    details: list[RubricScoreDetail],
    rubrics: list[RubricItem],
) -> str:
    achieved = [d for d in details if d.partial_score >= 0.5]
    missing = [d for d in details if d.partial_score < 0.5]
    if not missing:
        return "すべての観点で十分に述べられています。"
    if not achieved:
        return "いずれの観点も十分に書けていません。キーワードや説明を足してみてください。"
    return f"{len(achieved)}/{len(details)} の観点で触れられています。不足している観点を補いましょう。"


def classify_misconceptions(
    answer: str,
    misconceptions: list[MisconceptionItem],
    min_similarity: float = 0.65,
    top_k: int = 3,
    **_kwargs,
) -> list[MisconceptionMatch]:
    """回答がどの誤概念に近いかをテキスト類似度で分類。"""
    if not answer or not misconceptions:
        return []

    matches: list[tuple[str, str, float]] = []
    for mc in misconceptions:
        if not mc.example_phrases:
            continue
        sims = [text_similarity(answer, phrase) for phrase in mc.example_phrases]
        best = max(sims) if sims else 0.0
        if best >= min_similarity:
            matches.append((mc.id, mc.label, best))

    matches.sort(key=lambda x: -x[2])
    return [
        MisconceptionMatch(misconception_id=m[0], label=m[1], similarity=round(m[2], 4))
        for m in matches[:top_k]
    ]


def evaluate_with_rubric_and_misconceptions(
    answer: str,
    rubrics: list[RubricItem],
    misconceptions: Optional[list[MisconceptionItem]] = None,
    full_threshold: float = DEFAULT_FULL_MATCH_THRESHOLD,
    partial_threshold: float = DEFAULT_PARTIAL_MATCH_THRESHOLD,
    misconception_min_sim: float = 0.65,
    **_kwargs,
) -> EmbeddingGradingResult:
    """ルーブリック採点 + 誤概念分類をまとめて実行。"""
    result = score_with_rubric(
        answer=answer,
        rubrics=rubrics,
        full_threshold=full_threshold,
        partial_threshold=partial_threshold,
    )

    if misconceptions:
        result.misconceptions = classify_misconceptions(
            answer=answer,
            misconceptions=misconceptions,
            min_similarity=misconception_min_sim,
        )
        if result.misconceptions and result.feedback_summary:
            result.feedback_summary += " また、回答内容から考えられる誤解: " + ", ".join(
                m.label for m in result.misconceptions[:2]
            ) + "。"

    return result


def to_legacy_evaluation_format(
    result: EmbeddingGradingResult,
    pass_threshold: float = 60.0,
) -> dict:
    """既存 API 互換の dict に変換。"""
    is_correct = result.normalized_score >= pass_threshold
    return {
        "is_correct": is_correct,
        "confidence": result.normalized_score / 100.0,
        "feedback": result.feedback_summary,
        "exact_match": False,
        "embedding_grading": {
            "normalized_score": result.normalized_score,
            "total_raw": result.total_raw,
            "max_raw": result.max_raw,
            "details": [
                {
                    "rubric_id": d.rubric_id,
                    "similarity": d.similarity,
                    "partial_score": d.partial_score,
                    "weight": d.weight,
                }
                for d in result.details
            ],
            "misconceptions": [
                {"id": m.misconception_id, "label": m.label, "similarity": m.similarity}
                for m in result.misconceptions
            ],
        },
    }
