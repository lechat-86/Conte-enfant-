"""Suivi : ventes / CA sur 30 jours, par offre et par partenaire (client_reference_id = code partenaire)."""
import collections, time
from . import stripe_api as st

def summary(stripe=st.call, now=time.time):
    s = stripe("GET", "checkout/sessions", {"limit": 100, "status": "complete", "created[gte]": int(now() - 30 * 86400)})["data"]
    paid = [x for x in s if x.get("payment_status") == "paid"]
    by_ref = collections.Counter(); ca_ref = collections.Counter()
    for x in paid:
        ref = x.get("client_reference_id") or "direct"
        by_ref[ref] += 1; ca_ref[ref] += x["amount_total"] / 100
    return len(paid), sum(x["amount_total"] for x in paid) / 100, {r: (by_ref[r], ca_ref[r]) for r in by_ref}

if __name__ == "__main__":
    n, ca, refs = summary()
    print(f"30 j : {n} ventes, CA {ca:.2f} €  (objectifs : 100 / 500 / 1000 € par mois)")
    for r, (c, v) in sorted(refs.items(), key=lambda kv: -kv[1][1]): print(f"  {r:<20} {c} vente(s)  {v:.2f} €")
