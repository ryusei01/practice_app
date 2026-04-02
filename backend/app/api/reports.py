"""
コンテンツ通報 API
一般ユーザーが著作権侵害・スパム・不適切コンテンツを通報する
管理者は通報一覧を確認してステータスを更新できる
"""
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models import User, QuestionSet
from ..models.report import ContentReport, ReportReason, ReportStatus
from ..models.user import UserRole

router = APIRouter()


# --- Pydantic スキーマ ---

class ReportCreate(BaseModel):
    question_set_id: str
    reason: ReportReason
    description: Optional[str] = None


class ReportUpdate(BaseModel):
    status: ReportStatus
    admin_note: Optional[str] = None


class ReportResponse(BaseModel):
    id: str
    reporter_id: str
    question_set_id: str
    reason: str
    description: Optional[str]
    status: str
    admin_note: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- エンドポイント ---

@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    request: ReportCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    問題集への通報を作成する。
    同一ユーザーが同一問題集を重複通報した場合は 400 を返す。
    """
    # 問題集の存在確認
    question_set = db.query(QuestionSet).filter(
        QuestionSet.id == request.question_set_id
    ).first()
    if not question_set:
        raise HTTPException(status_code=404, detail="問題集が見つかりません")

    # 自分の問題集は通報できない
    if question_set.creator_id == current_user.id:
        raise HTTPException(status_code=400, detail="自分の問題集を通報することはできません")

    # 重複通報チェック
    existing = db.query(ContentReport).filter(
        ContentReport.reporter_id == current_user.id,
        ContentReport.question_set_id == request.question_set_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="この問題集はすでに通報済みです")

    report = ContentReport(
        id=str(uuid.uuid4()),
        reporter_id=current_user.id,
        question_set_id=request.question_set_id,
        reason=request.reason.value,
        description=request.description,
        status=ReportStatus.PENDING.value,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/", response_model=List[ReportResponse])
async def list_reports(
    report_status: Optional[str] = Query(None, alias="status"),
    reason: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """通報一覧を取得する（管理者のみ）"""
    if current_user.role not in (UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value):
        raise HTTPException(status_code=403, detail="管理者権限が必要です")

    query = db.query(ContentReport)
    if report_status:
        query = query.filter(ContentReport.status == report_status)
    if reason:
        query = query.filter(ContentReport.reason == reason)

    reports = query.order_by(ContentReport.created_at.desc()).offset(skip).limit(limit).all()
    return reports


@router.put("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: str,
    request: ReportUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """通報ステータスを更新する（管理者のみ）"""
    if current_user.role not in (UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value):
        raise HTTPException(status_code=403, detail="管理者権限が必要です")

    report = db.query(ContentReport).filter(ContentReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="通報が見つかりません")

    report.status = request.status.value
    if request.admin_note is not None:
        report.admin_note = request.admin_note
    report.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(report)
    return report
