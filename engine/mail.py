import os, smtplib
from email.message import EmailMessage
from . import brand

def send(to, subject, text, attachments=(), smtp=None):
    msg = EmailMessage()
    msg["From"] = os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", ""))
    msg["To"], msg["Subject"] = to, subject
    msg.set_content(text)
    for fname, data, mime in attachments:
        main, sub = mime.split("/")
        msg.add_attachment(data, maintype=main, subtype=sub, filename=fname)
    if smtp:
        smtp(msg); return
    with smtplib.SMTP_SSL(os.environ.get("SMTP_HOST", "smtp.gmail.com"), 465) as s:
        s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        s.send_message(msg)

def delivery_text(name, title):
    return (f"Bonjour,\n\nVoici l'histoire du soir de {name} : « {title} ».\n"
            f"Vous trouverez en pièce jointe la version audio (MP3) et le texte à lire vous-même.\n\n"
            f"Conseil : écoutez-la ensemble au coucher, lumière tamisée.\n"
            f"Cette histoire est générée avec l'aide d'une intelligence artificielle (voix de synthèse incluse) "
            f"et relue automatiquement. Un souci ? Répondez à ce mail, nous corrigeons ou remboursons.\n\n"
            f"Pour un usage strictement personnel et familial.\n— {brand.NAME}\n")
