import warnings
# limitsパッケージのpkg_resources非推奨警告を抑制
warnings.filterwarnings("ignore", message="pkg_resources is deprecated", category=UserWarning)

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
from .core.config import settings
from .core.database import engine
from .core.limiter import limiter
from .core.startup_migrations import run_startup_migrations

_logger = logging.getLogger(__name__)
# uvicorn のコンソールは third-party の INFO を落としがちなので、起動時の本人確認はこちらへ出す
_uvicorn_log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションのライフサイクル管理"""
    run_startup_migrations(engine)
    try:
        import app.api.ai as _ai_api
        _paths = app.openapi().get("paths") or {}
        _gen_ok = "/api/v1/ai/generate-from-text" in _paths
        _uvicorn_log.info(
            "AI: app.api.ai=%s | OpenAPI POST /api/v1/ai/generate-from-text=%s",
            getattr(_ai_api, "__file__", "?"),
            _gen_ok,
        )
        if not _gen_ok:
            _uvicorn_log.warning(
                "LLM の /generate-from-text が未登録です。別フォルダの backend を起動していないか確認してください。"
            )
    except Exception:
        _logger.exception("Failed to verify AI / LLM routes in OpenAPI")
    yield


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
# 本番で CORS_ORIGINS にカスタムドメインを書き忘れるとプリフライトが ACAO なしで失敗するため、
# 当プロダクトの公開ドメインは allow_origin_regex でも許可する（CORS_ALLOW_PRODUCT_ORIGIN_REGEX=False で無効化可）
cors_origins_str = settings.CORS_ORIGINS.strip()
if cors_origins_str == "*":
    origins = ["*"]
else:
    origins = [
        o.strip().rstrip("/")
        for o in cors_origins_str.split(",")
        if o.strip()
    ]

# ai-practice-book.com / Cloudflare Pages（*.aipracticebook.pages.dev）
CORS_PRODUCT_ORIGIN_REGEX = (
    r"^https://([a-z0-9-]+\.)*ai-practice-book\.com$"
    r"|^https://([a-z0-9-]+\.)*aipracticebook\.pages\.dev$"
)

cors_origin_regex = None
if (
    settings.CORS_ALLOW_PRODUCT_ORIGIN_REGEX
    and cors_origins_str != "*"
):
    cors_origin_regex = CORS_PRODUCT_ORIGIN_REGEX

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=cors_origin_regex,
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
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://accounts.google.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://accounts.google.com https://www.googleapis.com; "
        "frame-src https://accounts.google.com; "
        "object-src 'none'"
    )
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
from .api.contact import router as contact_router
from .api import ai_router, answers_router, auth_router, feedback_router, question_sets_router, questions_router, payments_router, admin_router, two_factor_router, translate_router, textbooks_router, reports_router, subscriptions_router

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
app.include_router(reports_router, prefix=f"{settings.API_V1_STR}/reports", tags=["reports"])
app.include_router(subscriptions_router, prefix=f"{settings.API_V1_STR}/subscriptions", tags=["subscriptions"])
app.include_router(feedback_router, prefix=f"{settings.API_V1_STR}/feedback", tags=["feedback"])
app.include_router(contact_router, prefix=f"{settings.API_V1_STR}/contact", tags=["contact"])

# Static files for uploaded media (images, audio)
import os
_uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
try:
    os.makedirs(_uploads_dir, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")
except OSError:
    pass

# TODO: 他のルーターを追加
# from .api import users, questions, marketplace
# app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
# app.include_router(questions.router, prefix=f"{settings.API_V1_STR}/questions", tags=["questions"])
# app.include_router(marketplace.router, prefix=f"{settings.API_V1_STR}/marketplace", tags=["marketplace"])
