"""
OTP (One-Time Password) 生成・検証ユーティリティ
"""
import secrets
import string
from datetime import datetime, timedelta
from typing import List, Tuple
import json

from .auth import get_password_hash, verify_password


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
