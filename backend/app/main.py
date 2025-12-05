from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .core.config import settings

# レート制限の設定
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    version="1.0.0"
)

# レート制限のエラーハンドラーを追加
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS設定
if settings.DEBUG:
    # 開発環境: 全許可
    origins = ["*"]
else:
    # 本番環境: 特定のドメインのみ許可
    origins = [
        "https://your-production-domain.com",  # 本番ドメインに変更すること
    ]

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
from .api import ai_router, answers_router, auth_router, question_sets_router, questions_router, payments_router

app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(question_sets_router, prefix=f"{settings.API_V1_STR}/question-sets", tags=["question-sets"])
app.include_router(questions_router, prefix=f"{settings.API_V1_STR}/questions", tags=["questions"])
app.include_router(ai_router, prefix=f"{settings.API_V1_STR}/ai", tags=["ai"])
app.include_router(answers_router, prefix=f"{settings.API_V1_STR}/answers", tags=["answers"])
app.include_router(payments_router, prefix=f"{settings.API_V1_STR}/payments", tags=["payments"])

# TODO: 他のルーターを追加
# from .api import users, questions, marketplace
# app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
# app.include_router(questions.router, prefix=f"{settings.API_V1_STR}/questions", tags=["questions"])
# app.include_router(marketplace.router, prefix=f"{settings.API_V1_STR}/marketplace", tags=["marketplace"])
