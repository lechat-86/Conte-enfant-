# Prototype Shopify (headless) — SHAÏ & GLOW

> **Statut : prototype. Rien n'est en production, rien n'a été supprimé.**
> Le site fonctionne en **deux modes** selon les variables d'environnement :
> - **Mode actuel** (par défaut) : base locale + admin + Stripe, comme avant.
> - **Mode Shopify** : actif seulement si `SHOPIFY_STORE_DOMAIN` et `SHOPIFY_STOREFRONT_TOKEN` sont définis. Retirez-les et vous revenez au mode actuel instantanément.

## 1. Sauvegarde
- **Code** : la version complète d'avant Shopify est le commit **`5c24f55`** (branche `claude/fervent-dirac-yby388`). L'historique n'est jamais réécrit : `git checkout 5c24f55` la restaure. *(La publication d'une étiquette Git a été refusée par le serveur ; le commit sert de repère.)*
- **Données** (base + photos) : `npm run backup` → `backups/sauvegarde-AAAAMMJJ-HHMM.tar.gz`. À lancer avant tout changement et régulièrement.

## 2. Ce qui est branché sur Shopify en mode Shopify
| Élément | Source |
|---|---|
| Produits, prix, photos, variantes (teintes…), disponibilité | Shopify (Storefront API) |
| Catégories | **Collections** Shopify dont le *handle* = l'adresse de la catégorie : `parfums`, `brumes`, `parfums-de-maison`, `maquillage` |
| Coups de cœur | Collection Shopify de handle **`coups-de-coeur`** |
| Panier | Panier Shopify (Cart API) ; l'identifiant est gardé dans la session |
| Paiement, taxes, livraison, e-mails de commande | Checkout hébergé par Shopify |
| Commandes, stocks, expéditions | Admin Shopify |
Inchangé : design, logo, couleurs, menus, pages (légales, FAQ, contact…), SEO, recherche, filtres, tri.
Nos comptes clientes sont masqués : **aucun compte n'est demandé** (voir §5).

## 3. Mise en place sur une boutique de développement gratuite
1. Créez un compte **Shopify Partners** (gratuit) puis une **boutique de développement**.
2. Dans cette boutique, créez les 5 **collections** ci-dessus (type manuel, handles exacts) et le produit Prady (prix 4,90 €, prix de revient 1,95 €, stock, vos photos, ajouté à `brumes` et, si voulu, `coups-de-coeur`).
3. Obtenez un **jeton Storefront** (public) : installez le canal **Headless** (ou créez une application) et créez une vitrine. Autorisations à cocher : lecture des produits/collections, **création et lecture des paniers (checkout)**, et lecture de l'inventaire si vous voulez « Plus que N » (puis `SHOPIFY_INVENTORY=1`). *Les noms exacts des autorisations sont à vérifier dans la [doc des scopes](https://shopify.dev/docs/api/usage/access-scopes).*
4. Dans `.env` : `SHOPIFY_STORE_DOMAIN=votre-boutique.myshopify.com` et `SHOPIFY_STOREFRONT_TOKEN=…` (jamais dans le chat ni dans Git). `npm start`.
5. Essayez sans Shopify : `node test/shopify-simulator.mjs` puis lancez le site avec `SHOPIFY_STORE_DOMAIN=demo.myshopify.com SHOPIFY_STOREFRONT_TOKEN=tok_test SHOPIFY_API_BASE=http://localhost:3928`.

## 4. ⚠️ Test du paiement : une limite importante
D'après la documentation Shopify, **sur une boutique de développement on ne teste le paiement qu'avec le « Bogus Gateway »** (ou un prestataire tiers en mode test) ; **le mode test de Shopify Payments exige un abonnement payant** ([test orders](https://help.shopify.com/partners/dashboard/test-orders-in-dev-stores), [Testing Shopify Payments](https://help.shopify.com/en/manual/payments/shopify-payments/testing-shopify-payments), [changelog](https://shopify.dev/changelog/changes-to-order-and-payment-testing-on-all-development-stores.md)).
Donc, gratuitement, vous validez : catalogue, collections, panier, redirection vers le checkout, commande de test (Bogus), gestion des commandes/stocks. **Vous ne validez pas** le vrai flux Shopify Payments (virements, carte réelle, vérification d'identité) : cela se fera au moment de passer sur un plan payant (essai / premier mois).

## 5. Pas de compte obligatoire
Le site ne demande aucun compte. Dans l'admin Shopify → **Paramètres → Paiement (Checkout) → Comptes clients**, choisissez **« Désactivés »** ou **« Facultatifs »** (jamais « Obligatoires »). *(Libellés à vérifier dans votre admin.)*

## 6. Limites connues du prototype
- **Testé uniquement contre un simulateur** de la Storefront API (vérifications automatiques : `npm test`). Il reste à valider sur une vraie boutique : noms de champs, autorisations du jeton, version d'API (`2025-07`, modifiable via `SHOPIFY_API_VERSION`).
- Le checkout reste au design Shopify (logo/couleurs/polices via l'éditeur de checkout).
- Les frais de livraison ne sont connus qu'au checkout (le panier affiche « Calculée au paiement »). Réglez-les dans Shopify → Paramètres → Expédition.
- Catalogue lu par lots de 100, jusqu'à 500 produits, avec un cache de 30 s ; au-delà, il faudra paginer côté collection.
- Les pages légales (CGV, mentions…) restent sur le site ; Shopify exige aussi ses propres politiques (retours, confidentialité, conditions) dans ses réglages : remplissez-les de façon cohérente.
- L'ancien admin (produits/stocks/commandes locaux) reste accessible mais **inutilisé** en mode Shopify ; un bandeau l'indique. Le tableau de bord de marge n'existe pas côté Shopify (utilisez « prix de revient » + rapports Shopify).
- Plus de sauvegardes de catalogue à faire côté site : Shopify les gère. Les messages du formulaire de contact restent locaux.

## 7. À vérifier officiellement avant tout lancement (je n'ai pas pu confirmer ces points)
- [ ] **Tarif réel** de l'abonnement, de l'essai et des frais Shopify Payments en France : <https://www.shopify.com/fr/tarifs>
- [ ] **Frais supplémentaires** si vous n'utilisez pas Shopify Payments (environ 2 % sur Basic d'après une source tierce).
- [ ] **Éligibilité de votre activité à Shopify Payments** (cosmétiques, parfums ; allégations santé interdites) : <https://help.shopify.com/manual/payments/shopify-payments/eligibility>
- [ ] **Expédition de parfums / produits à base d'alcool** avec votre transporteur.
- [ ] **Conditions d'utilisation** de Shopify et politique d'usage acceptable.
- [ ] Qu'une **cliente ne soit jamais obligée de créer un compte** sur le checkout (paramètre §5).
- [ ] Un **test de commande complet** sur la boutique de développement (Bogus Gateway), puis sur le plan payant en mode test de Shopify Payments, avant d'ouvrir.
- [ ] Le **domaine** : le checkout peut s'afficher sur un autre domaine que le vôtre (redirection visible).
- [ ] Déclarations légales : mentions de la boutique, médiateur, TVA (franchise en base / assujettie) cohérents avec les réglages Shopify.
