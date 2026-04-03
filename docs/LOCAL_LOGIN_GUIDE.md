# ローカル環境でログイン状態を再現する手順

Google OAuth を通さずに、DB + JWT 手動発行でフロントエンドのログイン状態を再現する方法。

---

## 前提条件

- PostgreSQL が起動しており `DATABASE_URL` で接続可能
- バックエンドが `http://127.0.0.1:8003` で起動済み
- フロントエンドの `EXPO_PUBLIC_API_URL=http://127.0.0.1:8003/api/v1`

---

## 1. テストユーザーを DB に作成

Supabase SQL Editor や `psql` 等で実行。

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

> **Note:** `username` と `email` は UNIQUE 制約あり。重複する場合は値を変えること。

---

## 2. アクセストークンを発行

`backend/` ディレクトリで Python スクリプトを実行する。

```bash
cd backend
python generate_dev_token.py
```

### `backend/generate_dev_token.py`

```python
"""開発用トークン発行スクリプト"""
import sys
from app.core.auth import create_access_token, create_refresh_token

# --- ここにステップ1で確認した id を貼り付ける ---
USER_ID = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

if USER_ID.startswith("xxxx"):
    print("ERROR: USER_ID を実際の値に書き換えてください")
    sys.exit(1)

access_token = create_access_token(data={"sub": USER_ID})
refresh_token = create_refresh_token(data={"sub": USER_ID})

print("=" * 60)
print("Access Token  :", access_token)
print("Refresh Token :", refresh_token)
print("=" * 60)
print()
print("--- ブラウザコンソール用 (コピペ) ---")
print(f"localStorage.setItem('access_token', '{access_token}');")
print(f"localStorage.setItem('refresh_token', '{refresh_token}');")
print("location.reload();")
```

出力例:

```
============================================================
Access Token  : eyJhbGciOiJIUzI1NiIs...
Refresh Token : eyJhbGciOiJIUzI1NiIs...
============================================================

--- ブラウザコンソール用 (コピペ) ---
localStorage.setItem('access_token', 'eyJ...');
localStorage.setItem('refresh_token', 'eyJ...');
location.reload();
```

---

## 3. フロントエンドにトークンを注入

### Web（ブラウザ）の場合

1. Expo Web でアプリを開く（`npx expo start --web`）
2. 開発者ツール → Console を開く
3. ステップ2の「ブラウザコンソール用」出力をそのまま貼り付けて実行

```javascript
localStorage.setItem('access_token', 'ここにアクセストークン');
localStorage.setItem('refresh_token', 'ここにリフレッシュトークン');
location.reload();
```

リロード後、`AuthContext` の `checkAuth` が `GET /api/v1/auth/me` を呼び、ログイン済み状態になる。

### iOS / Android（Expo Go）の場合

ネイティブでは `expo-secure-store` を使っているため、localStorage 方式は使えない。
以下のいずれかで対応する:

- **方法A**: `frontend/src/utils/secureStorage.ts` に開発用のハードコードを一時追加
- **方法B**: Google OAuth の正規フローを使う

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
| Access Token | 30分（デフォルト） | `ACCESS_TOKEN_EXPIRE_MINUTES` in `.env` |
| Refresh Token | 7日 | `backend/app/core/auth.py` ハードコード |

> 開発中に頻繁に切れる場合は、`ACCESS_TOKEN_EXPIRE_MINUTES` を大きい値（例: `1440` = 24時間）に変更すると便利。

---

## 管理者ユーザーとしてログインしたい場合

```sql
UPDATE users SET role = 'super_admin' WHERE username = 'devuser';
```

---

## クリーンアップ

テストユーザーを削除する場合:

```sql
DELETE FROM users WHERE username = 'devuser';
```

`generate_dev_token.py` は `.gitignore` に追加するか、使用後に削除すること。
