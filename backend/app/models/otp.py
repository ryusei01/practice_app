from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from ..core.database import Base


class OTPCode(Base):
    """OTP認証コード"""
    __tablename__ = "otp_codes"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(10), nullable=False)
    purpose = Column(String(50), nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
