"""slowapi 用のカスタムキー（決済: 認証ユーザー ID 優先、なければ IP）。"""
from fastapi import Request

from .auth import decode_access_token
from .client_ip import get_client_ip


def payment_user_or_ip_key(request: Request) -> str:
    auth = request.headers.get("Authorization") or ""
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        payload = decode_access_token(token)
        if payload and payload.get("type") == "access" and payload.get("sub"):
            return f"pay:{payload['sub']}"
    return f"ip:{get_client_ip(request)}"
