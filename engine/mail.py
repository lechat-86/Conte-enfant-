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

def delivery_text(company, scripts):
    body = "\n\n".join(f"— {label} —\n{txt}" for label, txt in scripts)
    return (f"Bonjour,\n\nvos messages vocaux pour {company} sont prêts. Vous trouverez en pièces jointes, pour chacun :\n"
            f"• un fichier MP3 (téléphonie moderne, box, applications)\n• un fichier WAV 8 kHz mono (standards téléphoniques classiques)\n\n"
            f"Textes enregistrés :\n\n{body}\n\n"
            f"Relisez attentivement (horaires, noms) : le texte est rédigé à partir de vos informations avec l'aide d'une IA, la voix est synthétique.\n"
            f"Une modification de texte offerte : répondez à ce mail en indiquant ce que vous souhaitez changer.\n"
            f"Si le résultat ne vous convient pas, nous vous remboursons.\n\n— {brand.NAME}\n")
