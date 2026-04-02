from sqlalchemy import Column, String, Boolean, DateTime, Integer, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base


class UserRole(str, enum.Enum):
    """アクセスレベル（is_seller とは独立）"""
    USER = "user"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    google_id = Column(String, unique=True, index=True, nullable=True)
    is_active = Column(Boolean, default=True)
    role = Column(Enum(UserRole, name="user_role", create_constraint=False, native_enum=False, values_callable=lambda x: [e.value for e in x]), default=UserRole.USER.value, nullable=False)
    is_seller = Column(Boolean, default=False)  # 販売機能フラグ（role とは独立）
    is_premium = Column(Boolean, default=False)
    premium_expires_at = Column(DateTime, nullable=True)
    stripe_account_id = Column(String, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    seller_terms_accepted_at = Column(DateTime, nullable=True)

    # セキュリティ関連
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    refresh_token = Column(String, nullable=True)

    # 2段階認証関連
    two_factor_enabled = Column(Boolean, default=False)
    backup_codes = Column(String, nullable=True)  # JSON形式、ハッシュ化

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    question_sets = relationship("QuestionSet", back_populates="creator")
    purchases = relationship("Purchase", back_populates="buyer")
    answers = relationship("Answer", back_populates="user")
    reviews = relationship("Review", back_populates="user")
