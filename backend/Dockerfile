FROM python:3.11-slim

WORKDIR /app

# システム依存パッケージ（psycopg2 用）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 依存パッケージをインストール（本番用のみ）
COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# アプリケーションコードをコピー
COPY app/ ./app/

# DB マイグレーション（Alembic）
COPY alembic.ini .
COPY alembic/ ./alembic/

# 教科書ファイルをコピー（CI で docs/textbook が backend/ 内に配置済み）
COPY docs/textbook/ ./docs/textbook/

# Cloud Run は PORT 環境変数でポートを指定する
EXPOSE 8080

# 非rootユーザーで実行（セキュリティ）
RUN adduser --disabled-password --gecos "" appuser \
    && mkdir -p /app/uploads \
    && chown appuser:appuser /app/uploads
USER appuser

CMD ["sh", "-c", "if [ \"${RUN_MIGRATIONS:-}\" = \"1\" ]; then alembic upgrade head; fi; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
