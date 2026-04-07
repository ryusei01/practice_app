from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App（OpenAPI の title・ヘルスチェック等。フロントの商品名と分離）
    APP_NAME: str = "QuizMarketplace"
    # ユーザー向けメール・問い合わせ件名など（画面の APP_TITLE と揃える）
    APP_DISPLAY_NAME: str = "AI Tangocho"
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
    # 旧年額プラン用の互換 Price ID。未移行環境では年額 Price ID として扱う
    STRIPE_PREMIUM_PRICE_ID: str = "price_placeholder"
    # 月額 / 年額の Stripe Price ID（請求額は Stripe 側が正。表示用金額は下記と一致させること）
    STRIPE_PREMIUM_MONTHLY_PRICE_ID: str = "price_placeholder"
    STRIPE_PREMIUM_YEARLY_PRICE_ID: str = "price_placeholder"
    # UI 表示用の税込価格（円）
    PREMIUM_MONTHLY_PRICE_JPY: int = 200
    PREMIUM_YEARLY_PRICE_JPY: int = 1800
    # プランの有効日数
    PREMIUM_MONTHLY_VALIDITY_DAYS: int = 30
    PREMIUM_YEARLY_VALIDITY_DAYS: int = 365
    # 購入時に付与するクレジット（円）
    PREMIUM_MONTHLY_CREDIT_JPY: int = 0
    PREMIUM_YEARLY_CREDIT_JPY: int = 0
    # マーケットプレイス充実までのキャンペーン表示用（取り消し線）。None で非表示
    PREMIUM_MONTHLY_STRIKETHROUGH_PRICE_JPY: Optional[int] = 350
    PREMIUM_MONTHLY_STRIKETHROUGH_CREDIT_JPY: Optional[int] = 100

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_IOS_CLIENT_ID: str = ""
    GOOGLE_ANDROID_CLIENT_ID: str = ""
    # リバースプロキシ（Cloudflare / Render 等）背後でクライアント IP を X-Forwarded-For から取る
    TRUST_X_FORWARDED_FOR: bool = False
    # OAuth 連続失敗の一時拒否（Redis）。未設定時は無効
    REDIS_URL: Optional[str] = None
    OAUTH_FAIL_THRESHOLD: int = 7
    OAUTH_FAIL_WINDOW_SEC: int = 900  # 15 分
    OAUTH_BLOCK_DURATION_SEC: int = 900

    # 問題 CSV 一括アップロード上限（バイト）
    BULK_CSV_MAX_BYTES: int = 5_242_880  # 5 MiB

    # Email / SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "noreply@example.com"
    FEEDBACK_TO_EMAIL: str = ""  # 空の場合は SMTP_FROM_EMAIL にフォールバック

    # CORS
    CORS_ORIGINS: str = "*"  # カンマ区切りで複数ドメイン指定可能
    # True のとき、CORS_ORIGINS の列挙に加えて本番ドメインを正規表現で許可（列挙漏れ対策）
    CORS_ALLOW_PRODUCT_ORIGIN_REGEX: bool = True

    # ML機能フラグ（現在は独自テキスト類似度のみ使用。外部MLライブラリ不要）
    ENABLE_ML: bool = False

    # Ollama (Local LLM)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_TRANSLATION_MODEL: str = "llama3.2:1b"  # 軽量モデル推奨
    USE_LOCAL_TRANSLATION: bool = False  # デフォルトはGoogleTranslatorを使用
    OLLAMA_COPYRIGHT_CHECK_MODEL: str = "gpt-oss-20b"  # 著作権チェック用モデル（GPT-OSS 20B）
    OLLAMA_LEARNING_PLAN_MODEL: str = "gpt-oss-20b"  # AI学習プラン生成用（Ollama）
    OLLAMA_VISION_MODEL: str = "llava"  # 画像認識+問題生成用（Ollama vision model）
    OLLAMA_TEXT_GENERATION_MODEL: str = "gpt-oss-20b"  # テキスト→問題生成用（Ollama）

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"
        env_file_encoding = "utf-8"


settings = Settings()
