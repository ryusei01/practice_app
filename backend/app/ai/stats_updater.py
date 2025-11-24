"""
統計データの更新
回答が記録されるたびに統計情報を更新
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from ..models import Answer, UserQuestionStats, UserCategoryStats, Question
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class StatsUpdater:
    """統計データ更新エンジン"""

    def __init__(self, db: Session):
        self.db = db

    def update_on_answer(
        self,
        user_id: str,
        question_id: str,
        is_correct: bool,
        answer_time_sec: float
    ):
        """
        回答時に統計を更新

        Args:
            user_id: ユーザーID
            question_id: 問題ID
            is_correct: 正解かどうか
            answer_time_sec: 回答時間
        """
        # 問題情報を取得
        question = self.db.query(Question).filter(
            Question.id == question_id
        ).first()

        if not question:
            logger.error(f"Question {question_id} not found")
            return

        # 1. 問題別統計を更新
        self._update_question_stats(user_id, question_id, is_correct, answer_time_sec)

        # 2. カテゴリ別統計を更新
        if question.category:
            self._update_category_stats(
                user_id,
                question.category,
                is_correct,
                answer_time_sec,
                question.difficulty
            )

        # 3. 問題の全体統計を更新（難易度調整用）
        self._update_global_question_stats(question_id, is_correct, answer_time_sec)

        self.db.commit()
        logger.info(f"Updated stats for user {user_id}, question {question_id}")

    def _update_question_stats(
        self,
        user_id: str,
        question_id: str,
        is_correct: bool,
        answer_time_sec: float
    ):
        """問題別統計を更新"""
        stat = self.db.query(UserQuestionStats).filter(
            and_(
                UserQuestionStats.user_id == user_id,
                UserQuestionStats.question_id == question_id
            )
        ).first()

        if stat is None:
            # 新規作成
            stat = UserQuestionStats(
                id=f"{user_id}_{question_id}",
                user_id=user_id,
                question_id=question_id,
                total_attempts=0,
                correct_count=0,
                average_time_sec=0.0,
                mastery_score=0.0
            )
            self.db.add(stat)

        # 統計を更新（NULL値を0として扱う）
        old_total = stat.total_attempts or 0
        old_correct = stat.correct_count or 0
        old_avg_time = stat.average_time_sec or 0.0

        stat.total_attempts = old_total + 1
        if is_correct:
            stat.correct_count = old_correct + 1

        # 平均時間を更新（移動平均）
        stat.average_time_sec = (
            (old_avg_time * old_total + answer_time_sec) / stat.total_attempts
        )

        # 最終回答日時を更新
        stat.last_attempt_at = datetime.utcnow()

        # 習熟度スコアを計算
        stat.mastery_score = self._calculate_mastery_score(
            stat.correct_count,
            stat.total_attempts,
            stat.average_time_sec
        )

        stat.updated_at = datetime.utcnow()

    def _update_category_stats(
        self,
        user_id: str,
        category: str,
        is_correct: bool,
        answer_time_sec: float,
        difficulty: float
    ):
        """カテゴリ別統計を更新"""
        stat = self.db.query(UserCategoryStats).filter(
            and_(
                UserCategoryStats.user_id == user_id,
                UserCategoryStats.category == category
            )
        ).first()

        if stat is None:
            # 新規作成
            stat = UserCategoryStats(
                id=f"{user_id}_{category}",
                user_id=user_id,
                category=category,
                total_questions=0,
                correct_count=0,
                average_time_sec=0.0,
                difficulty_mean=0.0,
                correct_rate=0.0,
                speed_score=0.0,
                weakness_score=0.0
            )
            self.db.add(stat)

        # 統計を更新（NULL値を0として扱う）
        old_total = stat.total_questions or 0
        old_correct = stat.correct_count or 0
        old_avg_time = stat.average_time_sec or 0.0
        old_difficulty = stat.difficulty_mean or 0.0

        stat.total_questions = old_total + 1
        if is_correct:
            stat.correct_count = old_correct + 1

        # 平均時間を更新
        stat.average_time_sec = (
            (old_avg_time * old_total + answer_time_sec) / stat.total_questions
        )

        # 平均難易度を更新
        stat.difficulty_mean = (
            (old_difficulty * old_total + difficulty) / stat.total_questions
        )

        # 正答率を計算
        stat.correct_rate = stat.correct_count / stat.total_questions

        # 速度スコアを計算（理想: 5-15秒）
        stat.speed_score = self._calculate_speed_score(stat.average_time_sec)

        # 苦手度スコアを計算
        stat.weakness_score = self._calculate_weakness_score(
            stat.correct_rate,
            stat.speed_score
        )

        stat.updated_at = datetime.utcnow()

    def _update_global_question_stats(
        self,
        question_id: str,
        is_correct: bool,
        answer_time_sec: float
    ):
        """問題の全体統計を更新（全ユーザーの統計）"""
        question = self.db.query(Question).filter(
            Question.id == question_id
        ).first()

        if not question:
            return

        # NULL値を0として扱う
        old_total = question.total_attempts or 0
        old_avg_time = question.average_time_sec or 0.0
        old_correct = question.correct_count or 0

        question.total_attempts = old_total + 1
        if is_correct:
            question.correct_count = old_correct + 1

        # 平均時間を更新
        question.average_time_sec = (
            (old_avg_time * old_total + answer_time_sec) / question.total_attempts
        )

        # 難易度を自動調整（正答率が高い = 簡単）
        if question.total_attempts >= 10:
            correct_rate = question.correct_count / question.total_attempts
            # 正答率に基づいて難易度を調整（逆相関）
            question.difficulty = 1 - correct_rate

        question.updated_at = datetime.utcnow()

    def _calculate_mastery_score(
        self,
        correct_count: int,
        total_attempts: int,
        avg_time: float
    ) -> float:
        """
        習熟度スコアを計算

        Args:
            correct_count: 正解数
            total_attempts: 総回答数
            avg_time: 平均回答時間

        Returns:
            習熟度スコア 0.0-1.0
        """
        if total_attempts == 0:
            return 0.0

        # 正答率
        correct_rate = correct_count / total_attempts

        # 速度スコア（速いほど高い、15秒を基準）
        speed_score = min(1.0, 15.0 / max(avg_time, 1.0))

        # 習熟度 = 正答率 70% + 速度 30%
        mastery = correct_rate * 0.7 + speed_score * 0.3

        return min(1.0, mastery)

    def _calculate_speed_score(self, avg_time: float) -> float:
        """
        速度スコアを計算

        Args:
            avg_time: 平均回答時間

        Returns:
            速度スコア 0.0-1.0
        """
        # 理想: 5-15秒 → スコア1.0
        # それより遅い → スコア低下
        ideal_min = 5.0
        ideal_max = 15.0

        if ideal_min <= avg_time <= ideal_max:
            return 1.0
        elif avg_time < ideal_min:
            # 速すぎる場合も少し減点
            return 0.8 + 0.2 * (avg_time / ideal_min)
        else:
            # 遅い場合は大きく減点
            return max(0.0, 1.0 - (avg_time - ideal_max) / 30.0)

    def _calculate_weakness_score(
        self,
        correct_rate: float,
        speed_score: float
    ) -> float:
        """
        苦手度スコアを計算

        Args:
            correct_rate: 正答率
            speed_score: 速度スコア

        Returns:
            苦手度スコア 0.0-1.0（高いほど苦手）
        """
        # 正答率が低い & 速度が遅い → 苦手度高い
        weakness = (1 - correct_rate) * 0.7 + (1 - speed_score) * 0.3
        return min(1.0, weakness)

    def recalculate_all_stats(self, user_id: str):
        """
        ユーザーの全統計を再計算

        データの整合性が崩れた時や、初期データ投入時に使用
        """
        logger.info(f"Recalculating all stats for user {user_id}")

        # 既存の統計を削除
        self.db.query(UserQuestionStats).filter(
            UserQuestionStats.user_id == user_id
        ).delete()

        self.db.query(UserCategoryStats).filter(
            UserCategoryStats.user_id == user_id
        ).delete()

        # 全回答を取得して再計算
        answers = self.db.query(Answer).filter(
            Answer.user_id == user_id
        ).order_by(Answer.answered_at).all()

        for answer in answers:
            self.update_on_answer(
                user_id=answer.user_id,
                question_id=answer.question_id,
                is_correct=answer.is_correct,
                answer_time_sec=answer.answer_time_sec
            )

        self.db.commit()
        logger.info(f"Recalculated {len(answers)} answers for user {user_id}")
