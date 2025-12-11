from sqlalchemy import Column, String, Boolean, DateTime, Integer, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base


class UserRole(str, enum.Enum):
    """ユーザーロール"""
    USER = "user"           # 一般ユーザー
    SELLER = "seller"       # 販売者
    ADMIN = "admin"         # システム管理者
    SUPER_ADMIN = "super_admin"  # 最高管理者


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(Enum(UserRole, name="user_role", create_constraint=False, native_enum=False, values_callable=lambda x: [e.value for e in x]), default=UserRole.USER.value, nullable=False)  # ユーザーロール
    is_seller = Column(Boolean, default=False)  # 後方互換性のため残す
    is_premium = Column(Boolean, default=False)  # 課金ユーザーフラグ
    premium_expires_at = Column(DateTime, nullable=True)  # サブスク期限
    stripe_account_id = Column(String, nullable=True)  # Stripe Connect Account ID
    stripe_customer_id = Column(String, nullable=True)  # Stripe Customer ID (課金用)

    # セキュリティ関連
    failed_login_attempts = Column(Integer, default=0)  # ログイン失敗回数
    locked_until = Column(DateTime, nullable=True)  # アカウントロック解除時刻
    refresh_token = Column(String, nullable=True)  # リフレッシュトークン（ハッシュ化）

    # 2段階認証関連
    two_factor_enabled = Column(Boolean, default=False)  # 2FA有効フラグ
    two_factor_secret = Column(String, nullable=True)  # TOTPシークレット（将来の拡張用）
    otp_code = Column(String, nullable=True)  # メールOTPコード（ハッシュ化）
    otp_expires_at = Column(DateTime, nullable=True)  # OTPの有効期限
    backup_codes = Column(String, nullable=True)  # バックアップコード（JSON形式、ハッシュ化）

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    question_sets = relationship("QuestionSet", back_populates="creator")
    purchases = relationship("Purchase", back_populates="buyer")
    answers = relationship("Answer", back_populates="user")
