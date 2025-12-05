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
from ..models import User
from ..models.user import UserRole

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

    # ロールに応じてis_sellerフラグも更新
    if request.role == UserRole.SELLER:
        user.is_seller = True

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
        is_seller=(request.role == UserRole.SELLER)
    )

    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    return new_admin
