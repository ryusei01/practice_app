"""
embedding_grading サービスのテスト

- ユニット: text_similarity, _partial_score, 空入力, to_legacy_evaluation_format など
- 統合: score_with_rubric（独自テキスト類似度ベース、外部ライブラリ不要）
"""
import sys
from pathlib import Path

backend = Path(__file__).resolve().parent.parent
if str(backend) not in sys.path:
    sys.path.insert(0, str(backend))

import pytest

from app.services.embedding_grading import (
    text_similarity,
    RubricItem,
    RubricScoreDetail,
    MisconceptionMatch,
    EmbeddingGradingResult,
    score_with_rubric,
    to_legacy_evaluation_format,
    DEFAULT_FULL_MATCH_THRESHOLD,
    DEFAULT_PARTIAL_MATCH_THRESHOLD,
)

from app.services import embedding_grading as mod


class TestTextSimilarity:
    def test_identical(self):
        assert text_similarity("hello world", "hello world") == 1.0

    def test_completely_different(self):
        sim = text_similarity("abc", "xyz")
        assert sim < 0.3

    def test_similar_strings(self):
        sim = text_similarity("勾配降下法", "勾配降下")
        assert sim > 0.5

    def test_empty(self):
        assert text_similarity("", "hello") == 0.0
        assert text_similarity("hello", "") == 0.0
        assert text_similarity("", "") == 0.0


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


def test_score_with_rubric_integration():
    """独自テキスト類似度でルーブリック採点。外部ライブラリ不要。"""
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
    answer_ok = "損失を減らすために、勾配の逆方向にパラメータを少しずつ更新する方法です。"
    result = score_with_rubric(answer_ok, rubrics)
    assert result.max_raw == 2.0
    assert len(result.details) == 2
    assert 0 <= result.normalized_score <= 100

    result_low = score_with_rubric("わかりません", rubrics)
    assert result_low.normalized_score <= result.normalized_score
