# Google OAuth 移行ガイド

通常のメール/パスワード認証を廃止し、Google OAuthのみに統一した変更のまとめ。

---

## 変更ファイル一覧

### Backend

| ファイル | 変更内容 |
|---|---|
| `backend/app/api/auth.py` | 通常ログイン/登録エンドポイント削除、`POST /auth/google` 追加 |
| `backend/app/models/user.py` | `hashed_password` を nullable 化、`google_id` カラム追加 |
| `backend/app/core/config.py` | `GOOGLE_CLIENT_ID` 設定追加 |
| `backend/app/main.py` | OTP クリーンアップタスク削除、CSP ヘッダー追加 |

### Frontend

| ファイル | 変更内容 |
|---|---|
| `frontend/app/(auth)/login.tsx` | メール/パスワードフォーム削除、Google Sign-in ボタンのみに |
| `frontend/app/(auth)/register.tsx` | ログインページへのリダイレクトに置き換え |
| `frontend/app/(auth)/verify-otp.tsx` | ログインページへのリダイレクトに置き換え |
| `frontend/src/contexts/AuthContext.tsx` | `login/register` → `loginWithGoogle` に変更 |
| `frontend/src/api/auth.ts` | `googleLogin(accessToken)` のみに変更 |
| `frontend/package.json` | `expo-auth-session`, `expo-web-browser`, `expo-secure-store` 追加 |
| `frontend/app.config.js` | `scheme: "quizmarketplace"` 追加 |

---

## 認証フロー（新）

```
[フロントエンド]
  ↓ expo-auth-session で Google OAuth を起動
  ↓ ユーザーが Google アカウントでログイン
  ↓ Google から access_token を取得

[バックエンド POST /api/v1/auth/google]
  ↓ Google tokeninfo API でトークン検証 + aud 照合
  ↓ Google userinfo API でメール・名前・sub を取得
  ↓ DB に google_id or email で既存ユーザーを検索
  ↓ 未登録なら新規作成（is_active=True で即時有効化）
  ↓ JWT (access_token 30分 + refresh_token 7日) を発行

[フロントエンド]
  ↓ JWT を SecureStore に保存
  ↓ /(app)/dashboard へリダイレクト
```

---

## 削除されたエンドポイント

| エンドポイント | 説明 |
|---|---|
| `POST /api/v1/auth/register` | メール/パスワード登録 |
| `POST /api/v1/auth/login` | メール/パスワードログイン |
| `POST /api/v1/auth/verify-otp` | OTP 認証 |
| `POST /api/v1/auth/resend-otp` | OTP 再送信 |

## 残存エンドポイント

| エンドポイント | 説明 |
|---|---|
| `POST /api/v1/auth/google` | Google OAuth ログイン/登録 |
| `POST /api/v1/auth/refresh` | トークンリフレッシュ |
| `GET /api/v1/auth/me` | 現在のユーザー情報取得 |
| `PUT /api/v1/auth/me` | ユーザー名更新 |

---

## DB マイグレーション

既存の DB に対して以下の SQL を実行する。

```sql
-- hashed_password を nullable に変更
ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;

-- google_id カラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR UNIQUE;
CREATE INDEX IF NOT EXISTS ix_users_google_id ON users(google_id);
```

---

## 環境変数の設定

### Backend `.env`

```env
# Google OAuth（クライアントIDのみ必要。シークレット不要）
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
```

`GOOGLE_CLIENT_ID` が設定されていない場合はトークンの `aud` 検証をスキップする（開発環境向け）。

### Frontend `.env`

```env
# Web クライアント ID（必須）
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com

# iOS / Android クライアント ID（ネイティブビルド時に必要）
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
```

---

## Google Cloud Console の設定手順

1. [Google Cloud Console](https://console.cloud.google.com) を開く
2. 「API とサービス」→「認証情報」→「認証情報を作成」→「OAuth 2.0 クライアント ID」
3. 以下のクライアントをそれぞれ作成する

### Web アプリケーション

- 承認済みの JavaScript 生成元：
  - `http://localhost:8081`（開発）
  - `https://your-domain.com`（本番）
- 承認済みのリダイレクト URI：
  - `https://auth.expo.io/@your-expo-username/quiz-marketplace`（Expo Go）
  - `https://your-domain.com`（本番 Web）

### iOS（ネイティブビルド時）

- バンドル ID: `com.yourcompany.quizmarketplace`

### Android（ネイティブビルド時）

- パッケージ名: `com.yourcompany.quizmarketplace`
- SHA-1 証明書フィンガープリント（`keytool` で取得）

---

## パッケージインストール

```bash
cd frontend
npm install
```

新たに追加されたパッケージ：

| パッケージ | バージョン | 用途 |
|---|---|---|
| `expo-auth-session` | ~6.0.3 | Google OAuth フロー |
| `expo-web-browser` | ~14.0.2 | OAuth リダイレクト処理 |
| `expo-secure-store` | ~15.0.8 | JWT の安全な保存 |
