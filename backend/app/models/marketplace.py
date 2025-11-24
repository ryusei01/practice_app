from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from ..core.database import Base


class Purchase(Base):
    """問題集の購入履歴"""
    __tablename__ = "purchases"

    id = Column(String, primary_key=True, index=True)
    buyer_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    question_set_id = Column(String, ForeignKey("question_sets.id"), nullable=False, index=True)

    # 決済情報
    amount = Column(Integer, nullable=False)  # 購入金額（円）
    platform_fee = Column(Integer, nullable=False)  # プラットフォーム手数料
    seller_amount = Column(Integer, nullable=False)  # 販売者への支払額

    # Stripe情報
    stripe_payment_intent_id = Column(String, unique=True)
    stripe_transfer_id = Column(String)  # 販売者への送金ID

    purchased_at = Column(DateTime, default=datetime.utcnow, index=True)

    # リレーション
    buyer = relationship("User", back_populates="purchases")
    question_set = relationship("QuestionSet", back_populates="purchases")


class Review(Base):
    """問題集のレビュー"""
    __tablename__ = "reviews"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    question_set_id = Column(String, ForeignKey("question_sets.id"), nullable=False, index=True)

    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
