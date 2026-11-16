"""Crée produit + prix + lien de paiement Stripe (aucune dépense, aucun abonnement).
Usage : STRIPE_SECRET_KEY=sk_... python -m engine.setup_stripe
Prérequis dashboard : renseigner l'URL des CGV (Paramètres > Public details) pour la case de consentement."""
from . import brand, stripe_api as st
from .themes import THEMES

def main():
    prod = st.call("POST", "products", {"name": f"Histoire du soir personnalisée (audio + texte) - {brand.NAME}",
        "description": "Une histoire originale dont votre enfant est le héros, en MP3 + texte, livrée par e-mail."})
    price = st.call("POST", "prices", {"product": prod["id"], "currency": "eur", "unit_amount": int(round(brand.PRICE_EUR * 100))})
    p = {"line_items[0][price]": price["id"], "line_items[0][quantity]": 1,
         "custom_fields[0][key]": "prenom", "custom_fields[0][label][type]": "custom",
         "custom_fields[0][label][custom]": "Prénom de l'enfant", "custom_fields[0][type]": "text",
         "custom_fields[1][key]": "age", "custom_fields[1][label][type]": "custom",
         "custom_fields[1][label][custom]": "Âge de l'enfant (2 à 10)", "custom_fields[1][type]": "numeric",
         "custom_fields[2][key]": "situation", "custom_fields[2][label][type]": "custom",
         "custom_fields[2][label][custom]": "De quoi parle l'histoire ?", "custom_fields[2][type]": "dropdown",
         "custom_text[submit][message]": "Contenu numérique livré immédiatement par e-mail : en payant, vous acceptez son exécution immédiate et renoncez à votre droit de rétractation (art. L221-28 13° Code de la consommation).",
         "after_completion[type]": "redirect", "after_completion[redirect][url]": f"{brand.DOMAIN}/merci.html"}
    for i, t in enumerate(THEMES):
        p[f"custom_fields[2][dropdown][options][{i}][label]"] = t["label"]
        p[f"custom_fields[2][dropdown][options][{i}][value]"] = t["key"]
    link = st.call("POST", "payment_links", p)
    print("Lien de paiement à mettre dans site/config.js :", link["url"])

if __name__ == "__main__":
    main()
