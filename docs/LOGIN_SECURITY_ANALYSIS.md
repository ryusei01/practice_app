# ログイン機能のセキュリティ分析

## 概要

本ドキュメントでは、アプリケーションのログイン機能におけるセキュリティ実装を包括的に分析し、安全性を評価します。

**最終更新日:** 2024 年（※下記「0. 実装の現状」は 2026 年時点で追記）

---

## 0. 実装の現状（Google OAuth 専用・2026 年追記）

本番のログイン経路は **Google OAuth のみ**（`POST /api/v1/auth/google`）。**メール＋パスワードのログイン API は存在しない**。

| 項目 | 現状 |
|------|------|
| アカウントロック（DB の `failed_login_attempts` / `locked_until`） | スキーマに列はあるが **OAuth フローでは未使用**（将来パスワード認証を追加する場合の拡張用） |
| ブルートフォース相当の抑止 | **slowapi** による IP ベースの `10/minute` および `30/hour`、オプションで **Redis** による同一 IP の連続トークン検証失敗後の一時ブロック（`REDIS_URL` 設定時） |
| プロキシ背後の IP | `TRUST_X_FORWARDED_FOR=true` で `X-Forwarded-For` 先頭をクライアント IP として使用 |

以下のセクション 1.x のうち、**パスワード強度・OTP・アカウントロックのコード例**は歴史的記述または別ブランチを指している可能性があります。OAuth 専用構成では **セクション 0 を正**とする。

---

## 1. 実装済みのセキュリティ機能

### 1.1 パスワード管理

#### ✅ パスワードハッシュ化（強力）

**実装:** `backend/app/core/auth.py`

- **アルゴリズム:** Argon2
- **ライブラリ:** `passlib` with `argon2`
- **評価:** ⭐⭐⭐⭐⭐ (最高評価)

**詳細:**

- Argon2 は、2015 年の Password Hashing Competition で優勝した最新のパスワードハッシュアルゴリズム
- メモリハードな設計により、GPU/ASIC 攻撃に対して高い耐性を持つ
- レインボーテーブル攻撃に対して安全
- タイミング攻撃に対する保護機能を内蔵

```python
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
```

**セキュリティレベル:** 非常に高い

---

#### ✅ パスワード強度チェック

**実装:** `backend/app/api/auth.py` - `validate_password_strength()`

**要件:**

- 最小 8 文字
- 大文字を 1 文字以上含む
- 小文字を 1 文字以上含む
- 数字を 1 文字以上含む

**評価:** ⭐⭐⭐⭐ (良好、特殊文字の推奨が追加されると更に向上)

**改善提案:**

- 特殊文字の推奨（必須ではないが推奨）
- 一般的なパスワード辞書との照合（例: "Password123"など）

---

### 1.2 認証トークン管理

#### ✅ JWT（JSON Web Token）認証

**実装:** `backend/app/core/auth.py`

**設定:**

- **アルゴリズム:** HS256（HMAC-SHA256）
- **アクセストークン有効期限:** 30 分（設定可能）
- **リフレッシュトークン有効期限:** 7 日間

**評価:** ⭐⭐⭐⭐ (良好)

**セキュリティ機能:**

1. **トークンタイプの区別:** アクセストークンとリフレッシュトークンを`type`フィールドで区別
2. **有効期限の設定:** `exp`クレームで自動的に期限切れを検証
3. **リフレッシュトークンのハッシュ化保存:** DB に保存する際に Argon2 でハッシュ化

```python
# リフレッシュトークンをハッシュ化してDBに保存
user.refresh_token = get_password_hash(refresh_token)
```

**注意点:**

- HS256 は対称鍵暗号のため、`SECRET_KEY`の管理が極めて重要
- 本番環境では必ず強力な`SECRET_KEY`を使用すること

---

#### ✅ リフレッシュトークンの検証

**実装:** `backend/app/api/auth.py` - `/refresh`エンドポイント

**セキュリティ機能:**

1. トークンのデコードと検証
2. トークンタイプの確認（`type == "refresh"`）
3. ユーザーの存在確認
4. ユーザーのアクティブ状態確認
5. DB に保存されたハッシュ化されたトークンとの照合

**評価:** ⭐⭐⭐⭐⭐ (最高評価)

