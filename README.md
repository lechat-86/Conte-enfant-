# SHAÏ & GLOW — boutique en ligne

Boutique de beauté (parfums, brumes, parfums de maison, maquillage) : catalogue, panier, paiement Stripe, comptes clientes, espace d'administration (produits, stocks, commandes, réglages).

👉 **Tout est expliqué pas à pas dans [GUIDE.md](GUIDE.md).** Prototype Shopify (facultatif, hors production) : [GUIDE_SHOPIFY.md](GUIDE_SHOPIFY.md).

```bash
cp .env.example .env     # puis modifiez-le
npm start                # http://localhost:3000   (Node 22.13+ requis, aucune dépendance à installer)
npm test                 # test de bout en bout (faux Stripe inclus)
```
Admin : `/admin` (identifiants = `ADMIN_EMAIL` / `ADMIN_PASSWORD`).
