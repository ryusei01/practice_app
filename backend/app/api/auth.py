"""
認証関連のAPIエンドポイント（Google OAuth）
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from pydantic import BaseModel, ValidationError
from datetime import timedelta, datetime
from typing import Optional
import uuid
import httpx
import traceback
import logging

logger = logging.getLogger(__name__)

from ..core.limiter import limiter
from ..core.client_ip import get_client_ip
from ..core.redis_oauth_guard import (
    check_oauth_ip_blocked,
    clear_oauth_failure_counter,
    record_oauth_failure,
)

from ..core.database import get_db
from ..core.auth import (
    hash_refresh_token,
    verify_refresh_token,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    verify_password,
    get_current_active_user
)
from ..core.config import settings
from ..models import User
from ..models.user import SellerApplicationStatus, UserRole

router = APIRouter()


class GoogleAuthRequest(BaseModel):
    access_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    is_seller: bool
    is_premium: bool
    premium_expires_at: Optional[datetime]
    account_credit_jpy: int = 0
    role: str = "user"
    seller_application_status: str = "none"
    seller_application_admin_note: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        role_str = _normalize_role(getattr(obj, "role", None))
        status_val = getattr(obj, "seller_application_status", None)
        if status_val is not None and hasattr(status_val, "value"):
            status_val = status_val.value
        status_str = status_val if isinstance(status_val, str) and status_val else "none"
        credit = getattr(obj, "account_credit_jpy", None)
        return cls(
            id=str(getattr(obj, "id", "") or ""),
            email=getattr(obj, "email", None) or "",
            full_name=getattr(obj, "username", None) or "",
            is_active=bool(obj.is_active) if getattr(obj, "is_active", None) is not None else True,
            is_seller=bool(obj.is_seller) if getattr(obj, "is_seller", None) is not None else False,
            is_premium=bool(obj.is_premium) if getattr(obj, "is_premium", None) is not None else False,
            premium_expires_at=getattr(obj, "premium_expires_at", None),
            account_credit_jpy=int(credit or 0),
            role=role_str,
            seller_application_status=status_str,
            seller_application_admin_note=getattr(obj, "seller_application_admin_note", None),
            created_at=getattr(obj, "created_at", None),
        )


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


def _normalize_role(role_val) -> str:
    if role_val is not None and hasattr(role_val, "value"):
        role_val = role_val.value
    role_str = role_val if isinstance(role_val, str) and role_val else UserRole.USER.value
    if role_str == "seller":
        return UserRole.USER.value
    return role_str


def _username_base_from_google(name: str, email: str) -> str:
    base = (name or "").strip()
    # PostgreSQL は NUL を拒否し、制御文字は表示名として不適切
    base = "".join(ch for ch in base if ch >= " " and ch != "\x7f")
    if not base:
        base = (email.split("@")[0] if email else "user").strip() or "user"
        base = "".join(ch for ch in base if ch >= " " and ch != "\x7f") or "user"
    if len(base) > 100:
        base = base[:100]
    return base


def _make_unique_username(db: Session, base_name: str) -> str:
    """ユーザー名の重複を避けるため、必要に応じてサフィックスを付与"""
    username = base_name[:100]
    counter = 1
    while db.query(User).filter(User.username == username).first():
        suffix = str(counter)
        username = f"{base_name[: max(1, 100 - len(suffix))]}{suffix}"
        counter += 1
        if counter > 10000:
            return f"user{uuid.uuid4().hex[:12]}"
    return username


def _tokeninfo_client_ids(tokeninfo: dict) -> set[str]:
    """tokeninfo の aud / azp をクライアント ID 集合にする（aud が list の場合も含む）"""
    ids: set[str] = set()
    for key in ("aud", "azp"):
        raw = tokeninfo.get(key)
        if isinstance(raw, list):
            ids.update(str(x) for x in raw if x)
        elif raw:
            ids.add(str(raw))
    return ids


def _migrate_legacy_seller_role(user: User) -> None:
    """旧 role='seller' を is_seller + role=user に寄せる"""
    raw = getattr(user, "role", None)
    raw_str = raw.value if raw is not None and hasattr(raw, "value") else raw
    if raw_str == "seller":
        user.role = UserRole.USER.value
        user.is_seller = True


@router.post("/google", response_model=TokenResponse)
@limiter.limit("30/hour")
@limiter.limit("10/minute")
async def google_login(request: Request, body: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Google OAuthアクセストークンを検証してログイン/登録

    Args:
        request: Googleアクセストークン
        db: データベースセッション

    Returns:
        JWTトークンとユーザー情報
    """
    ip = get_client_ip(request)
    try:
        await check_oauth_ip_blocked(ip)
        try:
            result = await _google_login_impl(body, db)
        except HTTPException as he:
            if he.status_code in (
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_400_BAD_REQUEST,
            ):
                await record_oauth_failure(ip, f"http_{he.status_code}")
            raise
        await clear_oauth_failure_counter(ip)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "=== /auth/google 500 (%s) ===\n%s",
            type(exc).__name__,
            traceback.format_exc(),
        )
        raise HTTPException(
            status_code=500,
            detail="サーバーエラーが発生しました。しばらくしてから再試行してください。",
        )


_GOOGLE_HTTP_TIMEOUT = httpx.Timeout(15.0)


