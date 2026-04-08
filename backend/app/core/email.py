"""
メール送信機能
"""
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
import logging

from .config import settings

logger = logging.getLogger(__name__)

# SMTP接続タイムアウト（秒）
SMTP_TIMEOUT = 30
# リトライ回数
MAX_RETRIES = 2
# リトライ間隔（秒）
RETRY_DELAY = 2


async def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
    reply_to: Optional[str] = None,
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
            if html_body:
                # HTMLメールの場合はOTPコードを抽出して表示
                import re
                otp_match = re.search(r'<div class="otp-code">(\d+)</div>', html_body)
                if otp_match:
                    logger.info(f"[EMAIL] OTP Code: {otp_match.group(1)}")
            return True

        # メッセージを作成
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = settings.SMTP_FROM_EMAIL
        message["To"] = to_email
        if reply_to:
            message["Reply-To"] = reply_to

        # テキストパートを追加
        text_part = MIMEText(body, "plain", "utf-8")
        message.attach(text_part)

        # HTMLパートがあれば追加
        if html_body:
            html_part = MIMEText(html_body, "html", "utf-8")
            message.attach(html_part)

        # リトライロジック付きでSMTP送信
        last_error = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                logger.info(f"[EMAIL] Attempting to send email to {to_email} (attempt {attempt + 1}/{MAX_RETRIES + 1})")
                
                # SMTPサーバーに接続（タイムアウト設定付き）
                # NOTE: GmailはEHLO/HELOの引数が不正(空白や末尾ドット等)だと「5.5.4 ... invalid, closing」で切断する。
                # Windows環境だとsocket.getfqdn()が不正な文字列(例: "RYU-PC.flets-east.jp. iptvf.jp")を返すことがあり、
                # それがそのままEHLO引数に使われてしまうため、local_hostnameを安全な値に固定する。
                server = smtplib.SMTP(timeout=SMTP_TIMEOUT, local_hostname="localhost")
                connect_code, connect_msg = server.connect(settings.SMTP_HOST, settings.SMTP_PORT)
                # starttls() は内部で server_hostname=self._host を使うため、空/不正だと ValueError になる。
                # Windows環境で稀に空になってしまうケースがあるので、安全な値で上書きしておく。
                try:
                    current_host = getattr(server, "_host", None)
                except Exception:
                    current_host = None
                if not current_host or (isinstance(current_host, str) and current_host.startswith(".")):
                    server._host = settings.SMTP_HOST
                    server.host = settings.SMTP_HOST
                try:
                    peer = server.sock.getpeername() if getattr(server, "sock", None) else None
                except Exception:
                    peer = None
                logger.info(
                    "[EMAIL] SMTP connected: code=%s peer=%s local_hostname=%s host=%s",
                    connect_code,
                    peer,
                    getattr(server, "local_hostname", None),
                    getattr(server, "_host", None),
                )
                
                # 明示的にEHLOを送信（初期化時に送信されていない可能性があるため）
                try:
                    ehlo_response = server.ehlo()
                    logger.info(
                        "[EMAIL] EHLO: code=%s does_esmtp=%s has_starttls=%s",
                        (ehlo_response[0] if ehlo_response else None),
                        (server.does_esmtp if hasattr(server, "does_esmtp") else None),
                        (server.has_extn("starttls") if hasattr(server, "has_extn") else None),
                    )
                except Exception as ehlo_error:
                    # EHLOが失敗した場合、HELOを試す
                    logger.warning("[EMAIL] EHLO failed, trying HELO: %s", str(ehlo_error))
                    try:
                        server.helo()
                    except Exception:
                        pass  # HELOも失敗する可能性があるが、続行する
                
                try:
                    # Gmailは常にSTARTTLSをサポートしているため、
                    # has_extn('starttls')がFalseでもSTARTTLSを試す
                    # （ネットワーク環境によってはEHLOの応答が正しくない場合がある）
                    
                    # STARTTLSを使用して暗号化接続
                    # 明示的にTLSコンテキストを渡す（環境差異の切り分けもしやすい）
                    tls_context = ssl.create_default_context()
                    server.starttls(context=tls_context)
                    # STARTTLS後は再度EHLOが必要
                    server.ehlo()
                    logger.info("[EMAIL] STARTTLS succeeded")
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.send_message(message)
                    logger.info(f"Email sent successfully to {to_email}")
                    return True
                finally:
                    try:
                        server.quit()
                    except Exception as quit_error:
                        logger.warning("[EMAIL] server.quit() failed: %s", str(quit_error))
                        pass
                        
            except smtplib.SMTPConnectError as e:
                last_error = f"SMTP connection error: {str(e)}"
                logger.warning(f"[EMAIL] {last_error} (attempt {attempt + 1}/{MAX_RETRIES + 1})")
            except smtplib.SMTPAuthenticationError as e:
                last_error = f"SMTP authentication error: {str(e)}"
                logger.error(f"[EMAIL] {last_error}")
                # 認証エラーはリトライしない
                break
            except smtplib.SMTPServerDisconnected as e:
                last_error = f"SMTP server disconnected: {str(e)}"
                logger.warning(f"[EMAIL] {last_error} (attempt {attempt + 1}/{MAX_RETRIES + 1})")
            except smtplib.SMTPException as e:
                last_error = f"SMTP error: {str(e)}"
                logger.warning(f"[EMAIL] {last_error} (attempt {attempt + 1}/{MAX_RETRIES + 1})")
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"
                logger.warning(f"[EMAIL] {last_error} (attempt {attempt + 1}/{MAX_RETRIES + 1})")
            
            # 最後の試行でない場合は待機
            if attempt < MAX_RETRIES:
                logger.info(f"[EMAIL] Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
        
        # すべてのリトライが失敗した場合
        logger.error(f"Failed to send email to {to_email} after {MAX_RETRIES + 1} attempts. Last error: {last_error}")
        
        # DEBUGモードでもメール送信失敗時はFalseを返す（ユーザー体験のため）
        # ただし、ログにOTPコードを出力してデバッグできるようにする
        if settings.DEBUG:
            logger.warning(f"[EMAIL] DEBUG mode: Email sending failed. OTP code in body: {body}")
            # OTPコードを抽出してログに出力
            import re
            otp_match = re.search(r'認証コード:\s*(\d+)', body)
            if otp_match:
                logger.warning(f"[EMAIL] DEBUG: OTP Code for {to_email}: {otp_match.group(1)}")
        
        return False

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}", exc_info=True)
        
        # 開発環境では警告のみで続行
        if settings.DEBUG:
            logger.warning(f"[EMAIL] DEBUG mode: Email sending failed due to exception: {str(e)}")
        
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
    subject = f"{settings.APP_DISPLAY_NAME} - 認証コード"

    body = f"""
こんにちは {user_name} 様

{settings.APP_DISPLAY_NAME} へのご登録ありがとうございます。

以下の認証コードを入力して、アカウント登録を完了してください。

認証コード: {otp_code}

このコードは10分間有効です。

※このメールに心当たりがない場合は、このメールを無視してください。

--
{settings.APP_DISPLAY_NAME}
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
        <h1>{settings.APP_DISPLAY_NAME}</h1>
    </div>
    <div class="content">
        <p>こんにちは {user_name} 様</p>

        <p>{settings.APP_DISPLAY_NAME} へのご登録ありがとうございます。</p>

        <p>以下の認証コードを入力して、アカウント登録を完了してください。</p>

        <div class="otp-code">{otp_code}</div>

        <p style="color: #666; font-size: 14px;">このコードは10分間有効です。</p>

        <p style="color: #999; font-size: 12px; margin-top: 30px;">
            ※このメールに心当たりがない場合は、このメールを無視してください。
        </p>
    </div>
    <div class="footer">
        <p>{settings.APP_DISPLAY_NAME}</p>
    </div>
</body>
</html>
    """.strip()

    return await send_email(to_email, subject, body, html_body)
