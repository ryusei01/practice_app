"""
認証関連のAPIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import timedelta, datetime
from typing import Optional
import uuid
import re

from ..core.database import get_db
from ..core.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    get_current_active_user
)
from ..core.config import settings
from ..core.otp import create_otp_code, verify_otp_code
from ..core.email import send_otp_email
from ..models import User
from ..main import limiter

router = APIRouter()


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    パスワードの強度をチェック

    要件:
    - 最小8文字
    - 大文字、小文字、数字を含む
    """
    if len(password) < 8:
        return False, "パスワードは8文字以上である必要があります"

    if not re.search(r'[A-Z]', password):
        return False, "パスワードには大文字を含める必要があります"

    if not re.search(r'[a-z]', password):
        return False, "パスワードには小文字を含める必要があります"

    if not re.search(r'[0-9]', password):
        return False, "パスワードには数字を含める必要があります"

    return True, ""


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
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RegisterPendingResponse(BaseModel):
    user_id: str
    email: str
    message: str


class OTPVerifyRequest(BaseModel):
    user_id: str
    otp_code: str


@router.post("/register", response_model=RegisterPendingResponse, status_code=status.HTTP_201_CREATED)
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
    try:
        # パスワード強度チェック
        is_valid, error_message = validate_password_strength(request.password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message
            )

        # メールアドレスの重複チェック
        existing_user = db.query(User).filter(User.email == request.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="このメールアドレスは既に登録されています"
            )

        # 新しいユーザーを作成（まだ未認証状態）
        hashed_password = get_password_hash(request.password)
        new_user = User(
            id=str(uuid.uuid4()),
            email=request.email,
            username=request.full_name,
            hashed_password=hashed_password,
            is_active=False,  # OTP認証まで非アクティブ
            is_seller=False
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # OTPコードを生成してメール送信
        otp_code = create_otp_code(db, new_user.id, purpose="registration")
        await send_otp_email(new_user.email, otp_code, new_user.username)

        return RegisterPendingResponse(
            user_id=new_user.id,
            email=new_user.email,
            message="認証コードをメールで送信しました。10分以内に入力してください。"
        )
    except HTTPException:
        # HTTPExceptionは再スロー
        raise
    except Exception as e:
        # その他のエラーをキャッチしてログに記録
        import logging
        logging.error(f"[Register] Unexpected error: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"登録中にエラーが発生しました: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    login_data: UserLoginRequest,
    db: Session = Depends(get_db)
):
    """
    ユーザーログイン
    レート制限: 1分間に5回まで

    Args:
        request: HTTPリクエスト（レート制限用）
        login_data: ログインリクエスト
        db: データベースセッション

    Returns:
        アクセストークン

    Raises:
        HTTPException: 認証に失敗した場合
    """
    # ユーザーを検索
    user = db.query(User).filter(User.email == login_data.email).first()

    # ユーザーが存在しない場合
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ユーザーがアクティブかチェック（パスワード検証の前に確認）
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="アカウントが有効化されていません。メールに送信されたOTPコードで認証を完了してください"
        )

    # アカウントロックチェック
    if user.locked_until and user.locked_until > datetime.utcnow():
        remaining_minutes = int((user.locked_until - datetime.utcnow()).total_seconds() / 60)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"アカウントがロックされています。{remaining_minutes}分後に再試行してください"
        )

    # パスワードを検証
    if not verify_password(login_data.password, user.hashed_password):
        # ログイン失敗回数を増やす
        user.failed_login_attempts += 1

        # 5回失敗したらアカウントをロック（15分間）
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.utcnow() + timedelta(minutes=15)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ログイン試行回数が上限を超えました。アカウントを15分間ロックします"
            )

        db.commit()

        # 残り試行回数を表示
        remaining_attempts = 5 - user.failed_login_attempts
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"メールアドレスまたはパスワードが正しくありません（残り{remaining_attempts}回の試行が可能）",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ログイン成功: 失敗回数とロックをリセット
    user.failed_login_attempts = 0
    user.locked_until = None

    # アクセストークンとリフレッシュトークンを生成
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user.id})

    # リフレッシュトークンをハッシュ化してDBに保存
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

    Args:
        refresh_token: リフレッシュトークン
        db: データベースセッション

    Returns:
        新しいアクセストークンとリフレッシュトークン

    Raises:
        HTTPException: リフレッシュトークンが無効な場合
    """
    # リフレッシュトークンをデコード
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

    # ユーザーを検索
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なリフレッシュトークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # DBに保存されているリフレッシュトークンと照合
    if not user.refresh_token or not verify_password(refresh_token, user.refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なリフレッシュトークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 新しいアクセストークンとリフレッシュトークンを生成
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires
    )
    new_refresh_token = create_refresh_token(data={"sub": user.id})

    # 新しいリフレッシュトークンをハッシュ化してDBに保存
    user.refresh_token = get_password_hash(new_refresh_token)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
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


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(request: OTPVerifyRequest, db: Session = Depends(get_db)):
    """
    OTPコードを検証してアカウントを有効化

    Args:
        request: OTP検証リクエスト
        db: データベースセッション

    Returns:
        アクセストークンとリフレッシュトークン

    Raises:
        HTTPException: OTPコードが無効な場合
    """
    # ユーザーを取得
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません"
        )

    # 既にアクティブな場合
    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このアカウントは既に有効化されています"
        )

    # OTPコードを検証
    if not verify_otp_code(db, user.id, request.otp_code, purpose="registration"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="認証コードが無効または期限切れです"
        )

    # ユーザーをアクティブにする
    user.is_active = True
    db.commit()
    db.refresh(user)

    # アクセストークンとリフレッシュトークンを生成
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user.id})

    # リフレッシュトークンをハッシュ化してDBに保存
    user.refresh_token = get_password_hash(refresh_token)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.from_orm(user)
    )


class ResendOTPRequest(BaseModel):
    user_id: str


@router.post("/resend-otp")
async def resend_otp(request: ResendOTPRequest, db: Session = Depends(get_db)):
    """
    OTPコードを再送信

    Args:
        request: OTP再送信リクエスト
        db: データベースセッション

    Returns:
        成功メッセージ

    Raises:
        HTTPException: ユーザーが見つからない、または既にアクティブな場合
    """
    try:
        # ユーザーを取得
        user = db.query(User).filter(User.id == request.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ユーザーが見つかりません"
            )

        # 既にアクティブな場合
        if user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="このアカウントは既に有効化されています"
            )

        # 既存のOTPコードを無効化
        from ..models import OTPCode
        existing_codes = db.query(OTPCode).filter(
            OTPCode.user_id == user.id,
            OTPCode.purpose == "registration",
            OTPCode.used == False
        ).all()

        for code in existing_codes:
            code.used = True
        db.commit()

        # 新しいOTPコードを生成してメール送信
        otp_code = create_otp_code(db, user.id, purpose="registration")
        await send_otp_email(user.email, otp_code, user.username)

        return {"message": "認証コードを再送信しました"}

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"[ResendOTP] Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OTPコードの再送信中にエラーが発生しました: {str(e)}"
        )
