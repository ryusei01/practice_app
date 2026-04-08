"""
公開お問い合わせ API（未ログイン可）
運営宛メール送信。受信先は FEEDBACK_TO_EMAIL（未設定時は SMTP_FROM_EMAIL）。
"""
import html
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

from ..core.client_ip import get_client_ip
from ..core.config import settings
from ..core.email import send_email
from ..core.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/ping")
async def contact_ping():
    """デプロイ・リロード確認用（本番でも公開可）"""
    return {"ok": True, "service": "contact"}


class ContactPublicCreate(BaseModel):
    email: EmailStr
    name: str | None = Field(None, max_length=120)
    message: str = Field(..., min_length=10, max_length=4000)


class ContactPublicResponse(BaseModel):
    success: bool
    message: str


@router.post("/public", response_model=ContactPublicResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def submit_public_contact(request: Request, body: ContactPublicCreate):
    """トップページ等からのお問い合わせ（メールで運営に通知）"""
    to_email = (settings.FEEDBACK_TO_EMAIL or "").strip() or settings.SMTP_FROM_EMAIL
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    client_ip = get_client_ip(request)
    display_name = (body.name or "").strip() or "（未記入）"
    safe_msg = html.escape(body.message)
    safe_name = html.escape(display_name)
    safe_email = html.escape(body.email)

    subject = f"[{settings.APP_DISPLAY_NAME}] お問い合わせ（公開フォーム）"

    text_body = (
        f"━━━━━━━━━━━━━━━━━━\n"
        f"送信者メール: {body.email}\n"
        f"お名前: {display_name}\n"
        f"IP: {client_ip}\n"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"{body.message}\n\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"送信日時: {now}\n"
    )

    html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #007AFF; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0;">{settings.APP_DISPLAY_NAME} - お問い合わせ</h2>
  </div>
  <div style="background-color: #f8f8f8; padding: 20px; border-radius: 0 0 8px 8px;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <tr><td style="padding: 6px 0; color: #666; width: 120px;">メール</td><td style="padding: 6px 0;">{safe_email}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">お名前</td><td style="padding: 6px 0;">{safe_name}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">IP</td><td style="padding: 6px 0;">{html.escape(client_ip)}</td></tr>
    </table>
    <div style="background-color: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; white-space: pre-wrap;">{safe_msg}</div>
    <p style="color: #999; font-size: 12px; margin-top: 16px; text-align: right;">送信日時: {now}</p>
  </div>
</body>
</html>
"""

    try:
        result = await send_email(
            to_email,
            subject,
            text_body,
            html_body,
            reply_to=body.email,
        )
        if not result:
            logger.error("Contact email sending returned False (public form)")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="送信に失敗しました。しばらくしてから再度お試しください。",
            )
    except Exception as e:
        logger.error(f"Failed to send contact email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="送信に失敗しました。しばらくしてから再度お試しください。",
        )

    return ContactPublicResponse(
        success=True,
        message="お問い合わせを送信しました。内容を確認のうえ、必要にご返信いたします。",
    )