async def _google_login_impl(body: GoogleAuthRequest, db: Session):
    # Google tokeninfo で aud（クライアントID）を検証してなりすましを防止
    try:
        async with httpx.AsyncClient(timeout=_GOOGLE_HTTP_TIMEOUT) as client:
            tokeninfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v3/tokeninfo",
                params={"access_token": body.access_token}
            )
    except httpx.RequestError as exc:
        logger.exception("Google tokeninfo request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="認証サービス（Google）との通信に失敗しました。ネットワークを確認するか、しばらくしてから再試行してください。",
        ) from exc

    if tokeninfo_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なGoogleトークンです"
        )

    try:
        tokeninfo = tokeninfo_response.json()
    except ValueError:
        logger.error(
            "Google tokeninfo returned non-JSON (status=%s body_prefix=%r)",
            tokeninfo_response.status_code,
            (tokeninfo_response.text or "")[:200],
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なGoogleトークンです",
        )

    # 設定済みの Google Client ID いずれかと aud / azp が一致するか照合
    if not isinstance(tokeninfo, dict):
        logger.error("Google tokeninfo JSON was not an object: %r", type(tokeninfo).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なGoogleトークンです",
        )
    allowed_client_ids = {
        cid
        for cid in [
            settings.GOOGLE_CLIENT_ID,
            settings.GOOGLE_IOS_CLIENT_ID,
            settings.GOOGLE_ANDROID_CLIENT_ID,
        ]
        if cid
    }
    if allowed_client_ids:
        presented = _tokeninfo_client_ids(tokeninfo)
        if presented.isdisjoint(allowed_client_ids):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="無効なGoogleトークンです"
            )

    # Google userinfo APIでユーザー情報を取得
    try:
        async with httpx.AsyncClient(timeout=_GOOGLE_HTTP_TIMEOUT) as client:
            google_response = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {body.access_token}"}
            )
    except httpx.RequestError as exc:
        logger.exception("Google userinfo request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="認証サービス（Google）との通信に失敗しました。ネットワークを確認するか、しばらくしてから再試行してください。",
        ) from exc

    if google_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なGoogleトークンです"
        )

    try:
        google_data = google_response.json()
    except ValueError:
        logger.error(
            "Google userinfo returned non-JSON (status=%s body_prefix=%r)",
            google_response.status_code,
            (google_response.text or "")[:200],
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なGoogleトークンです",
        )
    if not isinstance(google_data, dict):
        logger.error("Google userinfo JSON was not an object: %r", type(google_data).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なGoogleトークンです",
        )
    email = google_data.get("email")
    google_id = google_data.get("sub")
    name_base = _username_base_from_google(
        google_data.get("name") or "",
        email or "",
    )

    if not email or not google_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Googleアカウントの情報を取得できませんでした"
        )

    try:
        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            user = db.query(User).filter(User.email == email).first()

        if not user:
            username = _make_unique_username(db, name_base)
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                username=username,
                google_id=google_id,
                is_active=True,
                is_seller=False,
                role=UserRole.USER.value,
                seller_application_status=SellerApplicationStatus.NONE.value,
                account_credit_jpy=0,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            if not user.google_id:
                conflict = (
                    db.query(User)
                    .filter(User.google_id == google_id, User.id != user.id)
                    .first()
                )
                if conflict:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="このGoogleアカウントは別ユーザーと既に紐づいています。サポートへお問い合わせください。",
                    )
                user.google_id = google_id
            if not user.is_active:
                user.is_active = True
            _migrate_legacy_seller_role(user)
            db.commit()
            db.refresh(user)

        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.id},
            expires_delta=access_token_expires
        )
        refresh_token = create_refresh_token(data={"sub": user.id})

        user.refresh_token = hash_refresh_token(refresh_token)
        db.commit()
        db.refresh(user)
    except HTTPException:
        db.rollback()
        raise
    except OperationalError as exc:
        db.rollback()
        logger.exception("Google login DB operational error email=%s", email)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="データベースに接続できませんでした。しばらくしてから再試行してください。",
        ) from exc
    except IntegrityError:
        db.rollback()
        logger.exception("Google login DB integrity error email=%s google_id=%s", email, google_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="ユーザー登録情報が競合しました。しばらくしてから再試行するか、サポートへお問い合わせください。",
        )
    except (SQLAlchemyError, LookupError) as exc:
        db.rollback()
        logger.exception("Google login DB error email=%s (%s)", email, type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="データベースの処理に失敗しました。しばらくしてから再試行してください。",
        ) from exc

    try:
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.from_orm(user)
        )
    except ValidationError:
        logger.exception("Google login response validation failed email=%s", email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="サーバーエラーが発生しました。しばらくしてから再試行してください。",
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """
    リフレッシュトークンを使って新しいアクセストークンを取得
    """
    payload = decode_access_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なリフレッシュトークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なリフレッシュトークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なリフレッシュトークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.refresh_token or not verify_refresh_token(refresh_token, user.refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なリフレッシュトークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires
    )
    new_refresh_token = create_refresh_token(data={"sub": user.id})

    user.refresh_token = hash_refresh_token(new_refresh_token)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.from_orm(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """現在のユーザー情報を取得"""
    return UserResponse.from_orm(current_user)


@router.post("/seller-application", response_model=UserResponse)
async def submit_seller_application(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    販売者申請を送信する

    - すでに is_seller=True の場合はエラー
    - すでに pending / approved の場合はエラー
    - rejected の場合は再申請可能
    """
    if current_user.is_seller:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="すでに販売者として登録されています"
        )

    current_status = current_user.seller_application_status or SellerApplicationStatus.NONE.value
    if current_status == SellerApplicationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="すでに申請中です。管理者の審査をお待ちください"
        )
    if current_status == SellerApplicationStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="すでに承認済みです"
        )

    current_user.seller_application_status = SellerApplicationStatus.PENDING.value
    current_user.seller_application_submitted_at = datetime.utcnow()
    current_user.seller_application_admin_note = None
    db.commit()
    db.refresh(current_user)

    return UserResponse.from_orm(current_user)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    username: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """現在のユーザー情報を更新"""
    current_user.username = username
    db.commit()
    db.refresh(current_user)
    return UserResponse.from_orm(current_user)
