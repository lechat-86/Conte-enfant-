"""Demande d'avis automatique, 7 à 14 jours après une livraison réussie (une seule fois, avec désinscription).
Env : REVIEW_URL (lien de dépôt d'avis, ex. Google/Trustpilot), + variables SMTP et Stripe. Aucun avis n'est jamais écrit à la place du client."""
import os, time
from . import mail, brand, stripe_api as st

def run(stripe=st.call, send=mail.send, now=time.time):
    url = os.environ.get("REVIEW_URL")
    if not url or os.environ.get("REVIEW_MODE", "1") == "1":
        return 0                                   # pas de relance tant que la livraison manuelle est active
    n = 0
    sessions = stripe("GET", "checkout/sessions", {"limit": 100, "status": "complete",
        "created[gte]": int(now() - 14 * 86400), "created[lte]": int(now() - 7 * 86400)})["data"]
    for s in sessions:
        if s.get("payment_status") != "paid" or not s.get("payment_intent"): continue
        pi = stripe("GET", f"payment_intents/{s['payment_intent']}")
        md = pi.get("metadata", {})
        email = (s.get("customer_details") or {}).get("email")
        if md.get("delivered") != "1" or md.get("review_asked") == "1" or not email: continue
        send(email, f"Vos messages {brand.NAME} : un petit avis ?",
             f"Bonjour,\n\nvos messages vocaux sont installés depuis quelques jours. Votre retour nous aide beaucoup : "
             f"si vous avez 1 minute, laissez un avis honnête ici : {url}\n"
             f"Un souci ou une modification ? Répondez simplement à ce mail.\n\n— {brand.NAME}\n"
             f"(Message unique lié à votre commande. Pour ne plus rien recevoir : répondez « STOP ».)\n")
        stripe("POST", f"payment_intents/{pi['id']}", {"metadata[review_asked]": "1"})
        n += 1
    return n

if __name__ == "__main__":
    print("demandes d'avis envoyées :", run())
