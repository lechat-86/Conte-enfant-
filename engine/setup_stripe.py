"""Crée les 2 produits + liens de paiement Stripe (aucune dépense). STRIPE_SECRET_KEY=sk_... python3 -m engine.setup_stripe"""
from . import brand, catalog, stripe_api as st

CONSENT = ("Contenu numérique livré immédiatement par e-mail : en payant, vous acceptez son exécution immédiate "
           "et renoncez à votre droit de rétractation (art. L221-28 13° Code de la consommation).")

def link(name, price, fields):
    prod = st.call("POST", "products", {"name": f"{name} - {brand.NAME}"})
    pr = st.call("POST", "prices", {"product": prod["id"], "currency": "eur", "unit_amount": price * 100})
    p = {"line_items[0][price]": pr["id"], "line_items[0][quantity]": 1, "custom_text[submit][message]": CONSENT,
         "after_completion[type]": "redirect", "after_completion[redirect][url]": f"{brand.DOMAIN}/merci.html"}
    for i, (key, label, typ, opts) in enumerate(fields):
        p.update({f"custom_fields[{i}][key]": key, f"custom_fields[{i}][label][type]": "custom",
                  f"custom_fields[{i}][label][custom]": label, f"custom_fields[{i}][type]": typ})
        if typ == "text": p[f"custom_fields[{i}][text][maximum_length]"] = 255 if key == "infos" else 60
        for j, (v, l) in enumerate(opts or []):
            p[f"custom_fields[{i}][dropdown][options][{j}][value]"] = v
            p[f"custom_fields[{i}][dropdown][options][{j}][label]"] = l
    return st.call("POST", "payment_links", p)["url"]

def main():
    ent = ("entreprise", "Nom de l'entreprise", "text", None)
    infos = ("infos", "Infos à citer (horaires, services, dates)", "text", None)
    print("SINGLE =", link("Message vocal professionnel", brand.PRICE_SINGLE,
        [ent, ("message", "Type de message et voix", "dropdown", catalog.SINGLE_OPTIONS), infos]))
    print("PACK   =", link("Pack 3 messages vocaux (accueil + hors horaires + attente)", brand.PRICE_PACK,
        [ent, ("voix", "Voix", "dropdown", [("f", "Voix féminine"), ("m", "Voix masculine")]), infos]))

if __name__ == "__main__":
    main()
