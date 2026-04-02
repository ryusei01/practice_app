"""Initialize database tables"""
from app.core.database import Base, engine
# 全モデルをメタデータに登録（copyright_check / content_reports 等を含む）
import app.models  # noqa: F401

def init_db():
    """Create all tables in the database"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()
