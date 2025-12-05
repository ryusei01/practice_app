# Railway デプロイガイド（最新版）

## 問題の原因
プロジェクトルートに`package.json`があるため、RailwayがNode.jsプロジェクトとして認識してしまう。

## 解決方法

### 方法1: Railway UIでRoot Directoryを設定（推奨）

1. Railway Dashboard → プロジェクトを開く
2. バックエンドサービスをクリック
3. **"Settings"** タブ
4. **"Source"** セクションまでスクロール
5. **"Root Directory"** フィールドに `backend` と入力
6. Save → 自動的に再デプロイ

### 方法2: サービスを作り直す

現在のサービスを削除して、新しく作成：

1. **現在のサービスを削除**
   - Settings → Danger → Delete Service

2. **新しいサービスを追加**
   - プロジェクト画面で **"+ New"**
   - **"GitHub Repo"** → `ryusei01/practice_app` を選択
   - **設定画面**で：
     - **Name**: `backend`
     - **Root Directory**: `backend`（ここが重要！）
     - **Branch**: `master`
   - **"Add Service"** をクリック

3. **環境変数を設定**
   - 新しいサービス → **"Variables"** タブ
   ```
   SECRET_KEY=rT6EoQJl_O5cuupKZvkGBJCHGRtZw-XFr_8C8VgX7-Y
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   APP_NAME=QuizMarketplace
   DEBUG=False
   ```

4. **PostgreSQLを追加**（まだの場合）
   - **"+ New"** → **"Database"** → **"Add PostgreSQL"**
   - `DATABASE_URL` が自動設定される

### 方法3: Railway CLI（上級者向け）

```bash
# Railway CLIをインストール
npm i -g @railway/cli

# ログイン
railway login

# プロジェクトをリンク
railway link

# Root Directoryを設定
railway service --root backend

# 環境変数を設定
railway variables set SECRET_KEY=rT6EoQJl_O5cuupKZvkGBJCHGRtZw-XFr_8C8VgX7-Y

# デプロイ
railway up
```

## 正しくデプロイされた場合の確認

デプロイログで以下のように表示されるはずです：
```
Using Nixpacks
setup      │ python311, pip
install    │ python -m pip install -r requirements.txt
start      │ python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Node.jsではなくPythonと表示されていればOK！**

## デプロイ後の確認

1. Railway Dashboard → サービス → **"Deployments"**
2. 最新のデプロイが **"Success"** になっているか確認
3. **"Settings"** → **"Networking"** で公開URLを確認
4. ブラウザで以下にアクセス：
   - `https://your-app.railway.app/` → APIルート
   - `https://your-app.railway.app/docs` → Swagger UI

## トラブルシューティング

### まだNode.jsとして認識される場合
- プロジェクトルートの`package.json`を一時的にリネーム：
  ```bash
  mv package.json package.json.bak
  git add -A
  git commit -m "Temporarily disable root package.json"
  git push
  ```
- デプロイ成功後、元に戻す

### pipコマンドが見つからない
- `backend/nixpacks.toml`でPythonプロバイダーが正しく設定されているか確認
- Root Directoryが`backend`に設定されているか確認
