"""
記述式採点サービス（sentence-transformers 利用）

- 埋め込み類似度 + ルーブリックによる部分点採点
- 誤概念（ミスタイプ）の分類
- 同義語・言い換えは埋め込みで吸収
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Optional

# モデルは初回利用時に遅延ロード
_embedding_model: Any = None
_embedding_model_name: str = ""


def get_embedding_model(model_name: str = "paraphrase-multilingual-MiniLM-L12-v2"):
    """
    sentence-transformers のモデルをシングルトンで取得。
    日本語・英語両対応の軽量モデルをデフォルトに。
    """
    global _embedding_model, _embedding_model_name
    if _embedding_model is None or _embedding_model_name != model_name:
        try:
            from sentence_transformers import SentenceTransformer
            _embedding_model = SentenceTransformer(model_name)
            _embedding_model_name = model_name
        except ImportError:
            raise ImportError(
                "sentence-transformers が必要です: pip install sentence-transformers"
            )
    return _embedding_model


def embed_texts(model: Any, texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """テキストリストを埋め込みベクトルに変換。"""
    if not texts:
        return []
    vectors = model.encode(texts, batch_size=batch_size, show_progress_bar=False)
    return [v.tolist() for v in vectors]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """コサイン類似度 (0〜1 の範囲で返す)。"""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    sim = dot / (na * nb)
    return max(0.0, min(1.0, (sim + 1) / 2))  # [-1,1] -> [0,1]


# --- ルーブリック・誤概念の型 ---

@dataclass
class RubricItem:
    """ルーブリック1項目"""
    id: str
    text: str
    weight: float = 1.0


@dataclass
class MisconceptionItem:
    """誤概念の定義（代表フレーズのリストで埋め込み）"""
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
    """埋め込み採点の結果"""
    total_raw: float
    max_raw: float
    normalized_score: float  # 0〜100
    details: list[RubricScoreDetail] = field(default_factory=list)
    misconceptions: list[MisconceptionMatch] = field(default_factory=list)
    feedback_summary: str = ""


# --- 閾値（設定可能にしてもよい）---
DEFAULT_FULL_MATCH_THRESHOLD = 0.78
DEFAULT_PARTIAL_MATCH_THRESHOLD = 0.58


def _partial_score(similarity: float, full_thresh: float, partial_thresh: float) -> float:
    """類似度から部分点 (0 / 0.5 / 1.0) を付与。"""
    if similarity >= full_thresh:
        return 1.0
    if similarity >= partial_thresh:
        return 0.5
    return 0.0


def score_with_rubric(
    answer: str,
    rubrics: list[RubricItem],
    model_name: str = "paraphrase-multilingual-MiniLM-L12-v2",
    full_threshold: float = DEFAULT_FULL_MATCH_THRESHOLD,
    partial_threshold: float = DEFAULT_PARTIAL_MATCH_THRESHOLD,
) -> EmbeddingGradingResult:
    """
    ルーブリックに基づき記述式回答を採点。

    Args:
        answer: 受験者の回答
        rubrics: ルーブリック項目リスト
        model_name: 使用する sentence-transformers モデル名
        full_threshold: この類似度以上で満点 (1.0)
        partial_threshold: この類似度以上で半分 (0.5)

    Returns:
        EmbeddingGradingResult（総合点・項目別・正規化スコア）
    """
    if not answer or not rubrics:
        max_raw = sum(r.weight for r in rubrics)
        return EmbeddingGradingResult(
            total_raw=0.0,
            max_raw=max_raw,
            normalized_score=0.0,
            details=[],
            feedback_summary="回答が空です。",
        )

    model = get_embedding_model(model_name)
    rubric_texts = [r.text for r in rubrics]
    rubric_embs = embed_texts(model, rubric_texts)
    ans_emb = embed_texts(model, [answer])[0]

    details: list[RubricScoreDetail] = []
    total_raw = 0.0
    max_raw = 0.0

    for r, emb in zip(rubrics, rubric_embs):
        sim = cosine_similarity(ans_emb, emb)
        partial = _partial_score(sim, full_threshold, partial_threshold)
        weighted = partial * r.weight
        total_raw += weighted
        max_raw += r.weight
        details.append(
            RubricScoreDetail(
                rubric_id=r.id,
                similarity=round(sim, 4),
                partial_score=partial,
                weight=r.weight,
            )
        )

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
    """項目別の達成状況から短いフィードバック文を生成。"""
    by_id = {r.id: r for r in rubrics}
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
    model_name: str = "paraphrase-multilingual-MiniLM-L12-v2",
    min_similarity: float = 0.65,
    top_k: int = 3,
) -> list[MisconceptionMatch]:
    """
    回答がどの誤概念に近いかを類似度で分類。

    Args:
        answer: 受験者の回答
        misconceptions: 誤概念の定義リスト
        model_name: 使用するモデル名
        min_similarity: この値以上を「マッチ」とする
        top_k: 返すマッチ数の上限

    Returns:
        類似度の高い順の MisconceptionMatch リスト
    """
    if not answer or not misconceptions:
        return []

    model = get_embedding_model(model_name)
    ans_emb = embed_texts(model, [answer])[0]

    # 各誤概念の代表フレーズの平均ベクトル（または最大類似度）で比較
    matches: list[tuple[str, str, float]] = []

    for mc in misconceptions:
        if not mc.example_phrases:
            continue
        phrase_embs = embed_texts(model, mc.example_phrases)
        sims = [cosine_similarity(ans_emb, pe) for pe in phrase_embs]
        best_sim = max(sims) if sims else 0.0
        if best_sim >= min_similarity:
            matches.append((mc.id, mc.label, best_sim))

    matches.sort(key=lambda x: -x[2])
    return [
        MisconceptionMatch(misconception_id=m[0], label=m[1], similarity=round(m[2], 4))
        for m in matches[:top_k]
    ]


def evaluate_with_rubric_and_misconceptions(
    answer: str,
    rubrics: list[RubricItem],
    misconceptions: Optional[list[MisconceptionItem]] = None,
    model_name: str = "paraphrase-multilingual-MiniLM-L12-v2",
    full_threshold: float = DEFAULT_FULL_MATCH_THRESHOLD,
    partial_threshold: float = DEFAULT_PARTIAL_MATCH_THRESHOLD,
    misconception_min_sim: float = 0.65,
) -> EmbeddingGradingResult:
    """
    ルーブリック採点 + 誤概念分類をまとめて実行。
    """
    result = score_with_rubric(
        answer=answer,
        rubrics=rubrics,
        model_name=model_name,
        full_threshold=full_threshold,
        partial_threshold=partial_threshold,
    )

    if misconceptions:
        result.misconceptions = classify_misconceptions(
            answer=answer,
            misconceptions=misconceptions,
            model_name=model_name,
            min_similarity=misconception_min_sim,
        )
        if result.misconceptions and result.feedback_summary:
            result.feedback_summary += " また、回答内容から考えられる誤解: " + ", ".join(
                m.label for m in result.misconceptions[:2]
            ) + "。"

    return result


# --- 既存 API と合わせるための変換 ---

def to_legacy_evaluation_format(
    result: EmbeddingGradingResult,
    pass_threshold: float = 60.0,
) -> dict:
    """
    既存の evaluate_text_answer が返す形式に近い dict に変換。
    is_correct, confidence, feedback, および embedding 由来の詳細を付与。
    """
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
