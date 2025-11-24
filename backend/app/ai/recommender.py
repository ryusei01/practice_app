"""
AI問題推薦システム
ユーザーの回答履歴から最適な問題を選定
"""
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, Integer
import numpy as np
from ..models import Answer, Question, UserCategoryStats, UserQuestionStats
import logging

logger = logging.getLogger(__name__)


class QuestionRecommender:
    """問題推薦エンジン"""

    def __init__(self, db: Session):
        self.db = db

    def recommend_questions(
        self,
        user_id: str,
        question_set_id: str,
        count: int = 10,
        target_difficulty: Optional[float] = None
    ) -> List[str]:
        """
        ユーザーに最適な問題を推薦

        Args:
            user_id: ユーザーID
            question_set_id: 問題集ID
            count: 推薦する問題数
            target_difficulty: 目標難易度（None = 自動調整）

        Returns:
            推薦問題のIDリスト
        """
        # 1. ユーザーの苦手カテゴリを取得
        weak_categories = self._get_weak_categories(user_id)

        # 2. 問題集内の全問題を取得
        questions = self.db.query(Question).filter(
            Question.question_set_id == question_set_id
        ).all()

        if not questions:
            return []

        # 3. 各問題にスコアを付与
        scored_questions = []
        for question in questions:
            score = self._calculate_recommendation_score(
                user_id,
                question,
                weak_categories,
                target_difficulty
            )
            scored_questions.append((question.id, score))

        # 4. スコアでソートして上位を返す
        scored_questions.sort(key=lambda x: x[1], reverse=True)
        recommended_ids = [q[0] for q in scored_questions[:count]]

        logger.info(f"Recommended {len(recommended_ids)} questions for user {user_id}")
        return recommended_ids

    def _get_weak_categories(self, user_id: str, threshold: float = 0.6) -> List[str]:
        """
        ユーザーの苦手カテゴリを取得

        Args:
            user_id: ユーザーID
            threshold: 苦手判定の閾値（正答率がこれ以下なら苦手）

        Returns:
            苦手カテゴリのリスト
        """
        stats = self.db.query(UserCategoryStats).filter(
            and_(
                UserCategoryStats.user_id == user_id,
                UserCategoryStats.correct_rate < threshold
            )
        ).order_by(UserCategoryStats.weakness_score.desc()).all()

        return [stat.category for stat in stats]

    def _calculate_recommendation_score(
        self,
        user_id: str,
        question: Question,
        weak_categories: List[str],
        target_difficulty: Optional[float] = None
    ) -> float:
        """
        問題の推薦スコアを計算

        スコアが高いほど推薦される

        考慮要素:
        - 苦手カテゴリか（重み: 0.3）
        - 難易度が適切か（重み: 0.4）
        - まだ解いていないか（重み: 0.2）
        - 最近間違えた問題か（重み: 0.1）
        """
        score = 0.0

        # 1. 苦手カテゴリの問題を優先（0-0.3）
        if question.category in weak_categories:
            weak_rank = weak_categories.index(question.category)
            score += 0.3 * (1 - weak_rank / max(len(weak_categories), 1))

        # 2. 難易度スコア（0-0.4）
        # 目標難易度が指定されていない場合、ユーザーの正答率から推定
        if target_difficulty is None:
            user_stats = self._get_user_overall_stats(user_id)
            # 正答率50-70%を狙う難易度
            target_difficulty = 1 - user_stats.get("correct_rate", 0.5) + 0.1

        # 難易度が近いほど高スコア
        difficulty_diff = abs(question.difficulty - target_difficulty)
        score += 0.4 * (1 - difficulty_diff)

        # 3. 未回答の問題を優先（0-0.2）
        question_stat = self.db.query(UserQuestionStats).filter(
            and_(
                UserQuestionStats.user_id == user_id,
                UserQuestionStats.question_id == question.id
            )
        ).first()

        if question_stat is None:
            # 未回答なら高スコア
            score += 0.2
        elif question_stat.mastery_score < 0.5:
            # 習熟度が低い問題も優先
            score += 0.2 * (1 - question_stat.mastery_score)

        # 4. 復習が必要な問題（0-0.1）
        if question_stat and question_stat.correct_count < question_stat.total_attempts:
            # 間違えた経験がある
            error_rate = 1 - (question_stat.correct_count / question_stat.total_attempts)
            score += 0.1 * error_rate

        return score

    def _get_user_overall_stats(self, user_id: str) -> Dict[str, float]:
        """ユーザーの全体統計を取得"""
        result = self.db.query(
            func.count(Answer.id).label("total"),
            func.sum(func.cast(Answer.is_correct, Integer)).label("correct"),
            func.avg(Answer.answer_time_sec).label("avg_time")
        ).filter(Answer.user_id == user_id).first()

        if result.total == 0:
            return {
                "total_attempts": 0,
                "correct_rate": 0.5,
                "avg_time": 0.0
            }

        return {
            "total_attempts": result.total,
            "correct_rate": result.correct / result.total if result.total > 0 else 0.5,
            "avg_time": result.avg_time or 0.0
        }

    def get_next_adaptive_difficulty(self, user_id: str, category: str) -> float:
        """
        次の問題の適切な難易度を算出（適応型学習）

        Args:
            user_id: ユーザーID
            category: カテゴリ

        Returns:
            推奨難易度（0.0-1.0）
        """
        category_stat = self.db.query(UserCategoryStats).filter(
            and_(
                UserCategoryStats.user_id == user_id,
                UserCategoryStats.category == category
            )
        ).first()

        if not category_stat:
            # データがない場合は中程度の難易度
            return 0.5

        # 正答率に基づいて難易度を調整
        # 正答率が高い → より難しい問題
        # 正答率が低い → より簡単な問題
        correct_rate = category_stat.correct_rate

        if correct_rate > 0.8:
            # 高得点 → 難易度を上げる
            return min(0.9, category_stat.difficulty_mean + 0.1)
        elif correct_rate < 0.5:
            # 低得点 → 難易度を下げる
            return max(0.3, category_stat.difficulty_mean - 0.1)
        else:
            # 適切な範囲 → 現在の難易度を維持
            return category_stat.difficulty_mean
