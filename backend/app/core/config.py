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

    # Email / SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "noreply@example.com"

    # CORS
    CORS_ORIGINS: str = "*"  # カンマ区切りで複数ドメイン指定可能

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
