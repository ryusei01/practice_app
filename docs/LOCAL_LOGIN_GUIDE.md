# ローカル環境でログイン状態を再現する手順

Google OAuth を通さずに、DB + JWT 手動発行でフロントエンドのログイン状態を再現する方法。

---

## 前提条件

- バックエンドが `http://127.0.0.1:8003` で起動済み
- フロントエンドの `EXPO_PUBLIC_API_URL=http://127.0.0.1:8003/api/v1`
- `backend/.env` の `DATABASE_URL` が Supabase **Pooler（Session mode）** の URI になっていること

### DATABASE_URL について

ローカルから Supabase に直接接続（`db.xxx.supabase.co:5432`）するとタイムアウトする場合がある。
**Pooler 経由**の URI を使うこと。

```
# NG: 直接接続（ローカルからブロックされる場合あり）
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres

# OK: Pooler 経由（Supabase Dashboard → Settings → Database → Connection string）
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

パスワードに `@` が含まれる場合は `%40` に URL エンコードすること。

---

## 1. テストユーザーを DB に作成

Supabase SQL Editor で実行（既に作成済みなら SKIP）。

```sql
INSERT INTO users (id, email, username, google_id, is_active, role, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'dev@example.com',
  'devuser',
  'google_dev_001',
  true,
  'user',
  NOW(),
  NOW()
);
```

作成後、`id` を確認しておく。

```sql
SELECT id, email, username FROM users WHERE username = 'devuser';
```

> **Note:** `username` と `email` は UNIQUE 制約あり。重複エラーが出たら既にユーザーが存在する。SELECT で id を確認すれば OK。

---

## 2. アクセストークンを発行

### スクリプトの準備

`backend/generate_dev_token.py` の `USER_ID` をステップ1で取得した id に書き換える。

```python
# backend/generate_dev_token.py 内
USER_ID = "ここにUUIDを貼り付け"
```

### 実行（PowerShell）

```powershell
cd D:\document\program\project\practice_app\backend
python generate_dev_token.py
```

> **注意:** Python コードを PowerShell に直接貼り付けても動かない。必ず `python generate_dev_token.py` で実行すること。

出力例:

```
============================================================
Access Token  : eyJhbGciOiJIUzI1NiIs...
Refresh Token : eyJhbGciOiJIUzI1NiIs...
============================================================

--- ブラウザコンソールに貼り付け ---
localStorage.setItem('access_token', 'eyJ...'); localStorage.setItem('refresh_token', 'eyJ...'); location.reload();
```

---

## 3. フロントエンドにトークンを注入

### Web（ブラウザ）の場合

1. Expo Web でアプリを開く（`npx expo start` → `w` キー）
2. ブラウザで **F12** → **Console** タブを開く
3. ステップ2の出力の最終行（`localStorage.setItem...`）をそのまま貼り付けて Enter

```javascript
localStorage.setItem("access_token", "ここにアクセストークン"); localStorage.setItem("refresh_token", "ここにリフレッシュトークン"); location.reload();
```

リロード後、`AuthContext` の `checkAuth` が `GET /api/v1/auth/me` を呼び、ログイン済み状態になる。

### iOS / Android（Expo Go）の場合

ネイティブでは `expo-secure-store` を使っているため、localStorage 方式は使えない。
Google OAuth の正規フローを使うこと。

---

## 4. 動作確認

ログインが成功していれば:

- ダッシュボード (`/(app)/dashboard`) に遷移する
- `GET /api/v1/auth/me` が 200 を返す
- ヘッダーやサイドバーにユーザー名が表示される

---

## 5. Swagger UI でバックエンド API をテスト

1. `http://127.0.0.1:8003/docs` にアクセス
2. 右上の **Authorize** ボタンをクリック
3. Value 欄にアクセストークンを貼り付けて **Authorize**
4. 各エンドポイントを **Try it out** で実行可能

---

## トークンの有効期限

| トークン | 有効期限 | 設定箇所 |
|----------|----------|----------|
| Access Token | 1440分 = 24時間（開発用） | `ACCESS_TOKEN_EXPIRE_MINUTES` in `backend/.env` |
| Refresh Token | 7日 | `backend/app/core/auth.py` ハードコード |

> 本番では `ACCESS_TOKEN_EXPIRE_MINUTES=30` に戻すこと。

---

## 管理者ユーザーとしてログインしたい場合

```sql
UPDATE users SET role = 'super_admin' WHERE username = 'devuser';
```

---

## トラブルシューティング

### CORS エラーが出る

ブラウザに `No 'Access-Control-Allow-Origin' header` と表示される場合、CORS 自体の問題ではなく **バックエンドが 500 エラー** を返している可能性が高い。バックエンドのターミナルログを確認すること。

### DB 接続エラー（password authentication failed）

`backend/.env` の `DATABASE_URL` が古い直接接続形式になっている。Pooler URI に変更する（本ファイル冒頭の「DATABASE_URL について」参照）。

### DB 接続エラー（Connection timed out）

同上。直接接続はローカルからブロックされている可能性がある。

### トークン期限切れ

`python generate_dev_token.py` を再実行してトークンを再発行する。

---

## クリーンアップ

テストユーザーを削除する場合:

```sql
DELETE FROM users WHERE username = 'devuser';
```

`generate_dev_token.py` は `.gitignore` に追加するか、使用後に削除すること。
