"""
フィードバック API
ユーザーがアプリのレビュー・機能要望・問題集フィードバックを送信する
運営者にメールで通知（DBには保存しない）
"""
import logging
from datetime import datetime
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..core.auth import get_current_active_user
from ..core.config import settings
from ..core.email import send_email
from ..core.limiter import limiter
from ..models import User

logger = logging.getLogger(__name__)

router = APIRouter()


class FeedbackCategory(str, Enum):
    APP_REVIEW = "app_review"
    FEATURE_REQUEST = "feature_request"
    QUESTION_SET_FEEDBACK = "question_set_feedback"


CATEGORY_LABELS = {
    FeedbackCategory.APP_REVIEW: "アプリのレビュー",
    FeedbackCategory.FEATURE_REQUEST: "機能リクエスト",
    FeedbackCategory.QUESTION_SET_FEEDBACK: "問題集フィードバック",
}


class FeedbackCreate(BaseModel):
    category: FeedbackCategory
    rating: Optional[int] = Field(None, ge=1, le=5)
    message: str = Field(..., min_length=1, max_length=2000)
    question_set_title: Optional[str] = Field(None, max_length=200)


class FeedbackResponse(BaseModel):
    success: bool
    message: str


def _build_rating_stars(rating: Optional[int]) -> str:
    if rating is None:
        return "なし"
    filled = "★" * rating
    empty = "☆" * (5 - rating)
    return f"{filled}{empty} ({rating}/5)"


@router.post("/", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/day")
async def submit_feedback(
    request: Request,
    body: FeedbackCreate,
    current_user: User = Depends(get_current_active_user),
):
    """フィードバックを送信する（メールで運営者に通知）"""
    to_email = settings.FEEDBACK_TO_EMAIL or settings.SMTP_FROM_EMAIL
    category_label = CATEGORY_LABELS.get(body.category, body.category.value)
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    username = getattr(current_user, "username", "") or ""
    user_email = getattr(current_user, "email", "") or ""

    subject = f"[{settings.APP_NAME}] フィードバック: {category_label}"

    qs_line = ""
    if body.question_set_title:
        qs_line = f"問題集: {body.question_set_title}\n"

    text_body = (
        f"━━━━━━━━━━━━━━━━━━\n"
        f"ユーザー: {user_email} ({username})\n"
        f"カテゴリ: {category_label}\n"
        f"評価: {_build_rating_stars(body.rating)}\n"
        f"{qs_line}"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"{body.message}\n\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"送信日時: {now}\n"
    )

    html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #007AFF; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0;">{settings.APP_NAME} - フィードバック</h2>
  </div>
  <div style="background-color: #f8f8f8; padding: 20px; border-radius: 0 0 8px 8px;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <tr><td style="padding: 6px 0; color: #666; width: 100px;">ユーザー</td><td style="padding: 6px 0;">{user_email} ({username})</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">カテゴリ</td><td style="padding: 6px 0; font-weight: bold;">{category_label}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">評価</td><td style="padding: 6px 0;">{_build_rating_stars(body.rating)}</td></tr>
      {"<tr><td style='padding: 6px 0; color: #666;'>問題集</td><td style='padding: 6px 0;'>" + body.question_set_title + "</td></tr>" if body.question_set_title else ""}
    </table>
    <div style="background-color: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; white-space: pre-wrap;">{body.message}</div>
    <p style="color: #999; font-size: 12px; margin-top: 16px; text-align: right;">送信日時: {now}</p>
  </div>
</body>
</html>
"""

    try:
        result = await send_email(to_email, subject, text_body, html_body)
        if not result:
            logger.warning(f"Feedback email sending returned False for user {current_user.id}")
    except Exception as e:
        logger.error(f"Failed to send feedback email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="フィードバックの送信に失敗しました。しばらくしてからお試しください。",
        )

    return FeedbackResponse(
        success=True,
        message="フィードバックを送信しました。ご意見ありがとうございます。",
    )
