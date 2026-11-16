# Les 10 premières commandes, sans publicité payante (rien n'est contacté sans votre accord)

Objectif réaliste : 10 commandes ≈ 190 à 390 € de CA en 3 à 6 semaines, à ~1 h/jour. Ce sont des hypothèses : on mesure puis on ajuste (`python3 tools/crm.py stats`).

## 0. Avant de contacter qui que ce soit (obligatoire)
SIRET obtenu · site en ligne avec liens de paiement · **vous avez commandé et écouté votre propre pack** · exemples audio générés (`tools/make_samples.py`).

## 1. Secteurs, par priorité
Plombiers/électriciens/chauffagistes · garages · kinés/ostéos/cabinets · agents immobiliers · coiffeurs/instituts · restaurants · comptables/conseils · gîtes/hôtels · associations. Voir `docs/MARCHE.md`.

## 2. Trouver les entreprises (manuel, 30 min = ~10 fiches)
1. Choisir **une ville moyenne** et **un métier** (ex. « plombier Angers »).
2. Google Maps / PagesJaunes : lister 10 entreprises avec un site propre.
3. **Les appeler en client** (honnêtement : « je souhaite un renseignement ») hors horaires : noter ce que vous entendez (aucune messagerie, messagerie pleine, message par défaut de l'opérateur, message long/illisible). C'est votre « observation » réelle : jamais d'observation inventée.
4. Trouver une **adresse professionnelle nominative** (ou, à défaut, l'adresse générique du site : voir règles ci-dessous). Pas d'adresse devinée ; pas d'adresse personnelle (Gmail du dirigeant) ; pas de particuliers.
5. `python3 tools/crm.py add "Dupont Plomberie" --email ... --prenom Jean --secteur plombier --ville Angers --type nominative --source "site web de l'entreprise"`.

## 3. Message de prospection conforme (CNIL, à revérifier)
Conditions B2B généralement citées : adresse professionnelle, message en rapport avec l'activité du destinataire, expéditeur identifié, **opposition simple et gratuite à chaque envoi**, mention de la source des données, honorer immédiatement les « STOP ».
- `python3 tools/crm.py draft <id>` génère un brouillon (`prospection/drafts/`) à relire, compléter (observation réelle, signature avec SIRET) et **envoyer vous-même**. L'outil n'envoie jamais rien et refuse les adresses personnelles ou en opposition.
- Cadence : 10 à 15 mails/jour maximum, **une seule relance** à J+4 (`crm.py next`).
- Alternatives sans e-mail : passer en boutique/atelier avec un QR code vers la page métier, message LinkedIn à un dirigeant, GBP (message depuis fiche Google si le professionnel l'autorise). L'appel téléphonique à froid vers professionnels : réglementation évolutive, à vérifier avant.

## 4. Partenaires : agences web et informatique
Pourquoi : un partenaire apporte plusieurs clients et vous évite la prospection. Cible : freelances/agences web TPE, intégrateurs téléphonie/box, comptables, CCI/CMA/réseaux d'entrepreneurs.
- Offre : **20 % de commission** sur chaque commande via leur lien `https://VOTRE-DOMAINE/?ref=NOMAGENCE` (le site transmet le code à Stripe : `python3 -m engine.report` affiche les ventes par partenaire) ; test gratuit d'un message sur leur propre ligne ; texte prêt à envoyer à leurs clients.
- Brouillon : `crm.py draft <id> --modele email_partenaire`. Paiement des commissions à la main chaque mois (virement), seulement après accord écrit simple (mail).
- Commission à confirmer avant envoi : sur un pack à 39 €, 20 % = 7,80 €.

## 5. Premiers avis clients (vrais uniquement)
- Après livraison, une demande d'avis part automatiquement 7 à 14 jours plus tard (`engine/followup.py`, variable GitHub `REVIEW_URL` = lien de votre fiche Google/Trustpilot, active quand `REVIEW_MODE=0`). En phase manuelle, envoyez-la vous-même.
- **Interdits** : écrire un avis à la place du client, offrir une contrepartie conditionnée à un avis positif, afficher des notes non réelles. Un avis incité doit être signalé.
- Demandez en plus 1 phrase de retour à 5 premiers clients, avec **leur accord écrit** pour la citer sur le site avec leur prénom/entreprise.

## 6. Suivi
`prospection/prospects.csv` (local, ignoré par git, données personnelles) · `crm.py next` chaque matin · `crm.py stats` chaque semaine · `python3 -m engine.report` pour les ventes réelles.

## 7. Plan 14 jours (≈ 1 h/jour)
| Jours | Action |
|---|---|
| 1-2 | Statut, Stripe, secrets GitHub, doctor, premiers exemples audio |
| 3 | Test réel (vous achetez, vous vous remboursez), installation sur votre téléphone |
| 4 | Publication du site (après votre accord), Search Console |
| 5-6 | 3 proches/pros du réseau : offrir leur 1er message contre un retour honnête (vrai feedback) |
| 7-12 | 10 fiches/jour → 5 brouillons/jour envoyés par vous ; 2 partenaires potentiels contactés |
| 13-14 | Relances J+4, bilan `stats`, ajustement prix/offre |
