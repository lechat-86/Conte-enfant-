# Première Voix : plan et checklist

**Offre** : messages vocaux pros (accueil, répondeur hors horaires, attente, fermeture) en voix française de synthèse. 19 € le message ; pack de 3 : 39 €. Livraison e-mail < 1 h : MP3 + WAV 8 kHz mono 16 bits + textes. Voir `docs/MARCHE.md` (marché/prix), `docs/NOM.md` (nom), `marketing/10-premiers-clients.md` (acquisition).

## Économie par pack à 39 € (estimations à confirmer avec vos vraies factures)
Stripe ≈ 0,85 € · ElevenLabs ≈ 0,35 € · Claude ≈ 0,03 € · cotisations micro-entrepreneur ≈ 21 % (≈ 8,2 €, taux à vérifier) → **net ≈ 29 €**. 100 € = 3 packs ; 500 €/mois ≈ 13 ; 1 000 € ≈ 26 ; 3 000 € ≈ 77.
Capacité ElevenLabs « premier palier » (≈ 30 000 crédits/mois) ≈ 15 packs ; au-delà prévoir le palier supérieur. Aucune dépense engagée par mes soins.

## Licence ElevenLabs : ce qui est vérifié, ce qui ne l'est pas
- **Vérifié (sources secondaires + extrait de l'article d'aide officiel)** : tous les plans payants incluent une licence commerciale (hors services bêta) ; le plan gratuit n'en a pas ; le contenu généré hors abonnement payant ne peut pas être utilisé commercialement.
- **Non vérifié** : je n'ai pas pu ouvrir elevenlabs.io (hôte bloqué ici) ni lire vos conditions exactes, ni consulter votre compte. À faire par vous : relire l'article « Can I publish the content I generate on the platform? » et les conditions spécifiques.
- **Voix** : une voix de la bibliothèque partagée peut avoir des conditions propres (non vérifié). `tools/doctor.py` affiche la catégorie de chaque voix et signale « À VÉRIFIER » si elle n'est pas `premade`. **Générez les fichiers pendant que l'abonnement est actif** (les sources divergent sur les droits après résiliation).
- Une activité de messages pro pour des tiers est une exploitation commerciale : couverte *en principe* par la licence payante, mais **gardez une capture de vos conditions et de votre facture ElevenLabs**.

## Ce qui est testé (15 tests, `python3 -m unittest discover -s tests -t .`)
- Garde-fous du texte (aucun nombre, lien ou placeholder non fourni par le client ; longueur) ; nettoyage d'entrée (injection).
- Sélection pack/message, voix féminine/masculine, idempotence (jamais 2 livraisons), reprises puis alerte, **refus de livrer sans WAV valide**, mode relecture.
- **Bout en bout réel contre des serveurs locaux factices** (vrai code HTTP Stripe/Claude/ElevenLabs, vrai SMTP, vrai ffmpeg) : 6 fichiers MP3/WAV reçus, WAV validé 8 kHz/mono/16 bits, relance d'avis envoyée une fois, rapport par partenaire, doctor.
- CRM prospects : opposition (STOP) bloquante, adresse perso refusée, brouillons avec mentions légales.
- Site : généré, vérifié visuellement ordinateur + mobile (Chromium), aucun débordement ni erreur JS.

## Ce qui n'est PAS testé (impossible ici, aucune clé/compte)
Appels réels à Stripe / Anthropic / ElevenLabs (noms de champs et formats lus dans leur documentation connue, pas validés en réel) ; qualité réelle des voix françaises ; prononciation des noms propres ; e-mails réels (anti-spam Gmail) ; compatibilité du WAV avec votre standard ; création des liens Stripe (`setup_stripe`). → l'étape « test réel » ci-dessous les couvre toutes.

## Vos actions, dans l'ordre (~3 h, aucune dépense avant l'étape 5)
1. **Statut micro-entrepreneur** (formalites.entreprises.gouv.fr, gratuit) → SIRET.
2. **Nom** : vérifications INPI/domaines de `docs/NOM.md` (gratuit). Dites-moi OK ou changez-le.
3. **Compte Stripe** (France) ; URL des CGV dans les réglages ; clé secrète **restreinte**. Puis : `STRIPE_SECRET_KEY=... python3 -m engine.setup_stripe` → coller les 2 liens dans `site/config.js`.
4. **ElevenLabs** : choisir 1 voix féminine + 1 masculine françaises, noter leurs IDs ; `ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_F=... ELEVENLABS_VOICE_M=... python3 tools/doctor.py --tts` ; écouter les 2 MP3 produits.
5. **Clé API Anthropic** (≈ 5 € de crédit ; Claude Pro ne l'inclut pas). Gmail : mot de passe d'application.
6. **Secrets GitHub** : `STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_F, ELEVENLABS_VOICE_M, SMTP_USER, SMTP_PASSWORD, OWNER_EMAIL`.
7. **Exemples audio** : `python3 tools/make_samples.py` puis `python3 tools/build_site.py`.
8. Compléter CGV / mentions légales (SIRET, adresse, médiateur de la consommation, mention TVA selon votre statut).
9. **Test réel** : lancer le workflow « Livraison » après avoir acheté votre pack (Stripe en mode test d'abord si vous préférez) ; installer le WAV sur votre ligne ; vous rembourser.
10. Héberger `site/` (Cloudflare Pages ou GitHub Pages, gratuit) après votre accord.
11. Garder `REVIEW_MODE=1` pour les ~10 premières commandes (les fichiers vous arrivent, vous transférez). Puis variable GitHub `REVIEW_MODE=0` + `REVIEW_URL`.

## Problèmes connus / à surveiller
- Retouches de texte, formats alternatifs, aide à l'installation : manuel (réponse e-mail).
- GitHub Actions : cron parfois retardé de quelques minutes ; sur dépôt privé, ≈ 1 440 min/mois utilisées (quota gratuit 2 000).
- Stripe : champs personnalisés limités à 3 par lien (d'où le choix « type + voix » combiné) et 255 caractères pour les infos.
- Mention de la TVA, médiateur, SIRET : placeholders dans les pages légales, à compléter avant publication.
- Preuve sociale : aucune au départ (volontairement : aucun faux avis).
