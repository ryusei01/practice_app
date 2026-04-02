"""
SQLマイグレーション実行スクリプト

Usage:
    python run_sql_migration.py                          # デフォルト: combined_migration.sql
    python run_sql_migration.py migrations/some_file.sql # 指定ファイル
"""
import os
import sys
from dotenv import load_dotenv
import psycopg2

load_dotenv()

DEFAULT_FILE = "migrations/combined_migration.sql"


def run_sql_migration(sql_file: str):
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not found in .env")
        sys.exit(1)

    if not os.path.exists(sql_file):
        print(f"ERROR: File not found: {sql_file}")
        sys.exit(1)

    with open(sql_file, "r", encoding="utf-8") as f:
        sql = f.read()

    print(f"Connecting to database...")
    conn = psycopg2.connect(database_url)

    try:
        cursor = conn.cursor()
        print(f"Executing: {sql_file}")
        cursor.execute(sql)
        conn.commit()
        print("Migration completed successfully!")
    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    sql_file = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_FILE
    run_sql_migration(sql_file)
