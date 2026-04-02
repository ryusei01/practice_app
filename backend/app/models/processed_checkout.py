from sqlalchemy import Column, String, DateTime, ForeignKey
from datetime import datetime
from ..core.database import Base


class ProcessedCheckoutSession(Base):
    __tablename__ = "processed_checkout_sessions"

    checkout_session_id = Column(String(255), primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow)
