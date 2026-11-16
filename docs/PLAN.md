# Conte Doux : plan et checklist (≈ 1 h/jour au démarrage)

**Offre** : histoire du soir personnalisée (prénom, âge, situation vécue) en MP3 + texte, 4,90 €, livrée par e-mail en < 1 h.
**Différenciation** : concurrents français = abonnements d'histoires génériques (Alma 7,99 €/mois, Quelle Histoire 4,99 €/mois, Whisperies 2,99 €/mois) ou livres imprimés personnalisés (~30 €+). Ici : histoire *ciblée sur la situation* de l'enfant, prix d'achat unique, pages SEO par situation.

## Économie (estimations à confirmer avec vos vrais coûts)
| Poste | Par histoire |
|---|---|
| Stripe (1,5 % + 0,25 € cartes UE, ordre de grandeur) | ≈ 0,33 € |
| Claude API (Haiku, ~1 200 tokens sortie) | ≈ 0,01 € |
| ElevenLabs (~5 000 caractères ; plan Starter ≈ 30 000 crédits ≈ 6 histoires ; modèle Flash ≈ 2× plus) | ≈ 0,5 à 1 € |
| Cotisations micro-entrepreneur (≈ 21 % du CA, taux à vérifier) | ≈ 1,0 € |
| **Marge nette** | **≈ 2,5 à 3 €** |

Ventes nécessaires : 100 € CA = 21 ventes ; 500 €/mois = 102 ; 1 000 €/mois = 204 ; 3 000 €/mois = 612 (non réaliste sans abonnement, voir phase 7). Le plan ElevenLabs doit monter en gamme avec le volume.
Budget initial : domaine ≈ 8-12 €/an, ElevenLabs Starter ≈ 5 €/mois (licence commerciale requise : le plan gratuit l'interdit), crédit API Claude ≈ 5 €. Total ≈ 25 € : sous 50 €. Rien n'est dépensé sans vous.

## Ce que VOUS devez faire (dans l'ordre, ~3 h au total)
1. **Statut** : micro-entrepreneur sur formalites.entreprises.gouv.fr (gratuit) → SIRET. Obligatoire avant de vendre.
2. Vérifier le nom « Conte Doux » (INPI/base marques) et acheter un domaine ; changer `engine/brand.py`.
3. Compte **Stripe** (France) → clé secrète restreinte (lecture sessions, lecture/écriture PaymentIntents, création produits/liens) ; renseigner l'URL des CGV dans le dashboard.
4. Lancer `STRIPE_SECRET_KEY=... python3 -m engine.setup_stripe` → coller le lien dans `site/config.js`.
5. **ElevenLabs** : plan payant (licence commerciale), choisir une voix française douce (vérifier ses conditions), noter l'ID.
6. **Clé API Anthropic** (console.anthropic.com, ≈ 5 € de crédit : Claude Pro ne l'inclut pas).
7. Gmail : mot de passe d'application (ou adresse pro) pour l'envoi.
8. Dépôt GitHub → Settings > Secrets : `STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, SMTP_USER, SMTP_PASSWORD, OWNER_EMAIL`.
9. Compléter mentions légales/CGV (SIRET, adresse, médiateur de la consommation : obligatoire), relecture par vous.
10. Héberger `site/` (Cloudflare Pages ou GitHub Pages, gratuit).
11. **Test réel** : acheter votre propre histoire (puis remboursez-vous), écouter, ajuster voix/prompt.
12. Mode `REVIEW_MODE=1` (défaut) : les histoires vous arrivent d'abord, vous les transférez aux clients. Après ~10 histoires satisfaisantes, variable GitHub `REVIEW_MODE=0` = 100 % automatique.

## État honnête
- Testé : logique de livraison, idempotence, reprise sur erreur, nettoyage des entrées (6 tests, API simulées).
- **Non testé** : appels réels Stripe/Claude/ElevenLabs/SMTP (aucune clé ici) → étape 11 indispensable. Aucun compte créé, aucun paiement connecté, rien déployé.
- Risques : qualité de la voix FR ; le thème « deuil d'un animal » et la séparation sont sensibles (relire en mode review) ; GitHub Actions cron peut retarder de quelques minutes.

## Phases suivantes
- Phase 7 : abonnement « histoire de la semaine » (6,90 €/mois), pack 3 histoires, version bilingue, cartes cadeaux, ouverture aux crèches/assistantes maternelles.
- Suivi : `python3 -m engine.report` (ventes et CA sur 30 jours).
