from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    version="1.0.0"
)

# CORS設定（開発時は全許可、本番環境では制限）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番では特定のオリジンのみ許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
