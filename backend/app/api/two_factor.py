"""
2段階認証（2FA）関連のAPIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from ..core.database import get_db
from ..core.auth import get_current_active_user, verify_password
from ..core.otp import (
    create_otp_code,
    verify_otp_code as verify_otp_code_db,
    generate_backup_codes,
    hash_backup_codes,
    verify_backup_code,
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
    """2段階認証を有効化"""
    if current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2段階認証は既に有効化されています"
        )

    backup_codes = generate_backup_codes(10)
    hashed_codes = hash_backup_codes(backup_codes)

    current_user.two_factor_enabled = True
    current_user.backup_codes = hashed_codes
    db.commit()

    email_sent = send_backup_codes_email(
        current_user.email,
        backup_codes,
        current_user.username
    )

    message = "2段階認証が有効化されました。バックアップコードをメールで送信しました。"
    if not email_sent:
        # バックアップコードはレスポンスにも含めて返すため、ユーザーが保存できるようにする。
        # ただし「送れていない」ことは明示して、黙って成功扱いにしない。
        message = (
            "2段階認証が有効化されましたが、バックアップコードのメール送信に失敗しました。"
            "この画面に表示されるバックアップコードを必ず安全な場所に保存してください。"
        )

    return Enable2FAResponse(
        message=message,
        backup_codes=backup_codes
    )


@router.post("/disable")
async def disable_two_factor_auth(
    request: Disable2FARequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """2段階認証を無効化（パスワード確認が必要）"""
    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2段階認証は有効化されていません"
        )

    if not verify_password(request.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="パスワードが正しくありません"
        )

    current_user.two_factor_enabled = False
    current_user.backup_codes = None
    db.commit()

    return {"message": "2段階認証を無効化しました"}


@router.post("/send-otp")
async def send_otp(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """OTPコードをメール送信（2FA有効ユーザー向け）"""
    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2段階認証が有効化されていません"
        )

    otp_code = create_otp_code(db, current_user.id, purpose="2fa", expires_minutes=10)

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
async def verify_otp(
    request: Verify2FARequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """OTPコードを検証"""
    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2段階認証が有効化されていません"
        )

    if not verify_otp_code_db(db, current_user.id, request.code, purpose="2fa"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTPコードが正しくないか、有効期限が切れています"
        )

    return {"message": "OTPコードが正しく検証されました"}


@router.post("/verify-backup-code")
async def verify_backup_code_endpoint(
    request: Verify2FARequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """バックアップコードを検証（メールにアクセスできない場合）"""
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

    is_valid, updated_codes = verify_backup_code(request.code, current_user.backup_codes)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="バックアップコードが正しくありません"
        )

    current_user.backup_codes = updated_codes
    db.commit()

    return {"message": "バックアップコードが正しく検証されました（このコードは使用済みとなりました）"}


@router.get("/status")
async def get_two_factor_status(current_user: User = Depends(get_current_active_user)):
    """2FA有効状態を取得"""
    return {
        "two_factor_enabled": current_user.two_factor_enabled,
        "email": current_user.email
    }
