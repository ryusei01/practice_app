# データベースマイグレーション: 2段階認証と管理者権限

## 概要

このマイグレーションでは以下の機能を追加します：

1. **ユーザーロール管理**（USER, SELLER, ADMIN, SUPER_ADMIN）
2. **2段階認証（メールベースOTP）**

## 追加されるカラム

### `users` テーブル

```sql
-- ユーザーロール
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';

-- 2段階認証関連
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN otp_code VARCHAR(255);
ALTER TABLE users ADD COLUMN otp_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN backup_codes TEXT;
```

## マイグレーション手順

### 方法1: SQLファイルを直接実行（PostgreSQL）

```bash
# PostgreSQLに接続
psql -h localhost -U your_user -d your_database

# 以下のSQLを実行
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT;

-- ロールのENUM型を作成（PostgreSQL）
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'seller', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- roleカラムの型を変更
ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;
```

### 方法2: Alembicを使用（推奨）

#### 1. Alembicをインストール

```bash
cd backend
pip install alembic
```

#### 2. Alembicを初期化

```bash
alembic init alembic
```

#### 3. `alembic.ini` を編集

```ini
sqlalchemy.url = postgresql://user:password@localhost:5432/dbname
# または環境変数から読み込む場合は env.py で設定
```

#### 4. `alembic/env.py` を編集

```python
from app.core.database import Base
from app.models import User, QuestionSet, Question, Answer, Purchase

target_metadata = Base.metadata
```

#### 5. マイグレーションを自動生成

```bash
alembic revision --autogenerate -m "Add user roles and 2FA support"
```

#### 6. マイグレーションを確認して実行

```bash
# 生成されたマイグレーションファイルを確認
cat alembic/versions/xxxxx_add_user_roles_and_2fa_support.py

# マイグレーションを実行
alembic upgrade head
```

## 初回セットアップ: 最高管理者の作成

最高管理者（SUPER_ADMIN）は、データベースで直接作成する必要があります：

```sql
-- 既存ユーザーを最高管理者に昇格
UPDATE users
SET role = 'super_admin'
WHERE email = 'admin@example.com';
```

または、Pythonスクリプトで作成：

```python
from app.models.user import User, UserRole
from app.core.auth import get_password_hash
from app.core.database import SessionLocal
import uuid

db = SessionLocal()

# 最高管理者を作成
super_admin = User(
    id=str(uuid.uuid4()),
    email="admin@example.com",
    username="Super Admin",
    hashed_password=get_password_hash("YourSecurePassword123"),
    is_active=True,
    role=UserRole.SUPER_ADMIN
)

db.add(super_admin)
db.commit()
print(f"Super admin created: {super_admin.email}")
```

## 環境変数の設定

`.env` ファイルに以下を追加：

```bash
# Email / SMTP (2段階認証用)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

### Gmailアプリパスワードの作成方法

1. Googleアカウント設定 → セキュリティ
2. 2段階認証を有効化
3. アプリパスワードを生成
4. 生成されたパスワードを `SMTP_PASSWORD` に設定

## 既存データの移行

既存のユーザーは自動的に `role='user'` が設定されます。
販売者（is_seller=True）のユーザーを SELLER ロールに変更する場合：

```sql
UPDATE users
SET role = 'seller'
WHERE is_seller = TRUE;
```

## ロールバック方法

問題が発生した場合：

```bash
# Alembic使用時
alembic downgrade -1

# 手動でロールバック
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users DROP COLUMN two_factor_enabled;
ALTER TABLE users DROP COLUMN two_factor_secret;
ALTER TABLE users DROP COLUMN otp_code;
ALTER TABLE users DROP COLUMN otp_expires_at;
ALTER TABLE users DROP COLUMN backup_codes;
```

## 動作確認

1. **サーバー起動**

```bash
cd backend
uvicorn app.main:app --reload
```

2. **APIドキュメント確認**

http://localhost:8000/docs にアクセスし、以下のエンドポイントを確認：

- `/api/v1/2fa/enable` - 2FA有効化
- `/api/v1/2fa/send-otp` - OTP送信
- `/api/v1/2fa/verify-otp` - OTP検証
- `/api/v1/admin/users` - ユーザー一覧（管理者専用）
- `/api/v1/admin/create-admin` - 管理者作成（最高管理者専用）

3. **2FAのテスト**

```bash
# ユーザーログイン後、2FAを有効化
curl -X POST http://localhost:8000/api/v1/2fa/enable \
  -H "Authorization: Bearer <access_token>"

# OTPコード送信
curl -X POST http://localhost:8000/api/v1/2fa/send-otp \
  -H "Authorization: Bearer <access_token>"

# メールで受信したOTPコードを検証
curl -X POST http://localhost:8000/api/v1/2fa/verify-otp \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

## トラブルシューティング

### メールが送信されない場合

1. SMTP設定を確認
2. Gmailの場合、「安全性の低いアプリのアクセス」を許可
3. ファイアウォール設定を確認（ポート587が開いているか）
4. ログを確認: `tail -f logs/app.log`

### ロールが反映されない場合

```sql
-- ロールを確認
SELECT id, email, role FROM users;

-- ENUMを再作成
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('user', 'seller', 'admin', 'super_admin');
ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;
```
