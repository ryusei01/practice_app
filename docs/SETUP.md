# セットアップガイド

## 前提条件

- Node.js 18+
- Python 3.11+
- Git

## バックエンドのセットアップ

### 1. Supabase プロジェクトの作成

1. [Supabase](https://supabase.com/)にアクセス
2. 無料アカウントを作成
3. 新しいプロジェクトを作成
4. プロジェクト設定から以下を取得：
   - Project URL
   - Anon public key
   - Service role key (秘密鍵)

### 2. 環境変数の設定

```bash
cd backend
cp .env.example .env
```

`.env`ファイルを編集して、Supabase の情報を設定：

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
SECRET_KEY=your-secret-key-change-this-to-random-string
```

### 3. Python 環境のセットアップ

```bash
# 仮想環境を作成
python -m venv venv

# 仮想環境を有効化
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 依存関係をインストール
pip install -r requirements.txt
```

### 4. データベースのマイグレーション

```bash
# Alembicの初期化（初回のみ）
alembic init alembic

# マイグレーションファイルの作成
alembic revision --autogenerate -m "Initial migration"

# マイグレーションを実行
alembic upgrade head
```

### 5. バックエンドの起動

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

起動確認：

- ブラウザで `http://localhost:8003` にアクセス
- `http://localhost:8003/docs` で API ドキュメントを確認

## フロントエンドのセットアップ

### 1. React Native (Expo) プロジェクトの初期化

```bash
cd frontend
npx create-expo-app@latest . --template blank-typescript
```

### 2. 依存関係のインストール

```bash
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context
npm install @tanstack/react-query axios
npm install @react-native-async-storage/async-storage
```

### 3. 環境変数の設定

`frontend/.env`ファイルを作成：

```env
EXPO_PUBLIC_API_URL=http://localhost:8003/api/v1
```

### 4. フロントエンドの起動

```bash
npx expo start
```

- `i` を押して iOS シミュレータで起動
- `a` を押して Android エミュレータで起動
- Expo Go アプリでスキャンしてスマホで実行

## Stripe のセットアップ（決済機能）

### 1. Stripe アカウントの作成

1. [Stripe](https://stripe.com/)にアクセス
2. アカウントを作成
3. ダッシュボードで「テストモード」に切り替え

### 2. Stripe Connect の有効化

1. Stripe ダッシュボードで「Connect」セクションに移動
2. 「Connect」を有効化
3. Platform 設定を行う

### 3. API キーの取得

1. 「開発者」→「API キー」
2. 以下をコピーして`.env`に追加：
   - 公開可能キー (pk*test*...)
   - シークレットキー (sk*test*...)

```env
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

## 開発ワークフロー

### バックエンド開発

```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload
```

### フロントエンド開発

```bash
cd frontend
npx expo start
```

### データベースマイグレーション

モデルを変更した後：

```bash
cd backend
alembic revision --autogenerate -m "説明"
alembic upgrade head
```

## トラブルシューティング

### データベース接続エラー

- Supabase のダッシュボードでデータベースが起動しているか確認
- `DATABASE_URL`が正しいか確認
- ファイアウォールでポート 5432 が開いているか確認

### Expo 起動エラー

```bash
# キャッシュをクリア
npx expo start -c
```

### Python 依存関係エラー

```bash
# 依存関係を再インストール
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

## 次のステップ

1. [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API 仕様
2. [DEPLOYMENT.md](./DEPLOYMENT.md) - デプロイ方法
3. [DEVELOPMENT.md](./DEVELOPMENT.md) - 開発ガイドライン
