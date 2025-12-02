"""
AI予想スコア算出システム
ユーザーの回答履歴から今受験したら取れそうなスコアを予測
"""
from typing import Dict, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, Integer
from datetime import datetime, timedelta
import numpy as np
from ..models import Answer, UserCategoryStats, Question
import logging

logger = logging.getLogger(__name__)


class ScorePredictor:
    """スコア予測エンジン"""

    def __init__(self, db: Session):
        self.db = db

    def predict_score(
        self,
        user_id: str,
        question_set_id: Optional[str] = None,
        max_score: int = 100
    ) -> Dict[str, any]:
        """
        予想スコアを算出

        Args:
            user_id: ユーザーID
            question_set_id: 問題集ID（Noneの場合は全体）
            max_score: 満点スコア

        Returns:
            予想スコアと関連情報
        """
        # 1. ユーザーの基本統計を取得
        user_stats = self._get_user_stats(user_id, question_set_id)

        if user_stats["total_attempts"] == 0:
            # データがない場合
            return {
                "predicted_score": max_score * 0.5,  # 50点と予想
                "confidence": 0.0,  # 信頼度0
                "details": {
                    "reason": "insufficient_data",
                    "message": "回答データが不足しています"
                }
            }

        # 2. 基本スコアを計算（正答率ベース）
        base_score = user_stats["correct_rate"] * max_score

        # 3. 回答速度による補正
        speed_adjustment = self._calculate_speed_adjustment(user_stats)

        # 4. 最近のトレンドによる補正
        trend_adjustment = self._calculate_trend_adjustment(user_id, question_set_id)

        # 5. 難易度による補正
        difficulty_adjustment = self._calculate_difficulty_adjustment(user_stats)

        # 6. 最終スコアを計算
        predicted_score = base_score + speed_adjustment + trend_adjustment + difficulty_adjustment
        predicted_score = max(0, min(max_score, predicted_score))  # 0-max_scoreに制限

        # 7. 信頼度を計算（データ量が多いほど高い）
        confidence = self._calculate_confidence(user_stats["total_attempts"])

        return {
            "predicted_score": round(predicted_score, 1),
            "confidence": round(confidence, 2),
            "base_score": round(base_score, 1),
            "adjustments": {
                "speed": round(speed_adjustment, 1),
                "trend": round(trend_adjustment, 1),
                "difficulty": round(difficulty_adjustment, 1)
            },
            "stats": {
                "correct_rate": round(user_stats["correct_rate"], 3),
                "total_attempts": user_stats["total_attempts"],
                "avg_time_sec": round(user_stats["avg_time"], 1)
            }
        }

    def _get_user_stats(
        self,
        user_id: str,
        question_set_id: Optional[str] = None
    ) -> Dict[str, any]:
        """ユーザーの統計情報を取得"""
        query = self.db.query(
            func.count(Answer.id).label("total"),
            func.sum(func.cast(Answer.is_correct, Integer)).label("correct"),
            func.avg(Answer.answer_time_sec).label("avg_time")
        ).filter(Answer.user_id == user_id)

        # 特定の問題集に絞る場合
        if question_set_id:
            query = query.join(Question).filter(
                Question.question_set_id == question_set_id
            )

        result = query.first()

        if result.total == 0 or result.correct is None:
            return {
                "total_attempts": 0,
                "correct_rate": 0.0,
                "avg_time": 0.0
            }

        return {
            "total_attempts": result.total,
            "correct_rate": result.correct / result.total,
            "avg_time": result.avg_time or 0.0
        }

    def _calculate_speed_adjustment(self, stats: Dict[str, any]) -> float:
        """
        回答速度による補正

        速すぎる = 適当に答えている可能性 → マイナス補正
        遅すぎる = 理解不足 → マイナス補正
        適切な速度 = プラス補正
        """
        avg_time = stats["avg_time"]

        # 理想的な回答時間: 5-15秒
        ideal_min = 5.0
        ideal_max = 15.0

        if ideal_min <= avg_time <= ideal_max:
            # 理想的な範囲 → プラス補正
            return 2.0
        elif avg_time < ideal_min:
            # 速すぎる → マイナス補正
            return -3.0 * (ideal_min - avg_time) / ideal_min
        else:
            # 遅すぎる → マイナス補正
            penalty = min(5.0, (avg_time - ideal_max) / 10)
            return -penalty

    def _calculate_trend_adjustment(
        self,
        user_id: str,
        question_set_id: Optional[str] = None
    ) -> float:
        """
        最近のトレンドによる補正

        最近10問の正答率と全体の正答率を比較
        """
        # 最近10問の正答率を取得
        recent_query = self.db.query(
            func.count(Answer.id).label("total"),
            func.sum(func.cast(Answer.is_correct, func.Integer())).label("correct")
        ).filter(Answer.user_id == user_id)

        if question_set_id:
            recent_query = recent_query.join(Question).filter(
                Question.question_set_id == question_set_id
            )

        recent_answers = recent_query.order_by(
            Answer.answered_at.desc()
        ).limit(10).first()

        if not recent_answers or recent_answers.total < 5:
            # データ不足
            return 0.0

        recent_rate = recent_answers.correct / recent_answers.total

        # 全体の正答率
        overall_stats = self._get_user_stats(user_id, question_set_id)
        overall_rate = overall_stats["correct_rate"]

        # トレンド補正
        trend_diff = recent_rate - overall_rate

        # 上昇トレンド → プラス補正
        # 下降トレンド → マイナス補正
        return trend_diff * 10  # 最大±10点

    def _calculate_difficulty_adjustment(self, stats: Dict[str, any]) -> float:
        """
        難易度による補正

        簡単な問題ばかり解いている場合はマイナス補正
        難しい問題を解いている場合はプラス補正
        """
        # 今回は基本実装のため、難易度補正は小さめに
        # 実際のデータから平均難易度を取得して補正するのが理想
        return 0.0

    def _calculate_confidence(self, total_attempts: int) -> float:
        """
        予測の信頼度を計算

        Args:
            total_attempts: 回答数

        Returns:
            信頼度 0.0-1.0
        """
        # シグモイド関数で信頼度を計算
        # 50問で約0.86、100問で約0.95
        return 1 / (1 + np.exp(-0.05 * (total_attempts - 50)))

    def get_category_predictions(
        self,
        user_id: str,
        max_score: int = 100
    ) -> Dict[str, Dict[str, any]]:
        """
        カテゴリ別の予想スコアを取得

        Args:
            user_id: ユーザーID
            max_score: 満点スコア

        Returns:
            カテゴリ名 -> 予想スコア情報
        """
        category_stats = self.db.query(UserCategoryStats).filter(
            UserCategoryStats.user_id == user_id
        ).all()

        results = {}
        for stat in category_stats:
            if stat.total_questions == 0:
                continue

            predicted_score = stat.correct_rate * max_score
            confidence = self._calculate_confidence(stat.total_questions)

            results[stat.category] = {
                "predicted_score": round(predicted_score, 1),
                "confidence": round(confidence, 2),
                "correct_rate": round(stat.correct_rate, 3),
                "total_questions": stat.total_questions,
                "weakness_score": round(stat.weakness_score, 3)
            }

        return results

    def get_improvement_suggestions(self, user_id: str) -> List[Dict[str, any]]:
        """
        改善提案を取得

        Args:
            user_id: ユーザーID

        Returns:
            改善提案のリスト
        """
        suggestions = []

        # カテゴリ別統計を取得
        category_stats = self.db.query(UserCategoryStats).filter(
            UserCategoryStats.user_id == user_id
        ).filter(
            UserCategoryStats.weakness_score.is_not(None)
        ).order_by(UserCategoryStats.weakness_score.desc()).all()

        for stat in category_stats[:3]:  # 上位3つの苦手分野
            if stat.weakness_score is not None and stat.weakness_score > 0.3:  # 苦手判定
                suggestions.append({
                    "type": "weak_category",
                    "category": stat.category,
                    "message": f"{stat.category}の正答率が{stat.correct_rate*100:.1f}%です。集中的に学習しましょう。",
                    "priority": "high" if stat.weakness_score > 0.5 else "medium"
                })

        # 回答速度のチェック
        overall_stats = self._get_user_stats(user_id)
        if overall_stats["total_attempts"] > 0 and overall_stats["avg_time"] > 20:
            suggestions.append({
                "type": "speed",
                "message": "回答に時間がかかっています。基礎知識の定着を意識しましょう。",
                "priority": "medium"
            })

        return suggestions
