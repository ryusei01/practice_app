"""クライアント IP の解決（信頼できるプロキシ時は X-Forwarded-For 先頭）。"""
from starlette.requests import Request
from slowapi.util import get_remote_address

from .config import settings


def get_client_ip(request: Request) -> str:
    if settings.TRUST_X_FORWARDED_FOR:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            part = xff.split(",")[0].strip()
            if part:
                return part
    return get_remote_address(request) or "unknown"
