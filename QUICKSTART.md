# クイックスタートガイド

問題集売買 × AI 適応型学習アプリを最速で起動する手順。

## 前提条件チェック

以下がインストールされているか確認：

```bash
node --version   # v18以上
python --version # 3.11以上
git --version
```

## 5 分で起動

### 1. Supabase プロジェクト作成（無料）

1. https://supabase.com/ にアクセス
2. Github でサインアップ
3. 「New Project」をクリック
4. プロジェクト名を入力（例: quiz-app）
5. パスワードを設定
6. リージョンを選択（Tokyo 推奨）
7. 作成完了まで約 2 分待機

### 2. バックエンドセットアップ

```bash
cd backend

# 環境変数ファイルを作成
cp .env.example .env

# .envファイルを編集（Supabaseの設定を貼り付け）
# Supabaseダッシュボードの Settings > API から以下をコピー：
# - Project URL → SUPABASE_URL
# - anon/public key → SUPABASE_KEY
# - service_role key → SUPABASE_SERVICE_KEY
# Settings > Database から：
# - Connection string (URI) → DATABASE_URL

# 仮想環境を作成・有効化
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# 依存関係をインストール
pip install -r requirements.txt

# サーバー起動
uvicorn app.main:app --reload
```

ブラウザで http://localhost:8003/docs を開いて API 確認

### 3. フロントエンドセットアップ

新しいターミナルを開いて：

```bash
cd frontend

# 依存関係をインストール
npm install

# Expo起動
npx expo start
```

- `w` を押してブラウザで起動（開発中はこれが便利）
- `a` を押して Android エミュレータで起動
- `i` を押して iOS シミュレータで起動
- スマホの Expo Go アプリでスキャン

## 初回データ投入（必須）

### 方法1: アプリからCSVアップロード（推奨）

1. アプリを起動してユーザー登録・ログイン
2. 問題集作成画面に移動
3. 問題集の情報を入力:
   - Title: "General Knowledge Quiz"
   - Category: "General"
   - Description: "基礎知識問題集"
4. 問題集作成後、"Add Questions from CSV"をタップ
5. `docs/sample_questions.csv`をアップロード（20問のサンプル問題）

### 方法2: Supabase SQL Editor（開発者向け）

Supabase ダッシュボードの SQL Editor で以下を実行：

```sql
-- テストユーザーを作成
INSERT INTO users (id, email, username, hashed_password, is_active)
VALUES
  ('test-user-1', 'test@example.com', 'testuser', 'hashed', true);

-- テスト問題集を作成
INSERT INTO question_sets (id, title, description, category, price, is_published, creator_id, total_questions)
VALUES
  ('set-1', 'Python基礎', 'Python初心者向け問題集', 'programming', 500, true, 'test-user-1', 10);

-- テスト問題を作成
INSERT INTO questions (id, question_set_id, question_text, question_type, options, correct_answer, difficulty, category)
VALUES
  ('q-1', 'set-1', 'Pythonで変数を定義する正しい方法は？', 'multiple_choice',
   '["x = 10", "var x = 10", "int x = 10", "let x = 10"]', 'x = 10', 0.3, 'programming');
```

### サンプルCSVファイル

`docs/sample_questions.csv` には以下の20問が含まれています：
- 一般知識問題
- 算数・数学問題
- 科学・理科問題
- 地理・歴史問題

CSVフォーマット：
```
question_text,question_type,options,correct_answer,explanation,difficulty
```

## API 動作確認

### 1. ヘルスチェック

```bash
curl http://localhost:8003/health
```

期待される応答：

```json
{ "status": "healthy" }
```

### 2. 回答を提出して AI をテスト

```bash
curl -X POST http://localhost:8003/api/v1/answers/submit \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-1",
    "question_id": "q-1",
    "user_answer": "x = 10",
    "is_correct": true,
    "answer_time_sec": 5.2
  }'
```

### 3. AI 予想スコアを取得

```bash
curl -X POST http://localhost:8003/api/v1/ai/predict-score \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-1",
    "max_score": 100
  }'
```

### 4. AI 推薦問題を取得

```bash
curl -X POST http://localhost:8003/api/v1/ai/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-1",
    "question_set_id": "set-1",
    "count": 5
  }'
```

## Stripe 連携（決済機能を試す場合）

### 1. Stripe アカウント作成

1. https://stripe.com/ にアクセス
2. アカウント作成
3. 「テストモード」に切り替え

### 2. API キーを取得

1. 「開発者」→「API キー」
2. 「公開可能キー」と「シークレットキー」をコピー
3. `backend/.env`に追加：

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxx
```

4. バックエンドを再起動

## トラブルシューティング

### データベース接続エラー

```bash
# Supabaseプロジェクトが起動しているか確認
# DATABASE_URLが正しいか確認
# パスワードに特殊文字がある場合はURLエンコード
```

### ポート競合エラー

```bash
# バックエンドのポートを変更
uvicorn app.main:app --reload --port 8003
```

### Expo 起動エラー

```bash
# キャッシュをクリア
npx expo start -c

# node_modulesを再インストール
rm -rf node_modules
npm install
```

### Python パッケージエラー

```bash
# pipを最新化
pip install --upgrade pip

# 依存関係を再インストール
pip install -r requirements.txt --force-reinstall
```

## 次のステップ

### 開発を続ける

1. [SETUP.md](./docs/SETUP.md) - 詳細なセットアップ手順
2. [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - システム設計
3. [README.md](./README.md) - プロジェクト全体概要

### 機能を追加する

- [ ] ユーザー認証画面の実装
- [ ] 問題集作成画面の実装
- [ ] AI ダッシュボード UI
- [ ] 決済フロー統合

### デプロイする

1. Render / Railway にバックエンドをデプロイ
2. Expo EAS Build でアプリをビルド
3. App Store / Google Play に公開

## 質問・サポート

- GitHub Issues: プロジェクトの issues セクション
- ドキュメント: `docs/` フォルダ内

---

**重要**: このプロジェクトは開発環境です。本番環境にデプロイする前に、セキュリティ設定を見直してください。

- `.env`ファイルを Git にコミットしない
- CORS 設定を本番用に変更
- SECRET_KEY を強力なものに変更
- Stripe 本番キーに切り替え
