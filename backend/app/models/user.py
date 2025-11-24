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
    stripe_account_id = Column(String, nullable=True)  # Stripe Connect Account ID
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    question_sets = relationship("QuestionSet", back_populates="creator")
    purchases = relationship("Purchase", back_populates="buyer")
    answers = relationship("Answer", back_populates="user")
