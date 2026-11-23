# Guide SHAÏ & GLOW — du premier lancement à la mise en ligne

## 0. Ce que vous avez
- **Boutique** : accueil, catégories, fiches produits, recherche, panier, paiement, espace client (inscription, commandes, mot de passe oublié), pages légales (CGV, mentions légales, confidentialité, livraison, retours, FAQ, contact).
- **Espace admin** (`/admin`, utilisable sur téléphone) : ajouter / modifier / supprimer des produits et photos, catégories, **stocks** (réceptions, casse, historique), commandes (à préparer → expédiée + n° de suivi + e-mail à la cliente, remboursement, bon de préparation à imprimer), clientes, messages, réglages. Le tableau de bord affiche ventes, **marge**, valeur du stock et une liste « avant l'ouverture ».
- **Sécurité** : paiement par carte sur la page Stripe (vos clientes ne saisissent jamais leur carte chez vous), prix recalculés côté serveur, stock réservé 45 min pendant le paiement, mots de passe chiffrés, protection CSRF.
- Aucun faux produit, faux avis ou faux chiffre : un seul produit (le vôtre), et les cases légales sont **vides, marquées « à compléter »** jusqu'à ce que vous les remplissiez.

## 1. Essayer chez vous (10 min)
1. Installez Node.js 22 ou plus (nodejs.org).
2. Dans le dossier du projet : `cp .env.example .env`, ouvrez `.env`, mettez votre e-mail et un long mot de passe dans `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
3. `npm start` → ouvrez http://localhost:3000 (boutique) et http://localhost:3000/admin (admin).

## 2. Votre logo
Admin → **Réglages → Logo → Choisir mon logo** (PNG à fond transparent idéalement). Sans logo, le nom s'affiche en lettres élégantes rose gold. *(Je n'ai pas pu récupérer votre fichier de logo : il n'était pas dans le dépôt.)*

## 3. Votre premier produit
Il est déjà créé : **Prady Monoï Tiaré 250 ml, 4,90 €, achat 1,95 €**. Dans Admin → Produits :
- ajoutez **vos photos** (les photos du fournisseur ne sont utilisables qu'avec son autorisation) ;
- recopiez la **composition (INCI), précautions et contenance** depuis l'emballage dans la description : c'est une obligation d'information pour les cosmétiques ;
- **le stock est réglé sur 12** (votre lot) : corrigez-le à la réception réelle (Admin → Stocks).

> **Calcul réaliste** : 4,90 € − 1,95 € = 2,95 € de marge brute. Les frais Stripe (environ 1,5 % + 0,25 € pour une carte européenne, à vérifier sur stripe.com/fr/pricing) en retirent ~0,32 €, puis l'emballage et l'envoi. Les frais de livraison facturés (réglés par défaut à 4,90 €, offerts dès 40 € — **à adapter à votre transporteur dans Réglages**) doivent couvrir votre coût d'envoi réel. Vérifiez ce calcul avant de lancer ; un panier moyen plus élevé (lots, 2e produit) est ce qui rend la boutique rentable.

## 4. Remplir les réglages
Admin → **Réglages** : e-mail de contact, raison sociale / SIRET / adresse, régime de TVA (franchise en base par défaut), hébergeur, médiateur de la consommation, délais, adresse de retour, frais de port. Le tableau de bord vous indique ce qu'il reste.
⚠️ Les pages légales sont des **modèles conformes aux obligations courantes**, pas un avis juridique : faites-les relire (CCI, expert-comptable). Pensez aussi à votre statut (micro-entreprise) et, pour les cosmétiques, à vérifier que vos fournisseurs vous fournissent des produits conformes au règlement européen (étiquetage en français). Les parfums à base d'alcool peuvent avoir des restrictions d'envoi : renseignez-vous auprès de votre transporteur.

## 5. Paiement sécurisé (Stripe)
1. Créez un compte sur **stripe.com** (entreprise, IBAN pour recevoir les virements).
2. Développeurs → Clés API : copiez la clé **secrète** de test (`sk_test_…`) dans `STRIPE_SECRET_KEY`.
3. Développeurs → Webhooks → « Ajouter un endpoint » : URL `https://VOTRE-SITE/stripe/webhook`, événements : `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`. Copiez le « secret de signature » (`whsec_…`) dans `STRIPE_WEBHOOK_SECRET`.
4. Testez avec la carte `4242 4242 4242 4242` (date future, CVC quelconque).
5. Une fois Stripe activé en mode réel, remplacez par la clé `sk_live_…` et refaites le webhook en mode réel.
*(Je n'ai pu tester le paiement qu'avec un faux Stripe : faites impérativement une commande test avec vos clés avant d'ouvrir.)*

## 6. E-mails (confirmation, expédition, alerte « nouvelle commande »)
Créez un compte gratuit sur **resend.com**, vérifiez votre domaine, puis renseignez `RESEND_API_KEY` et `MAIL_FROM` (ex. `SHAÏ & GLOW <commandes@votre-domaine.fr>`). Sans cela le site marche, mais aucun e-mail n'est envoyé : vous devrez consulter l'admin pour voir les commandes.

## 7. Mise en ligne
Le site stocke ses données dans un dossier (`DATA_DIR` : base + photos) : l'hébergeur doit offrir un **disque persistant**, sinon vous perdriez tout à chaque redémarrage.
**Option simple — Render.com** (offre payante nécessaire pour le disque, quelques €/mois) :
1. Mettez ce dépôt sur GitHub (déjà fait ici). 2. Render → New → **Blueprint** → choisissez le dépôt (`render.yaml` configure tout, disque inclus). 3. Renseignez les variables (`SITE_URL`=`https://votre-site.onrender.com`, admin, Stripe, e-mails). 4. Ouvrez l'URL, connectez-vous sur `/admin`.
Alternatives : Railway ou Fly.io (avec volume), ou un petit VPS (`docker build -t shai . && docker run -d -p 80:3000 -v shai-data:/data --env-file .env shai`).
**Nom de domaine** (ex. shai-and-glow.fr, ~10 €/an) : achetez-le (OVH, Gandi…), ajoutez-le dans Render → Custom Domains, mettez à jour `SITE_URL` et l'URL du webhook Stripe. Le HTTPS est automatique.
**Sauvegardes** : copiez régulièrement le dossier `data/` (disque Render → snapshots ou téléchargement).

## 8. Votre quotidien
1. Une commande payée arrive → e-mail + pastille rouge dans l'admin.
2. Commandes → ouvrir → **imprimer le bon de préparation** (adresse en gros pour l'étiquette) → emballer.
3. Déposer le colis, saisir transporteur + n° de suivi → **Expédiée** (la cliente est prévenue).
4. Stock reçu ? Admin → Stocks → `+12` « Réception fournisseur ».
5. Remboursement : ouvrir la commande → Rembourser (via Stripe, avec remise en stock optionnelle).
Changer votre mot de passe admin : modifiez `ADMIN_PASSWORD` et redéployez.

## 9. Sans lives, sans visage, sans voix (TikTok / Instagram)
Vidéos « mains seules » : ouverture du colis, vaporisation du flacon en gros plan, routine du soir en texte à l'écran, ambiance + musique libre de droits, photos du produit avec texte. Le lien de la boutique va dans votre bio (Réglages → liens réseaux pour les afficher dans le pied de page).
Ne publiez pas d'avis ou de promesses (« anti-âge », « sans allergie »…) que vous ne pouvez pas justifier : les allégations cosmétiques sont réglementées.

## 10. Pour aller plus loin
Plus tard, vous pourrez ajouter : codes promo, plusieurs tarifs de livraison par pays, factures PDF, newsletter (avec consentement). Dites-le-moi et je l'ajoute.
