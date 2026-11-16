"""Suivi : ventes et CA sur 30 jours (lecture seule Stripe)."""
import time
from . import stripe_api as st
s = st.call("GET", "checkout/sessions", {"limit": 100, "status": "complete", "created[gte]": int(time.time() - 30 * 86400)})["data"]
paid = [x for x in s if x.get("payment_status") == "paid"]
print(f"30 j : {len(paid)} ventes, CA {sum(x['amount_total'] for x in paid) / 100:.2f} €  (objectifs : 100 / 500 / 1000 € par mois)")
