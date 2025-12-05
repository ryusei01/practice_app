"""
2段階認証（2FA）関連のAPIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from ..core.database import get_db
from ..core.auth import get_current_active_user, get_password_hash, verify_password
from ..core.otp import (
    generate_otp_code,
    generate_backup_codes,
    hash_backup_codes,
    verify_backup_code,
    get_otp_expiry_time,
    is_otp_expired
)
from ..services.email import send_otp_email, send_backup_codes_email
from ..models import User

router = APIRouter()


class Enable2FAResponse(BaseModel):
    """2FA有効化レスポンス"""
    message: str
    backup_codes: List[str]


class Verify2FARequest(BaseModel):
    """2FA検証リクエスト"""
    code: str


class Disable2FARequest(BaseModel):
    """2FA無効化リクエスト"""
    password: str


@router.post("/enable", response_model=Enable2FAResponse)
async def enable_two_factor_auth(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    2段階認証を有効化

    Args:
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        バックアップコード

    Raises:
        HTTPException: 既に2FAが有効な場合
    """
    if current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2段階認証は既に有効化されています"
        )

    # バックアップコードを生成
    backup_codes = generate_backup_codes(10)
    hashed_codes = hash_backup_codes(backup_codes)

    # DBに保存
    current_user.two_factor_enabled = True
    current_user.backup_codes = hashed_codes
    db.commit()

    # バックアップコードをメール送信
    send_backup_codes_email(
        current_user.email,
        backup_codes,
        current_user.username
    )

    return Enable2FAResponse(
        message="2段階認証が有効化されました。バックアップコードをメールで送信しました。",
        backup_codes=backup_codes
    )


@router.post("/disable")
async def disable_two_factor_auth(
    request: Disable2FARequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    2段階認証を無効化（パスワード確認が必要）

    Args:
        request: パスワード
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        成功メッセージ

    Raises:
        HTTPException: パスワードが間違っている場合
    """
    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2段階認証は有効化されていません"
        )

    # パスワード確認
    if not verify_password(request.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="パスワードが正しくありません"
        )

    # 2FAを無効化
    current_user.two_factor_enabled = False
    current_user.backup_codes = None
    current_user.otp_code = None
    current_user.otp_expires_at = None
    db.commit()

    return {"message": "2段階認証を無効化しました"}


@router.post("/send-otp")
async def send_otp_code(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    OTPコードをメール送信（2FA有効ユーザー向け）

    Args:
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        成功メッセージ

    Raises:
        HTTPException: 2FAが有効化されていない場合
    """
    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2段階認証が有効化されていません"
        )

    # OTPコードを生成
    otp_code = generate_otp_code()

    # DBに保存（ハッシュ化）
    current_user.otp_code = get_password_hash(otp_code)
    current_user.otp_expires_at = get_otp_expiry_time(minutes=10)
    db.commit()

    # メール送信
    success = send_otp_email(
        current_user.email,
        otp_code,
        current_user.username
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="メール送信に失敗しました"
        )

    return {"message": f"{current_user.email} にOTPコードを送信しました"}


@router.post("/verify-otp")
async def verify_otp_code(
    request: Verify2FARequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    OTPコードを検証

    Args:
        request: OTPコード
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        成功メッセージ

    Raises:
        HTTPException: コードが無効または期限切れの場合
    """
    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2段階認証が有効化されていません"
        )

    if not current_user.otp_code or not current_user.otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTPコードが送信されていません"
        )

    # 期限切れチェック
    if is_otp_expired(current_user.otp_expires_at):
        current_user.otp_code = None
        current_user.otp_expires_at = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTPコードの有効期限が切れています。再送信してください"
        )

    # コード検証
    if not verify_password(request.code, current_user.otp_code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTPコードが正しくありません"
        )

    # 検証成功: OTPをクリア
    current_user.otp_code = None
    current_user.otp_expires_at = None
    db.commit()

    return {"message": "OTPコードが正しく検証されました"}


@router.post("/verify-backup-code")
async def verify_backup_code_endpoint(
    request: Verify2FARequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    バックアップコードを検証（メールにアクセスできない場合）

    Args:
        request: バックアップコード
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        成功メッセージ

    Raises:
        HTTPException: コードが無効な場合
    """
    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2段階認証が有効化されていません"
        )

    if not current_user.backup_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="バックアップコードが設定されていません"
        )

    # バックアップコードを検証
    is_valid, updated_codes = verify_backup_code(request.code, current_user.backup_codes)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="バックアップコードが正しくありません"
        )

    # 使用済みコードを削除して更新
    current_user.backup_codes = updated_codes
    db.commit()

    return {"message": "バックアップコードが正しく検証されました（このコードは使用済みとなりました）"}


@router.get("/status")
async def get_two_factor_status(current_user: User = Depends(get_current_active_user)):
    """
    2FA有効状態を取得

    Args:
        current_user: 現在のユーザー

    Returns:
        2FA有効状態
    """
    return {
        "two_factor_enabled": current_user.two_factor_enabled,
        "email": current_user.email
    }
