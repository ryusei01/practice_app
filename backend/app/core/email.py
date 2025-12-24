"""
メール送信機能
"""
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
import logging
import time

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
                # #region agent log
                with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                    import json
                    log_file.write(json.dumps({
                        "timestamp": int(time.time() * 1000),
                        "location": "email.py:73",
                        "message": "EMAIL: Attempting to send email",
                        "data": {"to_email": to_email, "attempt": attempt + 1, "max_retries": MAX_RETRIES + 1, "hypothesisId": "A"},
                        "sessionId": "debug-session",
                        "runId": "run1"
                    }, ensure_ascii=False) + "\n")
                # #endregion
                logger.info(f"[EMAIL] Attempting to send email to {to_email} (attempt {attempt + 1}/{MAX_RETRIES + 1})")
                
                # SMTPサーバーに接続（タイムアウト設定付き）
                # #region agent log
                with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                    log_file.write(json.dumps({
                        "timestamp": int(time.time() * 1000),
                        "location": "email.py:78",
                        "message": "EMAIL: Before SMTP connection",
                        "data": {"host": settings.SMTP_HOST, "port": settings.SMTP_PORT, "timeout": SMTP_TIMEOUT, "user": settings.SMTP_USER[:3] + "***" if settings.SMTP_USER else None, "hypothesisId": "A"},
                        "sessionId": "debug-session",
                        "runId": "run1"
                    }, ensure_ascii=False) + "\n")
                # #endregion
                # SMTPサーバーに接続（タイムアウト設定付き）
                # NOTE: ここで「本当にsmtp.gmail.com:587に到達しているか」を確定するため、
                # connect()の戻り値(バナー)と接続先IPをログに出す
                # #region agent log
                with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                    log_file.write(json.dumps({
                        "timestamp": int(time.time() * 1000),
                        "location": "email.py:101",
                        "message": "EMAIL: Before SMTP() connect",
                        "data": {"host": settings.SMTP_HOST, "port": settings.SMTP_PORT, "timeout": SMTP_TIMEOUT, "hypothesisId": "A"},
                        "sessionId": "debug-session",
                        "runId": "run1"
                    }, ensure_ascii=False) + "\n")
                # #endregion
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
                # #region agent log
                try:
                    peer = server.sock.getpeername() if getattr(server, "sock", None) else None
                except Exception:
                    peer = None
                with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                    log_file.write(json.dumps({
                        "timestamp": int(time.time() * 1000),
                        "location": "email.py:112",
                        "message": "EMAIL: SMTP connected (banner + peer)",
                        "data": {
                            "connect_code": connect_code,
                            "connect_banner": (connect_msg.decode("utf-8", "ignore") if isinstance(connect_msg, (bytes, bytearray)) else str(connect_msg))[:120] if connect_msg is not None else None,
                            "peer": peer,
                            "local_hostname": getattr(server, "local_hostname", None),
                            "_host": getattr(server, "_host", None),
                            "hypothesisId": "A"
                        },
                        "sessionId": "debug-session",
                        "runId": "run1"
                    }, ensure_ascii=False) + "\n")
                # #endregion
                
                # #region agent log
                with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                    log_file.write(json.dumps({
                        "timestamp": int(time.time() * 1000),
                        "location": "email.py:103",
                        "message": "EMAIL: SMTP() initialized, checking state",
                        "data": {
                            "ehlo_resp": server.ehlo_resp if hasattr(server, 'ehlo_resp') else None,
                            "does_esmtp": server.does_esmtp if hasattr(server, 'does_esmtp') else None,
                            "has_extn": server.has_extn('starttls') if hasattr(server, 'has_extn') else None,
                            "hypothesisId": "A"
                        },
                        "sessionId": "debug-session",
                        "runId": "run1"
                    }, ensure_ascii=False) + "\n")
                # #endregion
                
                # 明示的にEHLOを送信（初期化時に送信されていない可能性があるため）
                try:
                    ehlo_response = server.ehlo()
                    # #region agent log
                    with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                        log_file.write(json.dumps({
                            "timestamp": int(time.time() * 1000),
                            "location": "email.py:132",
                            "message": "EMAIL: EHLO completed",
                            "data": {
                                "ehlo_code": ehlo_response[0] if ehlo_response else None,
                                "ehlo_msg": (ehlo_response[1].decode("utf-8", "ignore") if ehlo_response and isinstance(ehlo_response[1], (bytes, bytearray)) else str(ehlo_response[1]))[:200] if ehlo_response and len(ehlo_response) > 1 else None,
                                "does_esmtp": server.does_esmtp if hasattr(server, 'does_esmtp') else None,
                                "has_starttls": server.has_extn('starttls') if hasattr(server, 'has_extn') else None,
                                "hypothesisId": "A"
                            },
                            "sessionId": "debug-session",
                            "runId": "run1"
                        }, ensure_ascii=False) + "\n")
                    # #endregion
                except Exception as ehlo_error:
                    # EHLOが失敗した場合、HELOを試す
                    # #region agent log
                    with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                        log_file.write(json.dumps({
                            "timestamp": int(time.time() * 1000),
                            "location": "email.py:151",
                            "message": "EMAIL: EHLO failed, trying HELO",
                            "data": {
                                "error": str(ehlo_error),
                                "error_type": type(ehlo_error).__name__,
                                "hypothesisId": "A"
                            },
                            "sessionId": "debug-session",
                            "runId": "run1"
                        }, ensure_ascii=False) + "\n")
                    # #endregion
                    try:
                        server.helo()
                    except Exception:
                        pass  # HELOも失敗する可能性があるが、続行する
                
                try:
                    # Gmailは常にSTARTTLSをサポートしているため、
                    # has_extn('starttls')がFalseでもSTARTTLSを試す
                    # （ネットワーク環境によってはEHLOの応答が正しくない場合がある）
                    
                    # STARTTLSを使用して暗号化接続
                    # #region agent log
                    with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                        log_file.write(json.dumps({
                            "timestamp": int(time.time() * 1000),
                            "location": "email.py:178",
                            "message": "EMAIL: Before STARTTLS (trying even if has_extn returns False for Gmail)",
                            "data": {
                                "does_esmtp": server.does_esmtp if hasattr(server, 'does_esmtp') else None,
                                "has_starttls": server.has_extn('starttls') if hasattr(server, 'has_extn') else None,
                                "_host": getattr(server, "_host", None),
                                "hypothesisId": "A"
                            },
                            "sessionId": "debug-session",
                            "runId": "run1"
                        }, ensure_ascii=False) + "\n")
                    # #endregion
                    # 明示的にTLSコンテキストを渡す（環境差異の切り分けもしやすい）
                    tls_context = ssl.create_default_context()
                    server.starttls(context=tls_context)
                    # STARTTLS後は再度EHLOが必要
                    server.ehlo()
                    # #region agent log
                    with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                        log_file.write(json.dumps({
                            "timestamp": int(time.time() * 1000),
                            "location": "email.py:157",
                            "message": "EMAIL: STARTTLS succeeded, second EHLO completed",
                            "data": {"hypothesisId": "A"},
                            "sessionId": "debug-session",
                            "runId": "run1"
                        }, ensure_ascii=False) + "\n")
                    # #endregion
                    # #region agent log
                    with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                        log_file.write(json.dumps({
                            "timestamp": int(time.time() * 1000),
                            "location": "email.py:116",
                            "message": "EMAIL: STARTTLS completed, before login",
                            "data": {"hypothesisId": "A"},
                            "sessionId": "debug-session",
                            "runId": "run1"
                        }, ensure_ascii=False) + "\n")
                    # #endregion
                    # #region agent log
                    with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                        log_file.write(json.dumps({
                            "timestamp": int(time.time() * 1000),
                            "location": "email.py:118",
                            "message": "EMAIL: Before login",
                            "data": {"hypothesisId": "B"},
                            "sessionId": "debug-session",
                            "runId": "run1"
                        }, ensure_ascii=False) + "\n")
                    # #endregion
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    # #region agent log
                    with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                        log_file.write(json.dumps({
                            "timestamp": int(time.time() * 1000),
                            "location": "email.py:115",
                            "message": "EMAIL: Login successful, before send_message",
                            "data": {"hypothesisId": "C"},
                            "sessionId": "debug-session",
                            "runId": "run1"
                        }, ensure_ascii=False) + "\n")
                    # #endregion
                    server.send_message(message)
                    # #region agent log
                    with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                        log_file.write(json.dumps({
                            "timestamp": int(time.time() * 1000),
                            "location": "email.py:117",
                            "message": "EMAIL: send_message completed successfully",
                            "data": {"hypothesisId": "C"},
                            "sessionId": "debug-session",
                            "runId": "run1"
                        }, ensure_ascii=False) + "\n")
                    # #endregion
                    logger.info(f"Email sent successfully to {to_email}")
                    return True
                finally:
                    try:
                        # #region agent log
                        with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                            log_file.write(json.dumps({
                                "timestamp": int(time.time() * 1000),
                                "location": "email.py:88",
                                "message": "EMAIL: Before server.quit()",
                                "data": {"hypothesisId": "D"},
                                "sessionId": "debug-session",
                                "runId": "run1"
                            }, ensure_ascii=False) + "\n")
                        # #endregion
                        server.quit()
                        # #region agent log
                        with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                            log_file.write(json.dumps({
                                "timestamp": int(time.time() * 1000),
                                "location": "email.py:89",
                                "message": "EMAIL: server.quit() completed",
                                "data": {"hypothesisId": "D"},
                                "sessionId": "debug-session",
                                "runId": "run1"
                            }, ensure_ascii=False) + "\n")
                        # #endregion
                    except Exception as quit_error:
                        # #region agent log
                        with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                            log_file.write(json.dumps({
                                "timestamp": int(time.time() * 1000),
                                "location": "email.py:90",
                                "message": "EMAIL: server.quit() failed",
                                "data": {"error": str(quit_error), "hypothesisId": "D"},
                                "sessionId": "debug-session",
                                "runId": "run1"
                            }, ensure_ascii=False) + "\n")
                        # #endregion
                        pass
                        
            except smtplib.SMTPConnectError as e:
                last_error = f"SMTP connection error: {str(e)}"
                # #region agent log
                with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                    import json
                    log_file.write(json.dumps({
                        "timestamp": int(time.time() * 1000),
                        "location": "email.py:92",
                        "message": "EMAIL: SMTPConnectError caught",
                        "data": {"error": str(e), "error_type": type(e).__name__, "attempt": attempt + 1, "hypothesisId": "A"},
                        "sessionId": "debug-session",
                        "runId": "run1"
                    }, ensure_ascii=False) + "\n")
                # #endregion
                logger.warning(f"[EMAIL] {last_error} (attempt {attempt + 1}/{MAX_RETRIES + 1})")
            except smtplib.SMTPAuthenticationError as e:
                last_error = f"SMTP authentication error: {str(e)}"
                # #region agent log
                with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                    log_file.write(json.dumps({
                        "timestamp": int(time.time() * 1000),
                        "location": "email.py:95",
                        "message": "EMAIL: SMTPAuthenticationError caught",
                        "data": {"error": str(e), "error_type": type(e).__name__, "hypothesisId": "B"},
                        "sessionId": "debug-session",
                        "runId": "run1"
                    }, ensure_ascii=False) + "\n")
                # #endregion
                logger.error(f"[EMAIL] {last_error}")
                # 認証エラーはリトライしない
                break
            except smtplib.SMTPServerDisconnected as e:
                last_error = f"SMTP server disconnected: {str(e)}"
                # #region agent log
                with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                    log_file.write(json.dumps({
                        "timestamp": int(time.time() * 1000),
                        "location": "email.py:100",
                        "message": "EMAIL: SMTPServerDisconnected caught",
                        "data": {"error": str(e), "error_type": type(e).__name__, "attempt": attempt + 1, "hypothesisId": "A"},
                        "sessionId": "debug-session",
                        "runId": "run1"
                    }, ensure_ascii=False) + "\n")
                # #endregion
                logger.warning(f"[EMAIL] {last_error} (attempt {attempt + 1}/{MAX_RETRIES + 1})")
            except smtplib.SMTPException as e:
                last_error = f"SMTP error: {str(e)}"
                # #region agent log
                with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                    log_file.write(json.dumps({
                        "timestamp": int(time.time() * 1000),
                        "location": "email.py:103",
                        "message": "EMAIL: SMTPException caught",
                        "data": {"error": str(e), "error_type": type(e).__name__, "attempt": attempt + 1, "hypothesisId": "C"},
                        "sessionId": "debug-session",
                        "runId": "run1"
                    }, ensure_ascii=False) + "\n")
                # #endregion
                logger.warning(f"[EMAIL] {last_error} (attempt {attempt + 1}/{MAX_RETRIES + 1})")
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"
                # #region agent log
                with open('h:\\document\\program\\project\\practice_app\\.cursor\\debug.log', 'a', encoding='utf-8') as log_file:
                    log_file.write(json.dumps({
                        "timestamp": int(time.time() * 1000),
                        "location": "email.py:106",
                        "message": "EMAIL: Unexpected exception caught",
                        "data": {"error": str(e), "error_type": type(e).__name__, "attempt": attempt + 1, "hypothesisId": "E"},
                        "sessionId": "debug-session",
                        "runId": "run1"
                    }, ensure_ascii=False) + "\n")
                # #endregion
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
