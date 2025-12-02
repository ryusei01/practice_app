"""
SQLマイグレーション実行スクリプト
"""
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

def run_sql_migration():
    """
    SQLマイグレーションファイルを実行
    """
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("ERROR: DATABASE_URL not found in .env")
        return

    # Read SQL file
    with open("migrations/add_premium_fields.sql", "r") as f:
        sql = f.read()

    # Connect and execute
    print("Connecting to database...")
    conn = psycopg2.connect(database_url)
    conn.autocommit = True

    try:
        cursor = conn.cursor()
        print("Executing migration...")
        cursor.execute(sql)
        print("Migration completed successfully!")
    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_sql_migration()
