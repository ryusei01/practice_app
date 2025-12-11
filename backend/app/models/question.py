from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from ..core.database import Base


class QuestionSet(Base):
    """問題集"""
    __tablename__ = "question_sets"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    description = Column(Text)
    category = Column(String, index=True)  # 数学、英語、プログラミングなど
    tags = Column(JSON)  # ["初級", "TOEIC", "Python"] など
    price = Column(Integer, default=0)  # 円単位（0 = 無料）
    is_published = Column(Boolean, default=False)
    creator_id = Column(String, ForeignKey("users.id"), nullable=False)

    # 統計情報
    total_questions = Column(Integer, default=0)
    average_difficulty = Column(Float, default=0.5)  # 0.0 - 1.0
    total_purchases = Column(Integer, default=0)
    average_rating = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    creator = relationship("User", back_populates="question_sets")
    questions = relationship("Question", back_populates="question_set", cascade="all, delete-orphan")
    purchases = relationship("Purchase", back_populates="question_set")


class Question(Base):
    """個別の問題"""
    __tablename__ = "questions"

    id = Column(String, primary_key=True, index=True)
    question_set_id = Column(String, ForeignKey("question_sets.id"), nullable=False)

    # 問題内容
    question_text = Column(Text, nullable=False)
    question_type = Column(String, nullable=False)  # multiple_choice, true_false, text_input
    options = Column(JSON)  # 選択肢 ["A", "B", "C", "D"]
    correct_answer = Column(String, nullable=False)
    explanation = Column(Text)  # 解説

    # メタデータ
    difficulty = Column(Float, default=0.5)  # 0.0(易) - 1.0(難)
    category = Column(String, index=True)
    subcategory1 = Column(String, index=True)  # 第1レベルサブカテゴリ（グループ分け用）
    subcategory2 = Column(String, index=True)  # 第2レベルサブカテゴリ（細分化用）
    order = Column(Integer, default=0)  # 問題集内での順序

    # 統計情報（全ユーザーの回答から算出）
    total_attempts = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    average_time_sec = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    question_set = relationship("QuestionSet", back_populates="questions")
    answers = relationship("Answer", back_populates="question")
