# Railway環境変数設定ガイド

Railwayでバックエンドをデプロイする際に設定する必要がある環境変数のリストです。

## 必須の環境変数

### Database（Railway PostgreSQL）
```
DATABASE_URL=${RAILWAY_POSTGRES_URL}
```
※ RailwayでPostgreSQLサービスを追加すると自動的に設定されます

### JWT認証
```
SECRET_KEY=ここにランダムな文字列を生成して設定
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**SECRET_KEYの生成方法**:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### アプリ設定
```
APP_NAME=QuizMarketplace
DEBUG=False
```

## オプションの環境変数

### Supabase（認証・ストレージ用）
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-publishable-key
SUPABASE_SERVICE_KEY=your-service-key
```

### Stripe（決済機能用）
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PLATFORM_FEE_PERCENT=20
```

## Railway設定手順

1. Railway.app にログイン
2. "New Project" → "Deploy from GitHub repo" を選択
3. リポジトリを選択（`practice_app`）
4. "Add variables" で上記の環境変数を設定
5. PostgreSQLサービスを追加:
   - "New" → "Database" → "Add PostgreSQL"
   - 自動的に `DATABASE_URL` が設定されます
6. Deploy!

## デプロイ後の確認

デプロイ完了後、以下のURLでAPIが動作することを確認:
```
https://your-app.up.railway.app/
https://your-app.up.railway.app/docs  # Swagger UI
```