**フロー:**

```
リフレッシュトークン → デコード → ユーザー検証 → DBのハッシュと照合 → 新しいトークン発行
```

---

### 1.3 ブルートフォース攻撃対策

#### ✅ レート制限（Rate Limiting）

**実装:** `backend/app/api/auth.py` の `google_login`（`slowapi`）

**設定（現行）:**

- **制限例:** `10/minute` かつ `30/hour`（同一キーで両方適用）
- **ライブラリ:** `slowapi`
- **識別方法:** 既定は接続元 IP。`TRUST_X_FORWARDED_FOR=true` のときは `X-Forwarded-For` 先頭（`backend/app/core/client_ip.py`）

**動作:**

- 制限超過時は `429 Too Many Requests`
- **マルチワーカー／複数インスタンス**では in-memory の slowapi だけでは共有されない → 本番スケールでは **Redis** による失敗カウント（`backend/app/core/redis_oauth_guard.py`）を併用可能

---

#### アカウントロックアウト（パスワード認証時の設計メモ）

**現状:** 本リポジトリのログインは **Google OAuth のみ**のため、DB の `failed_login_attempts` / `locked_until` は **OAuth では更新されない**。

**将来、メール＋パスワードログインを追加する場合の推奨:**

- 連続失敗 **7 回**でロック、ロック時間は運用ポリシーに合わせて設定
- ユーザー列挙を避けるため、失敗時は **汎用エラーメッセージ**を返す

**OAuth 経路での「失敗」相当:** 無効トークン・aud 不一致などは **同一 IP の連続失敗**として Redis でカウントし、閾値超過で一時拒否（アカウント単位のロックとは別物）。

---

### 1.4 アカウント有効化

#### ✅ メールベース OTP 認証

**実装:** `backend/app/api/auth.py` - `/register`, `/verify-otp`

**セキュリティ機能:**

1. 新規登録時は`is_active=False`で作成
2. 6 桁の OTP コードをメールで送信
3. OTP コードは 10 分間有効
4. 一度使用したコードは無効化
5. 新しい OTP 発行時に既存の未使用コードを無効化

**評価:** ⭐⭐⭐⭐ (良好)

**フロー:**

```
新規登録 → アカウント作成（非アクティブ） → OTP送信 → OTP検証 → アカウント有効化
```

**改善提案:**

- OTP コードの試行回数制限（例: 5 回まで）
- OTP コードの再送信レート制限

---

### 1.5 セキュリティヘッダー

#### ✅ HTTP セキュリティヘッダー

**実装:** `backend/app/main.py` - `add_security_headers`ミドルウェア

**設定されているヘッダー:**

- `X-Content-Type-Options: nosniff` - MIME タイプスニッフィング防止
- `X-Frame-Options: DENY` - クリックジャッキング防止
- `X-XSS-Protection: 1; mode=block` - XSS 攻撃対策（レガシーブラウザ用）
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` - HSTS（本番環境のみ）

**評価:** ⭐⭐⭐⭐ (良好)

**改善提案:**

- `Content-Security-Policy`ヘッダーの追加
- `Referrer-Policy`ヘッダーの追加
- `Permissions-Policy`ヘッダーの追加

---

### 1.6 CORS 設定

#### ✅ クロスオリジンリソース共有（CORS）

**実装:** `backend/app/main.py`

**設定:**

- 環境変数`CORS_ORIGINS`で管理
- 開発環境: `*`（すべて許可）
- 本番環境: 特定ドメインのみ許可（推奨）

**評価:** ⭐⭐⭐ (要改善)

**現在の設定:**

```python
allow_origins=origins,
allow_credentials=True,
allow_methods=["*"],
allow_headers=["*"],
```

**改善提案:**

- 本番環境では`allow_methods`と`allow_headers`を具体的に指定
- `allow_credentials=True`の場合、`allow_origins`に`*`は使用できない（既に実装済み）

---

### 1.7 エラーメッセージの設計

#### ✅ 情報漏洩防止

**実装:** `backend/app/api/auth.py`

**セキュリティ機能:**

1. ユーザーが存在しない場合とパスワードが間違っている場合で同じエラーメッセージを返す
2. ユーザー列挙攻撃（User Enumeration）を防止

**評価:** ⭐⭐⭐⭐⭐ (最高評価)

```python
# ユーザーが存在しない場合
if not user:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="メールアドレスまたはパスワードが正しくありません",
    )

