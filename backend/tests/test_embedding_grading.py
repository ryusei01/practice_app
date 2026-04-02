"""
embedding_grading サービスのテスト

- ユニット: cosine_similarity, 空入力, to_legacy_evaluation_format など（モデル不要）
- 統合: score_with_rubric（sentence-transformers が入っている場合のみ実行）
"""
import sys
from pathlib import Path

# backend をパスに追加
backend = Path(__file__).resolve().parent.parent
if str(backend) not in sys.path:
    sys.path.insert(0, str(backend))

import pytest

from app.services.embedding_grading import (
    cosine_similarity,
    RubricItem,
    RubricScoreDetail,
    MisconceptionMatch,
    EmbeddingGradingResult,
    score_with_rubric,
    to_legacy_evaluation_format,
    DEFAULT_FULL_MATCH_THRESHOLD,
    DEFAULT_PARTIAL_MATCH_THRESHOLD,
)

# _partial_score はモジュール内でテストするためインポート
from app.services import embedding_grading as mod


# --- ユニットテスト（モデル不要） ---


class TestCosineSimilarity:
    def test_identical_vectors(self):
        v = [1.0, 0.0, 0.0]
        assert cosine_similarity(v, v) == 1.0

    def test_orthogonal(self):
        a = [1.0, 0.0, 0.0]
        b = [0.0, 1.0, 0.0]
        # コサインは0 → (0+1)/2 = 0.5
        assert 0.49 <= cosine_similarity(a, b) <= 0.51

    def test_opposite(self):
        a = [1.0, 0.0, 0.0]
        b = [-1.0, 0.0, 0.0]
        assert cosine_similarity(a, b) == 0.0

    def test_zero_vector(self):
        a = [0.0, 0.0, 0.0]
        b = [1.0, 0.0, 0.0]
        assert cosine_similarity(a, b) == 0.0

    def test_empty_list(self):
        assert cosine_similarity([], []) == 0.0


class TestPartialScore:
    def test_full_score(self):
        assert mod._partial_score(0.9, 0.78, 0.58) == 1.0
        assert mod._partial_score(0.78, 0.78, 0.58) == 1.0

    def test_half_score(self):
        assert mod._partial_score(0.7, 0.78, 0.58) == 0.5
        assert mod._partial_score(0.58, 0.78, 0.58) == 0.5

    def test_zero_score(self):
        assert mod._partial_score(0.5, 0.78, 0.58) == 0.0
        assert mod._partial_score(0.0, 0.78, 0.58) == 0.0


class TestScoreWithRubricEdgeCases:
    """モデルを読まないエッジケース（空入力で早期 return）"""

    def test_empty_answer(self):
        rubrics = [
            RubricItem(id="R1", text="何か観点", weight=1.0),
        ]
        result = score_with_rubric("", rubrics)
        assert result.total_raw == 0.0
        assert result.max_raw == 1.0
        assert result.normalized_score == 0.0
        assert "空" in result.feedback_summary or "回答" in result.feedback_summary

    def test_empty_rubrics(self):
        result = score_with_rubric("生徒の回答", [])
        assert result.total_raw == 0.0
        assert result.max_raw == 0.0
        assert result.normalized_score == 0.0
        assert result.details == []

    def test_whitespace_only_answer(self):
        # 実装では "  " は truthy なのでモデルまで行く可能性がある
        # 空でないが短い文字列で空扱いにするかは実装次第。ここでは空文字のみテスト
        result = score_with_rubric("", [RubricItem(id="R1", text="x", weight=1.0)])
        assert result.normalized_score == 0.0


class TestToLegacyEvaluationFormat:
    def test_pass_above_threshold(self):
        result = EmbeddingGradingResult(
            total_raw=2.0,
            max_raw=2.0,
            normalized_score=100.0,
            details=[],
            misconceptions=[],
            feedback_summary="OK",
        )
        legacy = to_legacy_evaluation_format(result, pass_threshold=60.0)
        assert legacy["is_correct"] is True
        assert legacy["confidence"] == 1.0
        assert legacy["feedback"] == "OK"
        assert legacy["embedding_grading"]["normalized_score"] == 100.0

    def test_fail_below_threshold(self):
        result = EmbeddingGradingResult(
            total_raw=0.5,
            max_raw=2.0,
            normalized_score=25.0,
            details=[],
            misconceptions=[],
            feedback_summary="不足",
        )
        legacy = to_legacy_evaluation_format(result, pass_threshold=60.0)
        assert legacy["is_correct"] is False
        assert legacy["confidence"] == 0.25

    def test_misconceptions_in_legacy(self):
        result = EmbeddingGradingResult(
            total_raw=1.0,
            max_raw=2.0,
            normalized_score=50.0,
            details=[],
            misconceptions=[
                MisconceptionMatch(misconception_id="M1", label="混同", similarity=0.7),
            ],
            feedback_summary="",
        )
        legacy = to_legacy_evaluation_format(result)
        assert len(legacy["embedding_grading"]["misconceptions"]) == 1
        assert legacy["embedding_grading"]["misconceptions"][0]["id"] == "M1"
        assert legacy["embedding_grading"]["misconceptions"][0]["label"] == "混同"


# --- 統合テスト（sentence-transformers が入っている場合のみ実行） ---


def test_score_with_rubric_integration():
    """実際にモデルをロードして採点。sentence-transformers 未導入時はスキップ。"""
    pytest.importorskip("sentence_transformers")

    rubrics = [
        RubricItem(
            id="R1",
            text="目的関数を最小化するための反復的な最適化手法である",
            weight=1.0,
        ),
        RubricItem(
            id="R2",
            text="勾配に基づいてパラメータを更新する",
            weight=1.0,
        ),
    ]
    # 正解に近い回答
    answer_ok = "損失を減らすために、勾配の逆方向にパラメータを少しずつ更新する方法です。"
    result = score_with_rubric(answer_ok, rubrics)
    assert result.max_raw == 2.0
    assert len(result.details) == 2
    assert 0 <= result.normalized_score <= 100
    assert result.normalized_score >= 50, "模範に近い回答はある程度の得点になる"

    # 無関係な回答は低い得点
    result_low = score_with_rubric("わかりません", rubrics)
    assert result_low.normalized_score < result.normalized_score
