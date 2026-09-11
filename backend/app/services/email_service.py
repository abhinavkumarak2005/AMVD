import os
from email.message import EmailMessage
import aiosmtplib
from app.core.config import settings
import logging

async def send_email(to_email: str, subject: str, html_content: str, attachment_path: str = None):
    """
    Sends an email with an optional attachment.
    Falls back to logging to console if SMTP credentials are not configured.
    """
    
    msg = EmailMessage()
    msg['From'] = f"Sri Manakula Vinayagar Devasthanam <{settings.SMTP_FROM_EMAIL}>"
    msg['To'] = to_email
    msg['Subject'] = subject
    
    msg.add_alternative(html_content, subtype='html')
    
    if attachment_path and os.path.exists(attachment_path):
        with open(attachment_path, 'rb') as f:
            pdf_data = f.read()
        
        msg.add_attachment(
            pdf_data, 
            maintype='application', 
            subtype='pdf', 
            filename=os.path.basename(attachment_path)
        )
        
    if not settings.SMTP_HOST or not settings.SMTP_PASSWORD:
        print(f"SMTP not configured. Email to {to_email} with subject '{subject}' logged instead.", flush=True)
        print(f"--- EMAIL MOCK ---")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Attachment: {attachment_path}")
        print(f"Content: {html_content}")
        print(f"------------------")
        return True

    try:
        import ssl
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=False,
            start_tls=True,
            tls_context=context,
            timeout=10
        )
        print(f"Email successfully sent to {to_email}", flush=True)
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}", flush=True)
        return False
