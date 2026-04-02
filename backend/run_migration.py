"""
データベースマイグレーション実行スクリプト
"""
from app.core.database import engine, Base
import app.models  # noqa: F401 — 全テーブルをメタデータに登録

def run_migration():
    """
    全てのモデルをデータベースに反映
    """
    print("Running migration...")
    print(f"Tables to create/update: {list(Base.metadata.tables.keys())}")
    Base.metadata.create_all(bind=engine)
    print("Migration completed!")

if __name__ == "__main__":
    run_migration()
