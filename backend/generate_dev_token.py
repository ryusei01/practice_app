"""開発用: DB接続なしでJWTトークンを発行するスクリプト"""
from datetime import datetime, timedelta
from jose import jwt

SECRET_KEY = "your-secret-key-here-change-this"
ALGORITHM = "HS256"

# ============================================================
# ここに Supabase SQL Editor で取得した testuser の id を貼る
# SELECT id FROM users WHERE username = 'testuser';
# ============================================================
USER_ID = "392fb597-ee37-430d-a824-4133268b00bc"

access_payload = {
    "sub": USER_ID,
    "exp": datetime.utcnow() + timedelta(hours=24),
    "type": "access",
}
refresh_payload = {
    "sub": USER_ID,
    "exp": datetime.utcnow() + timedelta(days=7),
    "type": "refresh",
}

access_token = jwt.encode(access_payload, SECRET_KEY, algorithm=ALGORITHM)
refresh_token = jwt.encode(refresh_payload, SECRET_KEY, algorithm=ALGORITHM)

print("=" * 60)
print("Access Token  :", access_token)
print()
print("Refresh Token :", refresh_token)
print("=" * 60)
print()
print("--- ブラウザコンソールに貼り付け ---")
print(f"localStorage.setItem('access_token', '{access_token}'); localStorage.setItem('refresh_token', '{refresh_token}'); location.reload();")
