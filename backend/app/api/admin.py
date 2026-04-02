"""
管理者専用APIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

from ..core.database import get_db
from ..core.auth import get_current_admin_user, get_current_super_admin_user, get_password_hash
from ..models import User, QuestionSet
from ..models.user import UserRole, SellerApplicationStatus
from ..models.question import QuestionSetApprovalStatus

router = APIRouter()


class UserListResponse(BaseModel):
    """ユーザー一覧レスポンス"""
    id: str
    email: str
    username: str
    is_active: bool
    role: UserRole
    is_seller: bool
    is_premium: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateUserRoleRequest(BaseModel):
    """ユーザーロール更新リクエスト"""
    role: UserRole


class CreateAdminRequest(BaseModel):
    """管理者作成リクエスト"""
    email: EmailStr
    password: str
    username: str
    role: UserRole


class SellerApplicationResponse(BaseModel):
    """販売者申請レスポンス"""
    id: str
    email: str
    username: str
    seller_application_status: str
    seller_application_submitted_at: Optional[datetime]
    seller_application_admin_note: Optional[str]
    is_seller: bool
    created_at: datetime
    pending_question_sets: List[dict] = []

    class Config:
        from_attributes = True


class ReviewApplicationRequest(BaseModel):
    """申請審査リクエスト"""
    admin_note: Optional[str] = None


@router.get("/users", response_model=List[UserListResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    全ユーザー一覧を取得（管理者専用）

    Args:
        skip: スキップ数
        limit: 取得数上限
        current_admin: 現在の管理者ユーザー
        db: データベースセッション

    Returns:
        ユーザー一覧
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.put("/users/{user_id}/role", response_model=UserListResponse)
async def update_user_role(
    user_id: str,
    request: UpdateUserRoleRequest,
    current_admin: User = Depends(get_current_super_admin_user),
    db: Session = Depends(get_db)
):
    """
    ユーザーのロールを変更（最高管理者専用）

    Args:
        user_id: ユーザーID
        request: ロール更新リクエスト
        current_admin: 現在の最高管理者
        db: データベースセッション

    Returns:
        更新されたユーザー情報

    Raises:
        HTTPException: ユーザーが見つからない場合
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません"
        )

    # 自分自身のロールは変更できない
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="自分自身のロールは変更できません"
        )

    user.role = request.role
    db.commit()
    db.refresh(user)

    return user


@router.post("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    ユーザーを無効化（管理者専用）

    Args:
        user_id: ユーザーID
        current_admin: 現在の管理者
        db: データベースセッション

    Returns:
        成功メッセージ

    Raises:
        HTTPException: ユーザーが見つからない場合
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません"
        )

    # 管理者ユーザーは無効化できない（最高管理者のみ可能）
    if user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        if current_admin.role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="管理者ユーザーを無効化するには最高管理者権限が必要です"
            )

    # 自分自身は無効化できない
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="自分自身を無効化することはできません"
        )

    user.is_active = False
    db.commit()

    return {"message": f"ユーザー {user.username} を無効化しました"}


@router.post("/users/{user_id}/activate")
async def activate_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    ユーザーを有効化（管理者専用）

    Args:
        user_id: ユーザーID
        current_admin: 現在の管理者
        db: データベースセッション

    Returns:
        成功メッセージ

    Raises:
        HTTPException: ユーザーが見つからない場合
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません"
        )

    user.is_active = True
    db.commit()

    return {"message": f"ユーザー {user.username} を有効化しました"}


