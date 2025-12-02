"""
データベースマイグレーション実行スクリプト
"""
from app.core.database import engine, Base
from app.models import User, QuestionSet, Question, Answer

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
