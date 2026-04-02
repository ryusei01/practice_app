from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "QuizMarketplace"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Supabase
    SUPABASE_URL: str = "https://placeholder.supabase.co"
    SUPABASE_KEY: str = "placeholder_key"
    SUPABASE_SERVICE_KEY: str = "placeholder_service_key"

    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/dbname"

    # JWT
    SECRET_KEY: str = "changeme-insecure-default-key-for-development-only"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Stripe
    STRIPE_SECRET_KEY: str = "sk_test_placeholder"
    STRIPE_PUBLISHABLE_KEY: str = "pk_test_placeholder"
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    PLATFORM_FEE_PERCENT: int = 20
    # 有料プラン (550円) の Stripe Price ID
    STRIPE_PREMIUM_PRICE_ID: str = "price_placeholder"
    # 有料プラン購入時に付与するクレジット（円）
    PREMIUM_PLAN_CREDIT_JPY: int = 200

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""

    # Email / SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "noreply@example.com"

    # CORS
    CORS_ORIGINS: str = "*"  # カンマ区切りで複数ドメイン指定可能

    # ML機能フラグ (sentence-transformers 等を使う機能。本番では False に設定)
    ENABLE_ML: bool = True

    # Ollama (Local LLM)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_TRANSLATION_MODEL: str = "llama3.2:1b"  # 軽量モデル推奨
    USE_LOCAL_TRANSLATION: bool = False  # デフォルトはGoogleTranslatorを使用
    OLLAMA_COPYRIGHT_CHECK_MODEL: str = "gpt-oss-20b"  # 著作権チェック用モデル（GPT-OSS 20B）

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