@router.post("/create-admin", response_model=UserListResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_user(
    request: CreateAdminRequest,
    current_admin: User = Depends(get_current_super_admin_user),
    db: Session = Depends(get_db)
):
    """
    管理者ユーザーを作成（最高管理者専用）

    Args:
        request: 管理者作成リクエスト
        current_admin: 現在の最高管理者
        db: データベースセッション

    Returns:
        作成された管理者ユーザー

    Raises:
        HTTPException: メールアドレスが既に登録されている場合
    """
    import uuid

    # メールアドレスの重複チェック
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に登録されています"
        )

    # SUPER_ADMINは作成できない（データベースで直接作成する必要がある）
    if request.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="最高管理者はこのAPIでは作成できません"
        )

    # 新しい管理者ユーザーを作成
    hashed_password = get_password_hash(request.password)
    new_admin = User(
        id=str(uuid.uuid4()),
        email=request.email,
        username=request.username,
        hashed_password=hashed_password,
        is_active=True,
        role=request.role,
        is_seller=False
    )

    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    return new_admin


def _build_application_response(user: User, db: Session) -> SellerApplicationResponse:
    """販売者申請レスポンスを構築（申請中の問題集も含む）"""
    pending_qs = (
        db.query(QuestionSet)
        .filter(
            QuestionSet.creator_id == user.id,
            QuestionSet.approval_status == QuestionSetApprovalStatus.PENDING_REVIEW.value
        )
        .all()
    )
    pending_list = [
        {
            "id": qs.id,
            "title": qs.title,
            "category": qs.category,
            "total_questions": qs.total_questions or 0,
            "created_at": qs.created_at.isoformat() if qs.created_at else None,
        }
        for qs in pending_qs
    ]
    return SellerApplicationResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        seller_application_status=user.seller_application_status or "none",
        seller_application_submitted_at=user.seller_application_submitted_at,
        seller_application_admin_note=user.seller_application_admin_note,
        is_seller=user.is_seller,
        created_at=user.created_at,
        pending_question_sets=pending_list,
    )


@router.get("/seller-applications", response_model=List[SellerApplicationResponse])
async def list_seller_applications(
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    販売者申請一覧を取得（管理者専用）

    status_filter: none / pending / approved / rejected（省略時は全件）
    """
    query = db.query(User).filter(
        User.seller_application_status != SellerApplicationStatus.NONE.value
    )
    if status_filter:
        query = query.filter(User.seller_application_status == status_filter)

    users = query.order_by(User.seller_application_submitted_at.asc()).offset(skip).limit(limit).all()
    return [_build_application_response(u, db) for u in users]


@router.post("/seller-applications/{user_id}/approve", response_model=SellerApplicationResponse)
async def approve_seller_application(
    user_id: str,
    request: ReviewApplicationRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    販売者申請を承認（管理者専用）
    - is_seller=True に昇格
    - 申請中の問題集を approved に変更して公開可能にする
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ユーザーが見つかりません")

    if user.seller_application_status != SellerApplicationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="審査待ちの申請がありません"
        )

    user.is_seller = True
    user.seller_application_status = SellerApplicationStatus.APPROVED.value
    if request.admin_note:
        user.seller_application_admin_note = request.admin_note

    # 申請中の問題集をすべて承認済みにする
    db.query(QuestionSet).filter(
        QuestionSet.creator_id == user_id,
        QuestionSet.approval_status == QuestionSetApprovalStatus.PENDING_REVIEW.value
    ).update({"approval_status": QuestionSetApprovalStatus.APPROVED.value})

    db.commit()
    db.refresh(user)
    return _build_application_response(user, db)


@router.post("/seller-applications/{user_id}/reject", response_model=SellerApplicationResponse)
async def reject_seller_application(
    user_id: str,
    request: ReviewApplicationRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    販売者申請を却下（管理者専用）
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ユーザーが見つかりません")

    if user.seller_application_status != SellerApplicationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="審査待ちの申請がありません"
        )

    user.seller_application_status = SellerApplicationStatus.REJECTED.value
    user.seller_application_admin_note = request.admin_note or ""

    # 申請中の問題集も却下
    db.query(QuestionSet).filter(
        QuestionSet.creator_id == user_id,
        QuestionSet.approval_status == QuestionSetApprovalStatus.PENDING_REVIEW.value
    ).update({"approval_status": QuestionSetApprovalStatus.REJECTED.value})

    db.commit()
    db.refresh(user)
    return _build_application_response(user, db)
