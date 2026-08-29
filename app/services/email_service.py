import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

def send_verification_otp_email(recipient_email: str, otp_code: str, user_name: str = "Student") -> bool:
    smtp_user = settings.SMTP_USER.strip() if settings.SMTP_USER else ""
    smtp_password = settings.SMTP_PASSWORD.replace(" ", "").strip() if settings.SMTP_PASSWORD else ""

    if not smtp_user or not smtp_password:
        print(f"[DEV NOTICE] Gmail SMTP credentials not set in .env. Console OTP for {recipient_email}: {otp_code}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"{otp_code} is your NoteAI Verification Code"
        msg["From"] = f"NoteAI <{smtp_user}>"
        msg["To"] = recipient_email

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #090d16; color: #f1f5f9; padding: 20px; }}
            .card {{ max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; }}
            .logo {{ font-size: 22px; font-weight: 800; color: #818cf8; letter-spacing: -0.5px; margin-bottom: 20px; }}
            .otp-box {{ background: #1e1b4b; border: 1px dashed #6366f1; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #a5b4fc; text-align: center; padding: 16px; margin: 24px 0; font-family: monospace; }}
            .footer {{ font-size: 11px; color: #64748b; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px; }}
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">NoteAI • Google Classroom & DLM Studio</div>
            <p>Hello <strong>{user_name}</strong>,</p>
            <p>Thank you for registering on NoteAI. Use the 6-digit verification code below to activate your account:</p>
            
            <div class="otp-box">{otp_code}</div>
            
            <p style="font-size: 12px; color: #94a3b8;">This code is valid for 10 minutes. If you did not request this code, please ignore this email.</p>
            
            <div class="footer">
              © 2026 NoteAI Platform. All rights reserved.
            </div>
          </div>
        </body>
        </html>
        """

        part_html = MIMEText(html_content, "html")
        msg.attach(part_html)

        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, 465, timeout=15)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            server.starttls()

        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, recipient_email, msg.as_string())
        server.quit()

        print(f"[GMAIL OTP SERVICE] Successfully sent OTP verification email to {recipient_email}")
        return True
    except Exception as e:
        print(f"[GMAIL OTP SERVICE ERROR] Failed to send email to {recipient_email}: {e}")
        return False
