import warnings
# limitsパッケージのpkg_resources非推奨警告を抑制
warnings.filterwarnings("ignore", message="pkg_resources is deprecated", category=UserWarning)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
import asyncio
from .core.config import settings

# レート制限の設定
limiter = Limiter(key_func=get_remote_address)


async def periodic_cleanup():
    """
    定期的に期限切れの未認証ユーザーをクリーンアップ
    1時間ごとに実行
    """
    from .core.database import SessionLocal
    from .core.otp import cleanup_inactive_users_with_expired_otp
    import logging
    
    logger = logging.getLogger(__name__)
    logger.info("[Cleanup] Starting periodic cleanup task")
    
    # 初回実行前に少し待機（アプリケーションの起動を待つ）
    await asyncio.sleep(60)  # 1分待機
    
    while True:
        try:
            await asyncio.sleep(3600)  # 1時間待機
            db = None
            try:
                db = SessionLocal()
                cleaned_count = cleanup_inactive_users_with_expired_otp(db, grace_period_hours=0)
                if cleaned_count > 0:
                    logger.info(f"[Cleanup] Cleaned up {cleaned_count} expired inactive users")
                else:
                    logger.debug("[Cleanup] No expired users to clean up")
            except Exception as db_error:
                logger.error(f"[Cleanup] Database error during cleanup: {str(db_error)}", exc_info=True)
            finally:
                if db:
                    try:
                        db.close()
                    except Exception as close_error:
                        logger.error(f"[Cleanup] Error closing database connection: {str(close_error)}")
        except asyncio.CancelledError:
            logger.info("[Cleanup] Cleanup task cancelled")
            raise
        except Exception as e:
            logger.error(f"[Cleanup] Unexpected error during periodic cleanup: {str(e)}", exc_info=True)
            # エラーが発生してもタスクを継続（次の実行を待つ）
            await asyncio.sleep(60)  # エラー時は1分待機してから再試行


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    アプリケーションのライフサイクル管理
    """
    # 起動時
    cleanup_task = asyncio.create_task(periodic_cleanup())
    yield
    # シャットダウン時
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    version="1.0.0",
    lifespan=lifespan
)

# レート制限のエラーハンドラーを追加
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS設定
# 環境変数 CORS_ORIGINS から許可するオリジンを取得
# カンマ区切りで複数指定可能: "https://example.com,https://app.example.com"
# 開発環境では "*" を指定してすべて許可
cors_origins_str = settings.CORS_ORIGINS
if cors_origins_str == "*":
    origins = ["*"]
else:
    # カンマ区切りの文字列をリストに変換
    origins = [origin.strip() for origin in cors_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# セキュリティヘッダーの追加
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.get("/")
async def root():
    """ヘルスチェックエンドポイント"""
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """ヘルスチェック"""
    return {"status": "healthy"}


# APIルーターを追加
from .api import ai_router, answers_router, auth_router, question_sets_router, questions_router, payments_router, admin_router, two_factor_router, translate_router, textbooks_router

app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(question_sets_router, prefix=f"{settings.API_V1_STR}/question-sets", tags=["question-sets"])
app.include_router(questions_router, prefix=f"{settings.API_V1_STR}/questions", tags=["questions"])
app.include_router(ai_router, prefix=f"{settings.API_V1_STR}/ai", tags=["ai"])
app.include_router(answers_router, prefix=f"{settings.API_V1_STR}/answers", tags=["answers"])
app.include_router(payments_router, prefix=f"{settings.API_V1_STR}/payments", tags=["payments"])
app.include_router(admin_router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])
app.include_router(two_factor_router, prefix=f"{settings.API_V1_STR}/2fa", tags=["two-factor-auth"])
app.include_router(translate_router, prefix=f"{settings.API_V1_STR}/translate", tags=["translate"])
app.include_router(textbooks_router, prefix=f"{settings.API_V1_STR}/textbooks", tags=["textbooks"])

# TODO: 他のルーターを追加
# from .api import users, questions, marketplace
# app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
# app.include_router(questions.router, prefix=f"{settings.API_V1_STR}/questions", tags=["questions"])
# app.include_router(marketplace.router, prefix=f"{settings.API_V1_STR}/marketplace", tags=["marketplace"])