# パスワードが間違っている場合
if not verify_password(login_data.password, user.hashed_password):
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="メールアドレスまたはパスワードが正しくありません",
    )
```

---

## 2. フロントエンドのセキュリティ

### 2.1 トークン保存

#### ⚠️ AsyncStorage への保存

**実装:** `frontend/src/api/auth.ts`

**現在の実装:**

```typescript
await AsyncStorage.setItem("access_token", response.data.access_token);
await AsyncStorage.setItem("refresh_token", response.data.refresh_token);
```

**評価:** ⭐⭐⭐ (中程度)

**リスク:**

- AsyncStorage は暗号化されていない
- デバイスが侵害された場合、トークンが読み取られる可能性
- React Native では`expo-secure-store`や`react-native-keychain`の使用を推奨

**改善提案:**

```typescript
import * as SecureStore from "expo-secure-store";

// セキュアな保存
await SecureStore.setItemAsync("access_token", response.data.access_token);
```

---

### 2.2 パスワード入力

#### ✅ セキュアな入力フィールド

**実装:** `frontend/app/(auth)/login.tsx`

**セキュリティ機能:**

- `secureTextEntry={true}` - パスワードを非表示
- `autoCapitalize="none"` - 自動大文字化を無効化
- `keyboardType="email-address"` - メールアドレス用キーボード

**評価:** ⭐⭐⭐⭐ (良好)

---

## 3. セキュリティ上の懸念事項

### 3.1 高優先度

#### ⚠️ SECRET_KEY の管理

**現状:**

```python
SECRET_KEY: str = "changeme-insecure-default-key-for-development-only"
```

**リスク:**

- デフォルトの弱いキーが設定されている
- 本番環境で変更せずに使用すると、JWT トークンが偽造される可能性

**対策:**

1. 本番環境では必ず強力なランダムキーを生成
2. 環境変数で管理（`.env`ファイルに記載）
3. キーの長さは最低 32 文字以上を推奨

```bash
# 強力なSECRET_KEYを生成
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

#### ⚠️ デバッグログの出力

**現状:** `backend/app/core/auth.py`

```python
print(f"[Auth] Decoding token: {token[:20]}...")
print(f"[Auth] Token payload user_id: {user_id}")
print(f"[Auth] User authenticated: {user.email}, is_active: {user.is_active}")
```

**リスク:**

- 本番環境でトークンやユーザー情報がログに出力される可能性
- ログファイルが漏洩した場合、セキュリティリスク

**対策:**

- 本番環境では`print`ではなく適切なロギングライブラリを使用
- ログレベルを設定（DEBUG モードでのみ詳細ログを出力）
- 機密情報はログに出力しない

```python
import logging
logger = logging.getLogger(__name__)

if settings.DEBUG:
    logger.debug(f"[Auth] Decoding token: {token[:20]}...")
```

---

### 3.2 中優先度

#### ⚠️ HTTPS 強制

**現状:** 実装されていない

**リスク:**

- HTTP 通信でトークンが平文で送信される可能性
- 中間者攻撃（MITM）のリスク

**対策:**

```python
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

if not settings.DEBUG:
    app.add_middleware(HTTPSRedirectMiddleware)
```

---

#### ⚠️ トークンの無効化（ログアウト）

**現状:** フロントエンドでトークンを削除するのみ

**リスク:**

- トークンが削除されても、有効期限が切れるまで使用可能
- トークンが漏洩した場合、即座に無効化できない

**対策:**

- トークンブラックリストの実装（Redis など）
- ログアウト時にトークンをブラックリストに追加

---

#### ⚠️ セッション管理

**現状:** トークンベースの認証のみ

**改善提案:**

- デバイス管理機能（複数デバイスでのログイン管理）
- 異常なログイン検知（新しいデバイス、新しい IP アドレスなど）
- セッションの有効期限管理

---

### 3.3 低優先度

#### ⚠️ 2 要素認証（2FA）

**現状:** 新規登録時の OTP 認証のみ

**改善提案:**

