"""Boucle de livraison : paiements Stripe -> histoire -> audio -> email.
Idempotent : l'état est stocké dans les metadata du PaymentIntent (pas de base de données).
Variables : STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID,
SMTP_USER, SMTP_PASSWORD, OWNER_EMAIL, REVIEW_MODE (1 = les histoires vont au propriétaire d'abord)."""
import os, time
from . import story, tts, mail, stripe_api as st
from .themes import BY_LABEL, BY_KEY

MAX_ATTEMPTS = 3

def field(session, key):
    for f in session.get("custom_fields", []):
        if f["key"] == key:
            t = f.get("type")
            return (f.get(t) or {}).get("value")
    return None

def theme_key(raw):
    if raw in BY_KEY: return raw
    return BY_LABEL[raw]["key"] if raw in BY_LABEL else "aventure"

def run(stripe=st.call, gen=story.generate, voice=tts.synthesize, send=mail.send, since_days=7, now=time.time):
    review = os.environ.get("REVIEW_MODE", "1") == "1"
    owner = os.environ.get("OWNER_EMAIL")
    done = failed = 0
    sessions = stripe("GET", "checkout/sessions", {"limit": 50, "status": "complete",
                      "created[gte]": int(now() - since_days * 86400)})["data"]
    for s in sessions:
        if s.get("payment_status") != "paid" or not s.get("payment_intent"):
            continue
        pi = stripe("GET", f"payment_intents/{s['payment_intent']}")
        md = pi.get("metadata", {})
        attempts = int(md.get("attempts", 0))
        if md.get("delivered") == "1" or attempts >= MAX_ATTEMPTS:
            continue
        name = story.clean_name(field(s, "prenom"))
        age = story.clean_age(field(s, "age"))
        tkey = theme_key(field(s, "situation"))
        email = (s.get("customer_details") or {}).get("email")
        try:
            title, body = gen(name, age, tkey)
            mp3 = voice(title, body)
            files = [(f"{name}-{tkey}.mp3", mp3, "audio/mpeg"), (f"{name}-{tkey}.txt", f"{title}\n\n{body}".encode(), "text/plain")]
            if review and owner:
                send(owner, f"[À valider] {name} ({age} ans) - {tkey} -> {email}", f"{title}\n\n{body}", files)
                stripe("POST", f"payment_intents/{pi['id']}", {"metadata[review_sent]": "1", "metadata[attempts]": MAX_ATTEMPTS})
            else:
                send(email, f"L'histoire du soir de {name} : {title}", mail.delivery_text(name, title), files)
                stripe("POST", f"payment_intents/{pi['id']}", {"metadata[delivered]": "1"})
            done += 1
        except Exception as e:  # nouvelle tentative au prochain passage
            failed += 1
            stripe("POST", f"payment_intents/{pi['id']}", {"metadata[attempts]": attempts + 1})
            if owner and attempts + 1 >= MAX_ATTEMPTS:
                send(owner, "[ALERTE] livraison échouée", f"Session {s['id']} ({email}) : {e}\nLivrer ou rembourser à la main.")
    return done, failed

if __name__ == "__main__":
    print("livrées/échecs :", run())
