# セキュリティ改善提案

## 優先度：高（Critical & High）

### 1. SECRET_KEYの強化
**現状の問題:**
- `.env.example`にデフォルトの弱いキーが記載されている
- 本番環境で変更せずに使用すると重大なセキュリティリスク

**改善策:**
```bash
# 強力なSECRET_KEYを生成
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

実際の`.env`ファイルには生成された強力なキーを使用すること。

### 2. パスワード強度チェックの追加

**実装箇所:** `backend/app/api/auth.py`

```python
import re

def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    パスワードの強度をチェック

    要件:
    - 最小8文字
    - 大文字、小文字、数字を含む
    - 特殊文字を推奨
    """
    if len(password) < 8:
        return False, "パスワードは8文字以上である必要があります"

    if not re.search(r'[A-Z]', password):
        return False, "パスワードには大文字を含める必要があります"

    if not re.search(r'[a-z]', password):
        return False, "パスワードには小文字を含める必要があります"

    if not re.search(r'[0-9]', password):
        return False, "パスワードには数字を含める必要があります"

    return True, ""

# registerエンドポイントで使用
@router.post("/register", response_model=TokenResponse)
async def register(request: UserRegisterRequest, db: Session = Depends(get_db)):
    # パスワード強度チェック
    is_valid, error_message = validate_password_strength(request.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )
    # ... 残りの処理
```

### 3. レート制限の実装

**ライブラリのインストール:**
```bash
pip install slowapi
```

**実装例:** `backend/app/main.py`

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# auth.pyで使用
@router.post("/login")
@limiter.limit("5/minute")  # 1分に5回まで
async def login(request: Request, ...):
    ...
```

### 4. HTTPS強制（本番環境）

**バックエンド:** `backend/app/main.py`
```python
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

if not settings.DEBUG:
    app.add_middleware(HTTPSRedirectMiddleware)
```

**フロントエンド:** 環境変数で管理
```typescript
// frontend/src/api/client.ts
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8003/api/v1";
```

`.env.production`:
```
EXPO_PUBLIC_API_URL=https://your-production-api.com/api/v1
```

## 優先度：中（Medium）

### 5. CORS設定の明示化

**実装箇所:** `backend/app/main.py`

```python
from fastapi.middleware.cors import CORSMiddleware

# 開発環境
if settings.DEBUG:
    origins = [
        "http://localhost:*",
        "http://127.0.0.1:*",
    ]
else:
    # 本番環境では特定のドメインのみ許可
    origins = [
        "https://your-production-domain.com",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 6. リフレッシュトークンの実装

JWTアクセストークンは短命（15分など）にし、リフレッシュトークンで更新する仕組み。

**スキーマ例:**
```python
# models/token.py
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    token = Column(String, unique=True)
    expires_at = Column(DateTime)
    is_revoked = Column(Boolean, default=False)
```

### 7. トークンブラックリスト（ログアウト時の無効化）

```python
# Redisを使用した例
import redis

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def revoke_token(token: str, expires_in_seconds: int):
    redis_client.setex(f"revoked_token:{token}", expires_in_seconds, "1")

def is_token_revoked(token: str) -> bool:
    return redis_client.exists(f"revoked_token:{token}") > 0
```

### 8. アカウントロックアウト

連続ログイン失敗時にアカウントを一時的にロックする。

```python
class User(Base):
    # 既存フィールド...
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)

# ログイン処理で
if user.locked_until and user.locked_until > datetime.utcnow():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="アカウントがロックされています。しばらく待ってから再試行してください"
    )

if not verify_password(request.password, user.hashed_password):
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= 5:
        user.locked_until = datetime.utcnow() + timedelta(minutes=15)
    db.commit()
    raise HTTPException(...)

# 成功時はリセット
user.failed_login_attempts = 0
user.locked_until = None
```

## 優先度：低（Low）

### 9. パスワードリセット機能
メール経由でのパスワードリセット機能

### 10. 2要素認証（2FA）
TOTP（Time-based One-Time Password）の実装

### 11. セキュリティヘッダーの追加

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["your-domain.com"])

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

## チェックリスト

本番デプロイ前に必ず確認:

- [ ] SECRET_KEYを強力なランダム文字列に変更
- [ ] パスワード強度チェックを実装
- [ ] レート制限を実装
- [ ] HTTPSを強制
- [ ] CORS設定を本番ドメインに限定
- [ ] DEBUG=Falseに設定
- [ ] データベースの認証情報を環境変数で管理
- [ ] ログ機能を実装（不正アクセスの検知）
- [ ] 定期的なセキュリティ監査を実施

## 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
