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
        # コールドスタート判定（回答数30問以下）
        if self._is_cold_start(user_id, question_set_id):
            logger.info(f"Cold start mode for user {user_id}")
            return self._recommend_for_cold_start(
                user_id=user_id,
                question_set_id=question_set_id,
                count=count
            )

        # 通常の推薦システム
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

    def _is_cold_start(self, user_id: str, question_set_id: str, threshold: int = 30) -> bool:
        """
        コールドスタート（新規ユーザー）かどうかを判定

        Args:
            user_id: ユーザーID
            question_set_id: 問題集ID
            threshold: コールドスタート判定の閾値（回答数）

        Returns:
            True: コールドスタート、False: 通常ユーザー
        """
        # 同じ問題セットでの回答数をカウント
        answer_count = self.db.query(Answer).join(Question).filter(
            and_(
                Answer.user_id == user_id,
                Question.question_set_id == question_set_id
            )
        ).count()

        return answer_count <= threshold

    def _find_similar_users(
        self,
        user_id: str,
        question_set_id: str,
        top_k: int = 10
    ) -> List[tuple[str, float]]:
        """
        類似ユーザーを検索（同じ問題セットを解いたユーザーから）

        Args:
            user_id: ユーザーID
            question_set_id: 問題集ID
            top_k: 上位k人の類似ユーザーを返す

        Returns:
            [(user_id, similarity_score), ...] のリスト（類似度の高い順）
        """
        # 1. 現在のユーザーのカテゴリ別スコアを取得
        user_category_stats = self.db.query(UserCategoryStats).filter(
            UserCategoryStats.user_id == user_id
        ).all()

        if not user_category_stats:
            return []

        # ユーザーのカテゴリ別正答率ベクトルを作成
        user_categories = {stat.category: stat.correct_rate for stat in user_category_stats}
        user_vector = np.array([user_categories.get(cat, 0.5) for cat in sorted(user_categories.keys())])

        # 2. 同じ問題セットを解いた他のユーザーを取得
        other_users = self.db.query(Answer.user_id).join(Question).filter(
            and_(
                Answer.user_id != user_id,
                Question.question_set_id == question_set_id
            )
        ).distinct().all()

        if not other_users:
            return []

        # 3. 各ユーザーとの類似度を計算
        similar_users = []
        for (other_user_id,) in other_users:
            # 他のユーザーのカテゴリ別スコアを取得
            other_category_stats = self.db.query(UserCategoryStats).filter(
                UserCategoryStats.user_id == other_user_id
            ).all()

            if not other_category_stats:
                continue

            # 同じカテゴリで比較
            other_categories = {stat.category: stat.correct_rate for stat in other_category_stats}
            
            # 共通カテゴリのみで比較
            common_categories = set(user_categories.keys()) & set(other_categories.keys())
            if len(common_categories) < 2:  # 最低2カテゴリ以上で比較
                continue

            # ベクトルを作成（共通カテゴリのみ）
            common_cats_sorted = sorted(common_categories)
            user_vec = np.array([user_categories[cat] for cat in common_cats_sorted])
            other_vec = np.array([other_categories[cat] for cat in common_cats_sorted])

            # コサイン類似度を計算（無料のnumpyのみ使用）
            similarity = self._cosine_similarity(user_vec, other_vec)
            similar_users.append((other_user_id, similarity))

        # 4. 類似度でソートして上位k人を返す
        similar_users.sort(key=lambda x: x[1], reverse=True)
        return similar_users[:top_k]

    def _cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """
        コサイン類似度を計算（無料のnumpyのみ使用）

        Args:
            vec1: ベクトル1
            vec2: ベクトル2

        Returns:
            コサイン類似度（0.0-1.0）
        """
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)

    def _recommend_for_cold_start(
        self,
        user_id: str,
        question_set_id: str,
        count: int = 10
    ) -> List[str]:
        """
        コールドスタート（新規ユーザー）向けの問題推薦

        類似ユーザーが間違えた問題を優先的に推薦

        Args:
            user_id: ユーザーID
            question_set_id: 問題集ID
            count: 推薦する問題数

        Returns:
            推薦問題のIDリスト
        """
        # 1. 類似ユーザーを検索
        similar_users = self._find_similar_users(user_id, question_set_id, top_k=10)

        # 2. 問題集内の全問題を取得
        questions = self.db.query(Question).filter(
            Question.question_set_id == question_set_id
        ).all()

        if not questions:
            return []

        # 3. 類似ユーザーが間違えた問題を集計
        question_scores = {}  # {question_id: score}

        if similar_users:
            # 類似ユーザーが間違えた問題にスコアを付与
            for similar_user_id, similarity in similar_users:
                # このユーザーが間違えた問題を取得
                wrong_answers = self.db.query(Answer).join(Question).filter(
                    and_(
                        Answer.user_id == similar_user_id,
                        Answer.is_correct == False,
                        Question.question_set_id == question_set_id
                    )
                ).all()

                for answer in wrong_answers:
                    question_id = answer.question_id
                    if question_id not in question_scores:
                        question_scores[question_id] = 0.0
                    # 類似度に応じてスコアを加算
                    question_scores[question_id] += similarity

            # 現在のユーザーが既に解いた問題は除外
            answered_question_ids = set(
                self.db.query(Answer.question_id).join(Question).filter(
                    and_(
                        Answer.user_id == user_id,
                        Question.question_set_id == question_set_id
                    )
                ).distinct().all()
            )
            answered_question_ids = {qid for (qid,) in answered_question_ids}

            # スコアでソート
            scored_questions = [
                (qid, score) for qid, score in question_scores.items()
                if qid not in answered_question_ids
            ]
            scored_questions.sort(key=lambda x: x[1], reverse=True)
            recommended_ids = [qid for qid, _ in scored_questions[:count]]

            if len(recommended_ids) >= count:
                logger.info(f"Recommended {len(recommended_ids)} questions from similar users for cold start user {user_id}")
                return recommended_ids

        # 4. フォールバック: 中程度の難易度（0.4-0.6）の問題を推薦
        logger.info(f"Using fallback recommendation for cold start user {user_id}")
        return self._recommend_by_difficulty_fallback(
            question_set_id=question_set_id,
            user_id=user_id,
            count=count,
            min_difficulty=0.4,
            max_difficulty=0.6
        )

    def _recommend_by_difficulty_fallback(
        self,
        question_set_id: str,
        user_id: str,
        count: int,
        min_difficulty: float = 0.4,
        max_difficulty: float = 0.6
    ) -> List[str]:
        """
        難易度に基づくフォールバック推薦（中程度の難易度）

        Args:
            question_set_id: 問題集ID
            user_id: ユーザーID
            count: 推薦する問題数
            min_difficulty: 最小難易度
            max_difficulty: 最大難易度

        Returns:
            推薦問題のIDリスト
        """
        # 中程度の難易度の問題を取得
        questions = self.db.query(Question).filter(
            and_(
                Question.question_set_id == question_set_id,
                Question.difficulty >= min_difficulty,
                Question.difficulty <= max_difficulty
            )
        ).all()

        if not questions:
            # 該当する問題がない場合は、難易度範囲を広げる
            questions = self.db.query(Question).filter(
                Question.question_set_id == question_set_id
            ).all()

        # 既に解いた問題を除外
        answered_question_ids = set(
            self.db.query(Answer.question_id).join(Question).filter(
                and_(
                    Answer.user_id == user_id,
                    Question.question_set_id == question_set_id
                )
            ).distinct().all()
        )
        answered_question_ids = {qid for (qid,) in answered_question_ids}

        # 未回答の問題を優先
        unanswered_questions = [q for q in questions if q.id not in answered_question_ids]
        answered_questions = [q for q in questions if q.id in answered_question_ids]

        # 未回答の問題を優先的に推薦
        recommended = []
        for q in unanswered_questions[:count]:
            recommended.append(q.id)

        # まだ足りない場合は、既に解いた問題から追加
        if len(recommended) < count:
            for q in answered_questions[:count - len(recommended)]:
                recommended.append(q.id)

        return recommended[:count]
