"""Paiements Stripe -> textes (Claude) -> voix (ElevenLabs) -> e-mail. Idempotent (metadata PaymentIntent).
Env : STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_F, ELEVENLABS_VOICE_M,
SMTP_USER, SMTP_PASSWORD, OWNER_EMAIL, REVIEW_MODE (1 = vous recevez d'abord les fichiers)."""
import os, time
from . import script, audio, mail, stripe_api as st
from .catalog import MESSAGE_TYPES, PACK

MAX_ATTEMPTS = 3

def field(session, key):
    for f in session.get("custom_fields", []):
        if f["key"] == key:
            return (f.get(f.get("type")) or {}).get("value")
    return None

def plan(session):
    """-> liste de (type_message, voix). Lien unitaire : champ 'message' = 'accueil_f' ; pack : champ 'voix'."""
    opt = field(session, "message")
    if opt:
        mtype, voice = opt.rsplit("_", 1)
        if mtype not in MESSAGE_TYPES or voice not in ("f", "m"): raise ValueError("option inconnue")
        return [(mtype, voice)]
    voice = field(session, "voix") or "f"
    return [(m, voice if voice in ("f", "m") else "f") for m in PACK]

def run(stripe=st.call, gen=script.generate, tts=audio.synthesize, wav=audio.to_wav_pbx, send=mail.send, since_days=7, now=time.time):
    review = os.environ.get("REVIEW_MODE", "1") == "1"
    owner = os.environ.get("OWNER_EMAIL")
    done = failed = 0
    sessions = stripe("GET", "checkout/sessions", {"limit": 50, "status": "complete", "created[gte]": int(now() - since_days * 86400)})["data"]
    for s in sessions:
        if s.get("payment_status") != "paid" or not s.get("payment_intent"):
            continue
        pi = stripe("GET", f"payment_intents/{s['payment_intent']}")
        md = pi.get("metadata", {})
        attempts = int(md.get("attempts", 0))
        if md.get("delivered") == "1" or md.get("review_sent") == "1" or attempts >= MAX_ATTEMPTS:
            continue
        company = script.clean(field(s, "entreprise"), 60) or "votre entreprise"
        infos = field(s, "infos") or ""
        email = (s.get("customer_details") or {}).get("email")
        try:
            scripts, files = [], []
            for mtype, voice in plan(s):
                txt = gen(company, mtype, infos)
                mp3 = tts(txt, os.environ[f"ELEVENLABS_VOICE_{voice.upper()}"])
                scripts.append((MESSAGE_TYPES[mtype]["label"], txt))
                files.append((f"{mtype}.mp3", mp3, "audio/mpeg"))
                w = wav(mp3)
                if w: files.append((f"{mtype}_standard-8khz.wav", w, "audio/wav"))
            body = mail.delivery_text(company, scripts)
            if review and owner:
                send(owner, f"[À valider] {company} -> {email}", body, files)
                stripe("POST", f"payment_intents/{pi['id']}", {"metadata[review_sent]": "1"})
            else:
                send(email, f"Vos messages vocaux {company} sont prêts", body, files)
                stripe("POST", f"payment_intents/{pi['id']}", {"metadata[delivered]": "1"})
            done += 1
        except Exception as e:
            failed += 1
            stripe("POST", f"payment_intents/{pi['id']}", {"metadata[attempts]": attempts + 1})
            if owner and attempts + 1 >= MAX_ATTEMPTS:
                send(owner, "[ALERTE] livraison échouée", f"Session {s['id']} ({email}) : {e}\nLivrer ou rembourser à la main.")
    return done, failed

if __name__ == "__main__":
    print("livrées/échecs :", run())