- ログイン時の 2FA（TOTP、SMS、メール）
- 認証アプリ（Google Authenticator など）との連携

---

#### ⚠️ パスワードリセット機能

**現状:** 実装されていない

**改善提案:**

- メールベースのパスワードリセット
- セキュアなリセットトークン
- リセットリンクの有効期限管理

---

## 4. セキュリティ評価サマリー

### 4.1 強み

1. ✅ **強力なパスワードハッシュ化** - Argon2 を使用
2. ✅ **適切な JWT 実装** - アクセストークンとリフレッシュトークンの分離
3. ✅ **ブルートフォース対策** - レート制限とアカウントロック
4. ✅ **情報漏洩防止** - 適切なエラーメッセージ設計
5. ✅ **セキュリティヘッダー** - 基本的なヘッダーが設定済み
6. ✅ **パスワード強度チェック** - 基本的な要件を満たす
7. ✅ **OTP 認証** - 新規登録時のメール認証

### 4.2 改善が必要な点

1. ⚠️ **SECRET_KEY の管理** - 本番環境で強力なキーを使用
2. ⚠️ **デバッグログ** - 本番環境でのログ出力を制限
3. ⚠️ **HTTPS 強制** - 本番環境で HTTPS を強制
4. ⚠️ **トークン無効化** - ログアウト時のトークンブラックリスト
5. ⚠️ **フロントエンドのトークン保存** - SecureStore の使用を検討

### 4.3 総合評価

**セキュリティレベル:** ⭐⭐⭐⭐ (4/5)

**評価理由:**

- 基本的なセキュリティ機能は適切に実装されている
- パスワードハッシュ化、JWT 認証、ブルートフォース対策など、重要な機能が実装済み
- 本番環境での設定（SECRET_KEY、HTTPS、ログ）を適切に行えば、高いセキュリティレベルを維持可能

---

## 5. 推奨される改善アクション

### 即座に実施すべき項目（Critical）

1. **SECRET_KEY の変更**

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

   生成したキーを環境変数に設定

2. **デバッグログの削除/制限**

   - 本番環境では`print`文を削除またはログレベルで制御

3. **HTTPS 強制の実装**
   - 本番環境で HTTPSRedirectMiddleware を有効化

### 短期間で実施すべき項目（High）

4. **トークンブラックリストの実装**

   - Redis を使用したトークン無効化機能

5. **フロントエンドのトークン保存改善**

   - `expo-secure-store`への移行

6. **CORS 設定の厳格化**
   - 本番環境で具体的なドメインのみ許可

### 中長期的に検討すべき項目（Medium）

7. **2 要素認証（2FA）の追加**

   - ログイン時の TOTP 認証

8. **パスワードリセット機能**

   - メールベースのリセット機能

9. **セッション管理の強化**
   - デバイス管理、異常ログイン検知

---

## 6. セキュリティチェックリスト

本番環境デプロイ前に確認:

- [ ] SECRET_KEY を強力なランダム文字列に変更
- [x] パスワード強度チェックを実装
- [x] レート制限を実装
- [ ] HTTPS を強制
- [ ] CORS 設定を本番ドメインに限定
- [ ] DEBUG=False に設定
- [x] アカウントロックアウトを実装
- [x] 2 段階認証（OTP）を実装
- [ ] デバッグログを削除/制限
- [ ] トークンブラックリストを実装
- [ ] セキュリティヘッダーを確認
- [ ] データベースの認証情報を環境変数で管理

---

## 7. 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Argon2 Specification](https://github.com/P-H-C/phc-winner-argon2)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

## 8. 結論

本アプリケーションのログイン機能は、**基本的なセキュリティ要件を満たしており、適切に実装されています**。特に以下の点が優れています:

1. 最新のパスワードハッシュアルゴリズム（Argon2）の使用
2. 適切な JWT 実装とリフレッシュトークンの管理
3. ブルートフォース攻撃に対する多層防御（レート制限 + アカウントロック）
4. 情報漏洩を防ぐエラーメッセージ設計

ただし、本番環境にデプロイする前に、**SECRET_KEY の変更、HTTPS 強制、デバッグログの削除**など、重要な設定変更を実施する必要があります。

これらの改善を実施すれば、**高いセキュリティレベルを維持できる**と評価されます。




