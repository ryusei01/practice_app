"""
OTP (One-Time Password) 生成・検証ユーティリティ
"""
import secrets
import string
from datetime import datetime, timedelta
from typing import List, Tuple, Optional
import json
import uuid

from sqlalchemy.orm import Session

from .auth import get_password_hash, verify_password
from ..models import OTPCode


def generate_otp_code(length: int = 6) -> str:
    """
    ランダムなOTPコードを生成

    Args:
        length: コードの長さ（デフォルト: 6）

    Returns:
        数字のみの OTP コード
    """
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def generate_backup_codes(count: int = 10) -> List[str]:
    """
    バックアップコードを生成

    Args:
        count: 生成するコードの数（デフォルト: 10）

    Returns:
        バックアップコードのリスト
    """
    codes = []
    for _ in range(count):
        # 8桁の英数字コード (例: A1B2C3D4)
        code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
        codes.append(code)
    return codes


def hash_backup_codes(codes: List[str]) -> str:
    """
    バックアップコードをハッシュ化してJSON文字列として保存

    Args:
        codes: バックアップコードのリスト

    Returns:
        ハッシュ化されたコードのJSON文字列
    """
    hashed_codes = {code: get_password_hash(code) for code in codes}
    return json.dumps(hashed_codes)


def verify_backup_code(code: str, hashed_codes_json: str) -> Tuple[bool, str]:
    """
    バックアップコードを検証

    Args:
        code: 検証するバックアップコード
        hashed_codes_json: ハッシュ化されたコードのJSON文字列

    Returns:
        (検証成功, 更新後のJSON文字列) のタプル
    """
    try:
        hashed_codes = json.loads(hashed_codes_json)

        # すべてのコードをチェック
        for stored_code, hashed_value in list(hashed_codes.items()):
            if verify_password(code, hashed_value):
                # 使用済みコードを削除
                del hashed_codes[stored_code]
                updated_json = json.dumps(hashed_codes)
                return True, updated_json

        return False, hashed_codes_json

    except (json.JSONDecodeError, Exception):
        return False, hashed_codes_json


def is_otp_expired(expires_at: datetime) -> bool:
    """
    OTPが期限切れかチェック

    Args:
        expires_at: OTPの有効期限

    Returns:
        期限切れの場合True
    """
    return datetime.utcnow() > expires_at


def get_otp_expiry_time(minutes: int = 10) -> datetime:
    """
    OTPの有効期限を取得

    Args:
        minutes: 有効期限（分）

    Returns:
        有効期限の日時
    """
    return datetime.utcnow() + timedelta(minutes=minutes)


def create_otp_code(
    db: Session,
    user_id: str,
    purpose: str = "registration",
    expires_minutes: int = 10
) -> str:
    """
    OTPコードを作成してDBに保存

    Args:
        db: データベースセッション
        user_id: ユーザーID
        purpose: 目的（registration, password_reset等）
        expires_minutes: 有効期限（分）

    Returns:
        生成されたOTPコード
    """
    # 既存の未使用OTPを無効化
    db.query(OTPCode).filter(
        OTPCode.user_id == user_id,
        OTPCode.purpose == purpose,
        OTPCode.used == False
    ).update({"used": True})
    db.commit()

    # 新しいOTPコードを生成
    otp_code = generate_otp_code()
    expires_at = get_otp_expiry_time(expires_minutes)

    # DBに保存
    otp_record = OTPCode(
        id=str(uuid.uuid4()),
        user_id=user_id,
        code=otp_code,
        purpose=purpose,
        expires_at=expires_at,
        used=False
    )
    db.add(otp_record)
    db.commit()

    return otp_code


def verify_otp_code(
    db: Session,
    user_id: str,
    code: str,
    purpose: str = "registration"
) -> bool:
    """
    OTPコードを検証

    Args:
        db: データベースセッション
        user_id: ユーザーID
        code: 検証するOTPコード
        purpose: 目的

    Returns:
        検証成功の場合True
    """
    # OTPコードを取得
    otp_record = db.query(OTPCode).filter(
        OTPCode.user_id == user_id,
        OTPCode.code == code,
        OTPCode.purpose == purpose,
        OTPCode.used == False
    ).first()

    if not otp_record:
        return False

    # 有効期限チェック
    if is_otp_expired(otp_record.expires_at):
        return False

    # OTPコードを使用済みにする
    otp_record.used = True
    db.commit()

    return True


def cleanup_expired_otp_codes(db: Session):
    """
    期限切れのOTPコードを削除

    Args:
        db: データベースセッション
    """
    db.query(OTPCode).filter(
        OTPCode.expires_at < datetime.utcnow()
    ).delete()
    db.commit()
