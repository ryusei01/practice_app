"""
データベーステーブルを作成するスクリプト
"""
from app.core.database import Base, engine
from app.models import User  # すべてのモデルをインポート
from app.models.otp import OTPCode

def create_tables():
    """すべてのテーブルを作成"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

if __name__ == "__main__":
    create_tables()
