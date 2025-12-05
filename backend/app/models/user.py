from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_seller = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)  # 課金ユーザーフラグ
    premium_expires_at = Column(DateTime, nullable=True)  # サブスク期限
    stripe_account_id = Column(String, nullable=True)  # Stripe Connect Account ID
    stripe_customer_id = Column(String, nullable=True)  # Stripe Customer ID (課金用)

    # セキュリティ関連
    failed_login_attempts = Column(Integer, default=0)  # ログイン失敗回数
    locked_until = Column(DateTime, nullable=True)  # アカウントロック解除時刻
    refresh_token = Column(String, nullable=True)  # リフレッシュトークン（ハッシュ化）

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    question_sets = relationship("QuestionSet", back_populates="creator")
    purchases = relationship("Purchase", back_populates="buyer")
    answers = relationship("Answer", back_populates="user")
