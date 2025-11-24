from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from ..core.database import Base


class Answer(Base):
    """ユーザーの回答履歴（AI学習の基礎データ）"""
    __tablename__ = "answers"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    question_id = Column(String, ForeignKey("questions.id"), nullable=False, index=True)

    # 回答データ
    user_answer = Column(String, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    answer_time_sec = Column(Float, nullable=False)  # 回答にかかった秒数

    # 学習メタデータ
    try_count = Column(Integer, default=1)  # 何回目の挑戦か
    session_id = Column(String, index=True)  # 学習セッションID（連続した学習の単位）

    answered_at = Column(DateTime, default=datetime.utcnow, index=True)

    # リレーション
    user = relationship("User", back_populates="answers")
    question = relationship("Question", back_populates="answers")


class UserQuestionStats(Base):
    """ユーザーごと・問題ごとの統計（AI推薦用）"""
    __tablename__ = "user_question_stats"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    question_id = Column(String, ForeignKey("questions.id"), nullable=False, index=True)

    # 統計データ
    total_attempts = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    average_time_sec = Column(Float, default=0.0)
    last_attempt_at = Column(DateTime)
    mastery_score = Column(Float, default=0.0)  # 0.0 - 1.0 の習熟度スコア

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserCategoryStats(Base):
    """ユーザーごと・カテゴリごとの統計"""
    __tablename__ = "user_category_stats"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String, nullable=False, index=True)

    # 統計データ
    total_questions = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    average_time_sec = Column(Float, default=0.0)
    difficulty_mean = Column(Float, default=0.5)

    # AI用スコア
    correct_rate = Column(Float, default=0.0)  # 正答率
    speed_score = Column(Float, default=0.0)  # 速度スコア
    weakness_score = Column(Float, default=0.0)  # 苦手度スコア（高いほど苦手）

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
