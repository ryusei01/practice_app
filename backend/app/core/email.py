"""
メール送信機能
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
import logging

from .config import settings

logger = logging.getLogger(__name__)


async def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None
) -> bool:
    """
    メールを送信

    Args:
        to_email: 送信先メールアドレス
        subject: 件名
        body: 本文（テキスト）
        html_body: 本文（HTML、オプション）

    Returns:
        送信成功の場合True
    """
    try:
        # SMTP設定がない場合はコンソールにログ出力（開発環境用）
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning("SMTP credentials not configured. Email will be logged instead.")
            logger.info(f"[EMAIL] To: {to_email}")
            logger.info(f"[EMAIL] Subject: {subject}")
            logger.info(f"[EMAIL] Body: {body}")
            return True

        # メッセージを作成
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = settings.SMTP_FROM_EMAIL
        message["To"] = to_email

        # テキストパートを追加
        text_part = MIMEText(body, "plain")
        message.attach(text_part)

        # HTMLパートがあれば追加
        if html_body:
            html_part = MIMEText(html_body, "html")
            message.attach(html_part)

        # SMTPサーバーに接続して送信
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(message)

        logger.info(f"Email sent successfully to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


async def send_otp_email(to_email: str, otp_code: str, user_name: str) -> bool:
    """
    OTPコードをメールで送信

    Args:
        to_email: 送信先メールアドレス
        otp_code: OTPコード
        user_name: ユーザー名

    Returns:
        送信成功の場合True
    """
    subject = "AI Practice Book - 認証コード"

    body = f"""
こんにちは {user_name} 様

AI Practice Book へのご登録ありがとうございます。

以下の認証コードを入力して、アカウント登録を完了してください。

認証コード: {otp_code}

このコードは10分間有効です。

※このメールに心当たりがない場合は、このメールを無視してください。

--
AI Practice Book
    """.strip()

    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background-color: #007AFF;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }}
        .content {{
            background-color: #f8f8f8;
            padding: 30px;
            border-radius: 0 0 8px 8px;
        }}
        .otp-code {{
            background-color: #fff;
            border: 2px solid #007AFF;
            border-radius: 8px;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            padding: 20px;
            text-align: center;
            color: #007AFF;
            margin: 20px 0;
        }}
        .footer {{
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 20px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>AI Practice Book</h1>
    </div>
    <div class="content">
        <p>こんにちは {user_name} 様</p>

        <p>AI Practice Book へのご登録ありがとうございます。</p>

        <p>以下の認証コードを入力して、アカウント登録を完了してください。</p>

        <div class="otp-code">{otp_code}</div>

        <p style="color: #666; font-size: 14px;">このコードは10分間有効です。</p>

        <p style="color: #999; font-size: 12px; margin-top: 30px;">
            ※このメールに心当たりがない場合は、このメールを無視してください。
        </p>
    </div>
    <div class="footer">
        <p>AI Practice Book</p>
    </div>
</body>
</html>
    """.strip()

    return await send_email(to_email, subject, body, html_body)
