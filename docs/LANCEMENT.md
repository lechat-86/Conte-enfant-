# Guide de lancement pas à pas (≈ 3 h, la seule dépense : quelques euros de crédit API)
Vérifiez votre avancement à tout moment : `python3 tools/launch_check.py`.

## A. Légal (30 min, gratuit)
1. formalites.entreprises.gouv.fr → créer une micro-entreprise (activité de services numériques / production audio). Notez le **SIRET** (quelques jours possibles).
2. Remplacez les `[À COMPLÉTER]` dans `tools/build_site.py` (CGV, mentions : nom, SIRET, adresse, médiateur de la consommation, mention TVA), puis `python3 tools/build_site.py`.
   Médiateur : à choisir parmi la liste officielle des médiateurs de la consommation référencés (adhésion parfois payante : à vérifier avant d'ouvrir aux particuliers ; l'obligation vise les ventes aux consommateurs, pas aux professionnels).

## B. Nom et domaine (20 min, gratuit jusqu'à l'achat)
3. Vérifications de `docs/NOM.md`. Si OK, achetez le domaine **vous-même** (≈ 8-12 €/an) ; puis modifiez `engine/brand.py` (DOMAIN, SUPPORT_EMAIL) et reconstruisez le site. Créez l'adresse contact@ (la plupart des registraires incluent une redirection).

## C. Stripe (30 min, gratuit)
4. dashboard.stripe.com → compte France, identité de l'entreprise (SIRET), compte bancaire.
5. Réglages > Informations publiques : URL des conditions = `https://VOTRE-DOMAINE/cgv.html`.
6. Développeurs > Clés API > **clé restreinte** : Checkout Sessions (lecture), PaymentIntents (lecture + écriture), Products/Prices/Payment Links (écriture, pour l'étape 7 seulement).
7. `STRIPE_SECRET_KEY=rk_... python3 -m engine.setup_stripe` → copiez les 2 liens dans `site/config.js` (`LINK_PACK`, `LINK_SINGLE`). Vérifiez dans Stripe que les 3 champs s'affichent bien.
   Conseil : faites d'abord ces étapes en **mode test** (clé `rk_test_`), payez avec la carte 4242 4242 4242 4242, puis passez en mode réel.

## D. Voix (20 min, inclus dans votre abonnement)
8. ElevenLabs > Voices : choisissez 1 voix féminine + 1 masculine, **françaises** de préférence parmi les voix de base ; notez leurs IDs. Lisez leurs conditions d'usage commercial.
9. `ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_F=... ELEVENLABS_VOICE_M=... python3 tools/doctor.py --tts` : écoutez `doctor_*.mp3`. Voix décevante ? Changez-en ou ajustez `speed`/`stability` dans `engine/audio.py`.
10. `python3 tools/make_samples.py` puis `python3 tools/build_site.py` : les lecteurs audio apparaissent sur le site.

## E. Automatisation (20 min)
11. console.anthropic.com → clé API + environ 5 € de crédit.
12. Gmail : validation en 2 étapes, puis « mot de passe d'application ».
13. GitHub > Settings > Secrets and variables > Actions : secrets `STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_F, ELEVENLABS_VOICE_M, SMTP_USER, SMTP_PASSWORD, OWNER_EMAIL` ; variable `REVIEW_MODE=1`.
14. Onglet Actions : activer les workflows ; lancer « Livraison des messages » à la main une fois.

## F. Test réel (30 min)
15. Achetez votre propre pack via votre lien, avec vos vrais renseignements. Attendez ≤ 30 min : vous recevez le dossier (mode relecture). Écoutez ; installez le WAV sur votre ligne ; appelez-vous depuis un autre téléphone.
16. Remboursez-vous dans Stripe (les frais de traitement ne sont pas rendus, quelques centimes).

## G. Mise en ligne (après votre accord)
17. Cloudflare Pages ou GitHub Pages : publier le dossier `site/`. Puis Google Search Console : ajouter le site, soumettre `sitemap.xml`.

## H. Première vente
Suivez `marketing/10-premiers-clients.md` (plan 14 jours) et `marketing/kit-partenaire.md`.
