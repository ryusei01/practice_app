"""
Google OAuth 経路の連続失敗カウントと一時ブロック（Redis）。
REDIS_URL 未設定時は no-op。
"""
import logging
from typing import Optional

from fastapi import HTTPException, status

from .config import settings

logger = logging.getLogger(__name__)

_redis: Optional[object] = None


def _redis_client():
    global _redis
    if not settings.REDIS_URL:
        return None
    if _redis is None:
        import redis.asyncio as redis_async

        _redis = redis_async.from_url(
            settings.REDIS_URL,
            decode_responses=True,
        )
    return _redis


async def check_oauth_ip_blocked(ip: str) -> None:
    r = _redis_client()
    if r is None:
        return
    try:
        blocked = await r.get(f"oauth:block:{ip}")
    except Exception:
        logger.warning("Redis check_oauth_ip_blocked failed; fail-open ip=%s", ip, exc_info=True)
        return
    if blocked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="アクセスが集中しています。しばらくしてから再試行してください。",
        )


async def record_oauth_failure(ip: str, reason_code: str) -> None:
    r = _redis_client()
    if r is None:
        return
    try:
        key = f"oauth:fail:{ip}"
        n = await r.incr(key)
        if n == 1:
            await r.expire(key, settings.OAUTH_FAIL_WINDOW_SEC)
        logger.info(
            "oauth failure ip=%s count=%s reason=%s",
            ip,
            n,
            reason_code,
        )
        if n >= settings.OAUTH_FAIL_THRESHOLD:
            await r.setex(
                f"oauth:block:{ip}",
                settings.OAUTH_BLOCK_DURATION_SEC,
                "1",
            )
            logger.warning(
                "oauth temp_block ip=%s threshold=%s",
                ip,
                settings.OAUTH_FAIL_THRESHOLD,
            )
    except Exception:
        logger.warning("Redis record_oauth_failure failed ip=%s", ip, exc_info=True)


async def clear_oauth_failure_counter(ip: str) -> None:
    r = _redis_client()
    if r is None:
        return
    try:
        await r.delete(f"oauth:fail:{ip}")
    except Exception:
        logger.warning("Redis clear_oauth_failure_counter failed ip=%s", ip, exc_info=True)
