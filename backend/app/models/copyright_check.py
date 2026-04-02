"""
著作権チェック結果モデル
販売者が問題集を公開する前にGPT-OSSで著作権リスクを評価した結果を保存する
"""
import enum
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Enum, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CopyrightCheckRecord(Base):
    """著作権チェック結果"""
    __tablename__ = "copyright_check_records"

    id = Column(String, primary_key=True, index=True)
    question_set_id = Column(
        String,
        ForeignKey("question_sets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    risk_level = Column(
        Enum(RiskLevel, name="risk_level_enum", create_constraint=False, native_enum=False,
             values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    reasons = Column(Text, nullable=True)       # JSON array string
    recommendation = Column(Text, nullable=True)
    raw_response = Column(Text, nullable=True)  # Ollama の生レスポンス（デバッグ用）
    checked_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    question_set = relationship("QuestionSet", back_populates="copyright_checks")
