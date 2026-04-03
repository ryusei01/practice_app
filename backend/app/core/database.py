from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings  # force reload

db_url = (settings.DATABASE_URL or "").strip()
if not db_url:
    raise RuntimeError(
        "DATABASE_URL is empty. Set DATABASE_URL env var (Cloud Run service env / GitHub Actions secret) "
        "to a valid SQLAlchemy URL like: postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME"
    )

engine = create_engine(
    db_url,
    pool_pre_ping=True,  # 接続の有効性を確認
    pool_recycle=3600,  # 1時間で接続を再利用
    pool_size=5,  # 接続プールサイズ
    max_overflow=10,  # オーバーフロー接続数
    echo=settings.DEBUG
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
