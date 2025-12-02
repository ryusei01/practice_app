"""
認証関連のAPIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import timedelta, datetime
from typing import Optional
import uuid

from ..core.database import get_db
from ..core.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_active_user
)
from ..core.config import settings
from ..models import User

router = APIRouter()


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    is_seller: bool
    is_premium: bool
    premium_expires_at: Optional[datetime]

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        # usernameをfull_nameにマッピング
        return cls(
            id=obj.id,
            email=obj.email,
            full_name=obj.username,
            is_active=obj.is_active,
            is_seller=obj.is_seller,
            is_premium=obj.is_premium,
            premium_expires_at=obj.premium_expires_at
        )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    新規ユーザー登録

    Args:
        request: ユーザー登録リクエスト
        db: データベースセッション

    Returns:
        アクセストークン

    Raises:
        HTTPException: メールアドレスが既に登録されている場合
    """
    # メールアドレスの重複チェック
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に登録されています"
        )

    # 新しいユーザーを作成
    hashed_password = get_password_hash(request.password)
    new_user = User(
        id=str(uuid.uuid4()),
        email=request.email,
        username=request.full_name,
        hashed_password=hashed_password,
        is_active=True,
        is_seller=False
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # アクセストークンを生成
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.id},
        expires_delta=access_token_expires
    )

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.from_orm(new_user)
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: UserLoginRequest, db: Session = Depends(get_db)):
    """
    ユーザーログイン

    Args:
        request: ログインリクエスト
        db: データベースセッション

    Returns:
        アクセストークン

    Raises:
        HTTPException: 認証に失敗した場合
    """
    # ユーザーを検索
    user = db.query(User).filter(User.email == request.email).first()

    # パスワードを検証
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ユーザーがアクティブかチェック
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このアカウントは無効化されています"
        )

    # アクセストークンを生成
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires
    )

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.from_orm(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """
    現在のユーザー情報を取得

    Args:
        current_user: 現在のユーザー（依存性注入）

    Returns:
        ユーザー情報
    """
    return UserResponse.from_orm(current_user)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    username: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    現在のユーザー情報を更新

    Args:
        username: 新しいユーザー名
        current_user: 現在のユーザー（依存性注入）
        db: データベースセッション

    Returns:
        更新されたユーザー情報
    """
    current_user.username = username
    db.commit()
    db.refresh(current_user)

    return UserResponse.from_orm(current_user)
