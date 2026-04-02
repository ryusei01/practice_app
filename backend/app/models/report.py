"""
コンテンツ通報モデル
一般ユーザーが著作権侵害・不適切コンテンツを通報する際に使用する
"""
import enum
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Enum, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base


class ReportReason(str, enum.Enum):
    COPYRIGHT = "copyright"
    SPAM = "spam"
    INAPPROPRIATE = "inappropriate"
    OTHER = "other"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class ContentReport(Base):
    """コンテンツ通報"""
    __tablename__ = "content_reports"

    id = Column(String, primary_key=True, index=True)
    reporter_id = Column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_set_id = Column(
        String,
        ForeignKey("question_sets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason = Column(
        Enum(ReportReason, name="report_reason_enum", create_constraint=False, native_enum=False,
             values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    description = Column(Text, nullable=True)
    status = Column(
        Enum(ReportStatus, name="report_status_enum", create_constraint=False, native_enum=False,
             values_callable=lambda x: [e.value for e in x]),
        default=ReportStatus.PENDING.value,
        nullable=False,
    )
    admin_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    reporter = relationship("User")
    question_set = relationship("QuestionSet")
