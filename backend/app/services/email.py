"""
メール送信サービス
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List
import logging

from ..core.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, body: str, html_body: str = None) -> bool:
    """
    メールを送信

    Args:
        to_email: 送信先メールアドレス
        subject: 件名
        body: 本文（テキスト形式）
        html_body: 本文（HTML形式、オプション）

    Returns:
        送信成功時True、失敗時False
    """
    try:
        # メールメッセージを作成
        msg = MIMEMultipart('alternative')
        msg['From'] = settings.SMTP_FROM_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject

        # テキスト部分を追加
        text_part = MIMEText(body, 'plain')
        msg.attach(text_part)

        # HTML部分を追加（存在する場合）
        if html_body:
            html_part = MIMEText(html_body, 'html')
            msg.attach(html_part)

        # SMTPサーバーに接続して送信
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()  # TLS暗号化
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Email sent successfully to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


def send_otp_email(to_email: str, otp_code: str, username: str) -> bool:
    """
    OTPコードをメールで送信

    Args:
        to_email: 送信先メールアドレス
        otp_code: 6桁のOTPコード
        username: ユーザー名

    Returns:
        送信成功時True、失敗時False
    """
    subject = f"{settings.APP_NAME} - 2段階認証コード"

    text_body = f"""
こんにちは {username} さん、

あなたのアカウントへのログイン試行が検出されました。

2段階認証コード: {otp_code}

このコードは10分間有効です。
このメールに心当たりがない場合は、無視してください。

{settings.APP_NAME}
"""

    html_body = f"""
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #4CAF50;">2段階認証コード</h2>
      <p>こんにちは <strong>{username}</strong> さん、</p>
      <p>あなたのアカウントへのログイン試行が検出されました。</p>

      <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
        <h1 style="color: #4CAF50; letter-spacing: 5px; margin: 0;">{otp_code}</h1>
      </div>

      <p style="color: #666; font-size: 14px;">このコードは<strong>10分間</strong>有効です。</p>
      <p style="color: #666; font-size: 14px;">このメールに心当たりがない場合は、無視してください。</p>

      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">{settings.APP_NAME}</p>
    </div>
  </body>
</html>
"""

    return send_email(to_email, subject, text_body, html_body)


def send_backup_codes_email(to_email: str, backup_codes: List[str], username: str) -> bool:
    """
    バックアップコードをメールで送信

    Args:
        to_email: 送信先メールアドレス
        backup_codes: バックアップコードのリスト
        username: ユーザー名

    Returns:
        送信成功時True、失敗時False
    """
    subject = f"{settings.APP_NAME} - バックアップコード"

    codes_text = "\n".join([f"  - {code}" for code in backup_codes])
    codes_html = "".join([f"<li style='margin: 5px 0;'>{code}</li>" for code in backup_codes])

    text_body = f"""
こんにちは {username} さん、

2段階認証が有効化されました。

以下はバックアップコードです。メールにアクセスできない場合に使用できます：

{codes_text}

これらのコードは安全な場所に保管してください。
各コードは1回のみ使用できます。

{settings.APP_NAME}
"""

    html_body = f"""
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #4CAF50;">バックアップコード</h2>
      <p>こんにちは <strong>{username}</strong> さん、</p>
      <p>2段階認証が有効化されました。</p>

      <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
        <p style="margin: 0; color: #856404;"><strong>重要:</strong> 以下のバックアップコードを安全な場所に保管してください。</p>
      </div>

      <p>メールにアクセスできない場合、以下のバックアップコードを使用できます：</p>

      <ul style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; font-family: monospace;">
        {codes_html}
      </ul>

      <p style="color: #666; font-size: 14px;">各コードは<strong>1回のみ</strong>使用できます。</p>

      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">{settings.APP_NAME}</p>
    </div>
  </body>
</html>
"""

    return send_email(to_email, subject, text_body, html_body)
