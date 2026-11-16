# VoixPrête : plan et checklist (≈ 1 h/jour au démarrage)

**Offre** : messages vocaux pros (accueil, répondeur hors horaires, attente, fermeture) en voix IA française. Message : 19 € ; pack 3 messages : 39 €. Livré par e-mail < 1 h : MP3 + WAV 8 kHz mono (standards), textes pour relecture.
**Clients** : TPE, artisans, cabinets, restaurants, associations (voir 10 pages métiers).
**Pourquoi payer** : voix humaines sur ComeUp/Fiverr ≈ 15-35 $ le message avec 24 h de délai ; standards IA complets ≈ 49 €/mois. Ici : instantané, sans abonnement, format prêt à installer. *(prix relevés dans des annonces, à reverifier.)*

## Économie par pack à 39 € (estimations)
| Poste | € |
|---|---|
| Stripe (≈ 1,5 % + 0,25 €) | ≈ 0,85 |
| ElevenLabs (3 × ~600 caractères, plan Starter 30 000 crédits ≈ 15 packs) | ≈ 0,35 |
| Claude API | ≈ 0,03 |
| Cotisations micro-entrepreneur (≈ 21 %, taux à vérifier) | ≈ 8,2 |
| **Net** | **≈ 29** |
Message seul à 19 € : net ≈ 14. Ventes : 100 € = 3 packs ; 500 €/mois ≈ 13 packs ; 1 000 € ≈ 26 ; 3 000 € ≈ 77.
Budget de départ ≈ 25 € : domaine ≈ 10 €, ElevenLabs Starter ≈ 5 €/mois (licence commerciale obligatoire : le gratuit l'interdit), crédit API ≈ 5 €. Rien n'est dépensé sans vous.

## Ce que VOUS faites (~3 h)
1. Statut micro-entrepreneur (formalites.entreprises.gouv.fr, gratuit) → SIRET.
2. Vérifier le nom « VoixPrête » (INPI) et acheter un domaine → modifier `engine/brand.py`, relancer `python3 tools/build_site.py`.
3. Compte Stripe (France) + clé secrète ; URL des CGV dans les réglages ; `python3 -m engine.setup_stripe` → coller les 2 liens dans `site/config.js`.
4. ElevenLabs (plan payant) : choisir 1 voix féminine + 1 masculine françaises, **vérifier leurs conditions d'usage commercial** ; noter les IDs.
5. Clé API Anthropic (~5 €) : Claude Pro ne l'inclut pas.
6. Gmail : mot de passe d'application. Secrets GitHub : `STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_F, ELEVENLABS_VOICE_M, SMTP_USER, SMTP_PASSWORD, OWNER_EMAIL`.
7. Compléter CGV/mentions légales (SIRET, adresse, médiateur de la consommation : obligatoire).
8. Héberger `site/` (Cloudflare Pages ou GitHub Pages, gratuit).
9. **Test réel** : commandez-vous un pack, écoutez, branchez un fichier sur votre téléphone ; ajustez voix et vitesse.
10. `REVIEW_MODE=1` (défaut) : les fichiers vous arrivent d'abord, vous les transférez. Après ~10 commandes bonnes : variable GitHub `REVIEW_MODE=0`.

## État honnête
- Testé (8 tests) : sélection pack/message, garde-fous (aucun chiffre, lien ou placeholder non fourni par le client), anti double livraison, relances puis alerte, conversion WAV 8 kHz avec ffmpeg réel.
- **Non testé** : appels réels Stripe / Claude / ElevenLabs / SMTP (aucune clé ici). Aucun compte créé, aucun paiement connecté, rien déployé.
- Risques : qualité/prononciation des noms propres (d'où relecture et 1 retouche offerte, à faire à la main) ; les moteurs de recherche mettront du temps (le SEO est lent, la prospection ciblée est le levier de démarrage) ; GitHub Actions peut retarder un cron de quelques minutes.

## Phase 7
Abonnement « mises à jour saisonnières » (9 €/mois : congés, promos, horaires), voix personnalisée par client, offre agences/revendeurs, anglais/espagnol.
Suivi : `python3 -m engine.report`.
