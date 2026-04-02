from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Text, Boolean, JSON, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base


class QuestionSetApprovalStatus(str, enum.Enum):
    """問題集の管理者審査ステータス"""
    NOT_REQUIRED = "not_required"   # 既存 is_seller ユーザーや審査不要ケース
    PENDING_REVIEW = "pending_review"  # 管理者審査待ち
    APPROVED = "approved"           # 承認済み（公開可能）
    REJECTED = "rejected"           # 却下


class QuestionSet(Base):
    """問題集"""
    __tablename__ = "question_sets"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    description = Column(Text)
    category = Column(String, index=True)
    tags = Column(JSON)
    price = Column(Integer, default=0)
    is_published = Column(Boolean, default=False)
    creator_id = Column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)

    # 統計情報（非正規化）
    total_questions = Column(Integer, default=0)
    average_difficulty = Column(Float, default=0.5)
    total_purchases = Column(Integer, default=0)
    average_rating = Column(Float, default=0.0)

    # 教科書情報
    textbook_path = Column(String, nullable=True)
    textbook_type = Column(String, nullable=True)
    textbook_content = Column(Text, nullable=True)

    # 管理者審査ステータス
    approval_status = Column(String, default=QuestionSetApprovalStatus.NOT_REQUIRED.value, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    creator = relationship("User", back_populates="question_sets")
    questions = relationship("Question", back_populates="question_set", cascade="all, delete-orphan")
    purchases = relationship("Purchase", back_populates="question_set")
    reviews = relationship("Review", back_populates="question_set")
    copyright_checks = relationship("CopyrightCheckRecord", back_populates="question_set", cascade="all, delete-orphan")


class Question(Base):
    """個別の問題"""
    __tablename__ = "questions"
    __table_args__ = (
        Index("ix_questions_set_order", "question_set_id", "order"),
    )

    id = Column(String, primary_key=True, index=True)
    question_set_id = Column(String, ForeignKey("question_sets.id", ondelete="CASCADE"), nullable=False)

    # 問題内容
    question_text = Column(Text, nullable=False)
    question_type = Column(String, nullable=False)  # multiple_choice, true_false, text_input
    options = Column(JSON)
    correct_answer = Column(String, nullable=False)
    explanation = Column(Text)

    # メタデータ
    difficulty = Column(Float, default=0.5)  # 0.0(易) - 1.0(難)
    category = Column(String, index=True)
    subcategory1 = Column(String, index=True)
    subcategory2 = Column(String, index=True)
    order = Column(Integer, default=0)

    # 統計情報（非正規化、全ユーザーの回答から算出）
    total_attempts = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    average_time_sec = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    question_set = relationship("QuestionSet", back_populates="questions")
    answers = relationship("Answer", back_populates="question")
