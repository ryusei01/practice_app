"""
認証関連のAPIエンドポイント（Google OAuth）
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import timedelta, datetime
from typing import Optional
import uuid
import httpx
import re
import traceback
import logging

logger = logging.getLogger(__name__)

from ..core.limiter import limiter

from ..core.database import get_db
from ..core.auth import (
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    verify_password,
    get_current_active_user
)
from ..core.config import settings
from ..models import User
from ..models.user import SellerApplicationStatus

router = APIRouter()


class GoogleAuthRequest(BaseModel):
    access_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    is_seller: bool
    is_premium: bool
    premium_expires_at: Optional[datetime]
    account_credit_jpy: int = 0
    role: str = "user"
    seller_application_status: str = "none"
    seller_application_admin_note: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            email=obj.email,
            full_name=obj.username,
            is_active=obj.is_active,
            is_seller=obj.is_seller,
            is_premium=obj.is_premium,
            premium_expires_at=obj.premium_expires_at,
            account_credit_jpy=obj.account_credit_jpy or 0,
            role=obj.role if obj.role else "user",
            seller_application_status=obj.seller_application_status if obj.seller_application_status else "none",
            seller_application_admin_note=obj.seller_application_admin_note,
            created_at=obj.created_at,
        )


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


def _make_unique_username(db: Session, base_name: str) -> str:
    """ユーザー名の重複を避けるため、必要に応じてサフィックスを付与"""
    username = base_name
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_name}{counter}"
        counter += 1
    return username


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def google_login(request: Request, body: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Google OAuthアクセストークンを検証してログイン/登録

    Args:
        request: Googleアクセストークン
        db: データベースセッション

    Returns:
        JWTトークンとユーザー情報
    """
    try:
        return await _google_login_impl(body, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("=== /auth/google 500 エラー詳細 ===\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal error: {type(e).__name__}: {e}")


async def _google_login_impl(body: GoogleAuthRequest, db: Session):
    # Google tokeninfo で aud（クライアントID）を検証してなりすましを防止
    async with httpx.AsyncClient() as client:
        tokeninfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/tokeninfo",
            params={"access_token": body.access_token}
        )

    if tokeninfo_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なGoogleトークンです"
        )

    tokeninfo = tokeninfo_response.json()

    # GOOGLE_CLIENT_ID が設定されている場合は aud を照合
    if settings.GOOGLE_CLIENT_ID:
        aud = tokeninfo.get("aud", "")
        if aud != settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="無効なGoogleトークンです"
            )

    # Google userinfo APIでユーザー情報を取得
    async with httpx.AsyncClient() as client:
        google_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {body.access_token}"}
        )

    if google_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なGoogleトークンです"
        )

    google_data = google_response.json()
    email = google_data.get("email")
    google_id = google_data.get("sub")
    name = google_data.get("name") or (email.split("@")[0] if email else "User")

    if not email or not google_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Googleアカウントの情報を取得できませんでした"
        )

    # 既存ユーザーを検索（google_idまたはemailで）
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    if not user:
        # 新規ユーザー作成
        username = _make_unique_username(db, name)
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            username=username,
            google_id=google_id,
            is_active=True,
            is_seller=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # google_idが未設定なら更新
        if not user.google_id:
            user.google_id = google_id
        if not user.is_active:
            user.is_active = True
        db.commit()

    # JWTトークンを生成
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user.id})

    user.refresh_token = get_password_hash(refresh_token)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.from_orm(user)
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """
    リフレッシュトークンを使って新しいアクセストークンを取得
    """
    payload = decode_access_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なリフレッシュトークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なリフレッシュトークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なリフレッシュトークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.refresh_token or not verify_password(refresh_token, user.refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なリフレッシュトークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires
    )
    new_refresh_token = create_refresh_token(data={"sub": user.id})

    user.refresh_token = get_password_hash(new_refresh_token)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.from_orm(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """現在のユーザー情報を取得"""
    return UserResponse.from_orm(current_user)


@router.post("/seller-application", response_model=UserResponse)
async def submit_seller_application(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    販売者申請を送信する

    - すでに is_seller=True の場合はエラー
    - すでに pending / approved の場合はエラー
    - rejected の場合は再申請可能
    """
    if current_user.is_seller:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="すでに販売者として登録されています"
        )

    current_status = current_user.seller_application_status or SellerApplicationStatus.NONE.value
    if current_status == SellerApplicationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="すでに申請中です。管理者の審査をお待ちください"
        )
    if current_status == SellerApplicationStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="すでに承認済みです"
        )

    current_user.seller_application_status = SellerApplicationStatus.PENDING.value
    current_user.seller_application_submitted_at = datetime.utcnow()
    current_user.seller_application_admin_note = None
    db.commit()
    db.refresh(current_user)

    return UserResponse.from_orm(current_user)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    username: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """現在のユーザー情報を更新"""
    current_user.username = username
    db.commit()
    db.refresh(current_user)
    return UserResponse.from_orm(current_user)
