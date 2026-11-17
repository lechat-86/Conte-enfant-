# READYFILE GROWTH — outil interne de prospection

> **Usage interne uniquement.** Ne jamais exposer, héberger ni montrer à un prospect. Ce n'est pas une fonctionnalité de READYFILE AI.
> **Internal use only.** Never expose, host or show to a prospect. This is not a feature of READYFILE AI.

## 🇫🇷 Français

### Lancer
```bash
npm run growth          # → http://127.0.0.1:5174   (READYFILE AI reste sur : npm start → :5173)
npm test                # tests unitaires (READYFILE AI + GROWTH)
npm run test:growth     # tests navigateur GROWTH
npm run test:all        # tout
```
Prérequis : Node ≥ 20. Aucune dépendance, aucun compte, aucune dépense.

### Pourquoi une application séparée
Pour qu'aucun client de READYFILE AI ne puisse y accéder, GROWTH n'est **pas** dans `public/` : il a son **propre serveur et son propre port** (donc une **origine navigateur différente** : le `localStorage` du produit et celui de GROWTH sont étanches). Le serveur du produit ne sert rien de `growth/` et le code du produit n'y fait aucune référence — des tests le vérifient (`growth-security.test.js`, e2e « Isolation »).

### Ce que l'outil fait
| Écran | Fonction |
|---|---|
| **Tableau de bord** | 9 indicateurs (prospects, FR, anglophones, à contacter, messages envoyés manuellement, réponses, démos, intentions d'achat dont sérieuses, clients payants), entonnoir de progression, courbes hebdomadaires cumulées, objectifs, rappels, activité récente |
| **Prospects** | Fiche (cabinet, pays, ville, site, contact, fonction, e-mail pro, URL de la source, dates, statut, notes, prochaine action + date, budget, problèmes), recherche, filtres (statut, pays, action), tri, modification, suppression **avec confirmation**, fiche détaillée avec historique |
| **Relances** | Rappels visuels : en retard, à faire aujourd'hui, réponses à traiter, démonstrations à préparer, sans prochaine action ; reporter (+1/+3/+7 j) ; ajouter une note après chaque conversation |
| **Modèles de messages** | 6 modèles × FR/EN (premier contact, entretien 10 min, démo, remerciement, relance, retour après démo) ; personnalisation ; **bouton Copier** ; enregistrement *manuel* de l'envoi |
| **Entretiens** | Fiche complète selon `CUSTOMER_INTERVIEW.md` ; **intérêt verbal séparé de l'engagement réel** (échelle 0–5 de `VALIDATION_SCORECARD.md`) |
| **Analyse** | Tableau comparatif des cabinets ; problèmes, fonctionnalités, concurrents, logiciels, budgets, raisons de refus/d'intérêt ; **garde-fou d'échantillon** |
| **Données & paramètres** | Exports CSV (prospects, entretiens, notes), notes en texte, sauvegarde/restauration JSON, démo, limites de sécurité |

### Règles de calcul (aucune statistique inventée)
- **Messages envoyés** = actions « message envoyé » que *vous* enregistrez après l'avoir envoyé vous-même. L'outil n'envoie rien.
- **Réponses / démonstrations** = actions enregistrées de type « réponse reçue » / « démonstration réalisée ».
- **Intentions d'achat** = prospects aux statuts « Intérêt confirmé », « Offre présentée », « Client payant ». **Intentions sérieuses** = engagement ≥ 4 (accord écrit) ou client payant.
- **Cabinets étudiés** = prospects dont le statut n'est plus « À rechercher » ; « français » = pays FR ; « anglophones » = GB, IE, US, CA, AU, NZ, SG, ZA.
- **Entonnoir** = nombre de cabinets ayant atteint chaque étape (comptes bruts). **Aucun taux de conversion** n'est calculé.
- **Analyse** : sous **10** cabinets avec entretien (`MIN_SAMPLE`), seulement des comptages bruts, jamais de moyenne, de médiane ou de pourcentage ; au-delà, une médiane de budget *indicative*. Les heures, fréquences et budgets sont **déclarés**, non vérifiés. Un cabinet compte une seule fois par valeur.
- **Intérêt verbal ≠ volonté de payer** : le niveau 5 exige un **prix explicitement accepté et chiffré** ; cocher « prix accepté » sans montant (ou l'inverse) est refusé.

### Objectifs préconfigurés (modifiables)
15 cabinets étudiés · 10 français · 5 anglophones · 5 démonstrations · 3 intentions sérieuses · 1 client payant. Le tableau de bord montre le réalisé, le reste à faire et « Objectif atteint ».

### Données et sauvegarde
- Les données vivent dans le **`localStorage` de ce navigateur** (origine `127.0.0.1:5174`) : elles survivent aux mises à jour du code, mais pas à un effacement du navigateur ni à un changement de port/machine → **faites régulièrement une sauvegarde JSON** (*Données & paramètres*).
- Un schéma versionné (`version: 1`) valide chaque rechargement et chaque import ; un fichier invalide est refusé sans toucher aux données.
- **Démo** : le jeu fictif (8 cabinets, `.example`) est marqué `demo: true`. « Démarrer avec mes données » supprime *uniquement* ces enregistrements, jamais vos saisies réelles ; la colonne `demo` des exports permet de les repérer.
- **Exports CSV** : UTF-8 avec BOM, guillemets RFC 4180, **protection contre l'injection de formules** (valeurs commençant par `= + - @` préfixées d'une apostrophe).

### Sécurité et limites (à lire)
| Garantie réelle | Limite |
|---|---|
| Aucun envoi : pas d'e-mail, SMS, LinkedIn ; aucune API d'envoi dans le code (testé par analyse statique) | Rien n'empêche l'utilisateur d'envoyer lui-même ce qu'il copie : respecter la réglementation (voir ci-dessous) |
| Aucune collecte automatique : pas de scraping, pas d'import depuis des sites ; chaque prospect est saisi à la main avec l'**URL de la source** obligatoire | La légitimité de la source reste sous votre responsabilité |
| CSP `connect-src 'none'` : le navigateur **ne peut pas** émettre de requête sortante depuis l'outil | — |
| Serveur sur `127.0.0.1` uniquement, contrôle de l'en-tête `Host` (anti DNS-rebinding), GET/HEAD seulement, `noindex` | **Aucune authentification** : quiconque ouvre la session de l'utilisateur voit les données |
| E-mail professionnel facultatif avec **attestation de légitimité** obligatoire | **Pas de chiffrement au repos** (`localStorage` en clair) ; ne pas héberger tel quel |
| Isolation d'origine d'avec READYFILE AI (testée) | Un script malveillant ou une extension du même navigateur pourrait lire le stockage |

**Conformité (à valider avec un juriste)** — ce sont des **données personnelles professionnelles** : informer les personnes (source, finalité), respecter l'opposition (« ne plus écrire » → *Refusé* + suppression sur demande), limiter la durée de conservation, et respecter les règles de prospection B2B de chaque pays (France : adresse professionnelle, objet en rapport avec la fonction, identification, possibilité de s'opposer). Les modèles incluent une mention d'opposition. Ce document n'est pas un avis juridique.

### Architecture et sécurisation future
```
growth/server.js            serveur local dédié (Host check, CSP, liste blanche /shared/*)
growth/public/js/
  domain/   dates, constants, validation, stats, reminders, analysis, csv, templates   (pur, testé en Node)
  data/     store.js (état + persistance + actions) · seed.js (démo fictive)
  views/    dashboard, prospects, prospectForm, prospectDetail, reminders, templates, interviews, analysis, settings
  ui/, core/, i18n/dict.js  composants, i18n FR/EN ([fr, en] par clé : parité garantie)
```
Points d'extension déjà prévus : `createStore({ storage, codec, clock })` —
- **`codec`** : brancher un chiffrement au repos (WebCrypto avec phrase secrète) sans toucher au reste ; testé avec un codec de démonstration.
- **`storage`** : remplacer `localStorage` par une base chiffrée côté serveur (SQLite chiffré, PostgreSQL + RLS) derrière une API authentifiée.
- Ensuite : authentification (même locale, mot de passe + verrouillage), journal d'accès, durée de conservation avec purge, export/effacement par personne, sauvegardes chiffrées. Les champs personnels sont : `contactName`, `contactRole`, `contactEmail`, notes et activités.

### Utilisation recommandée
1. *Données & paramètres* → saisir votre nom (signature) ; **Démarrer avec mes données**.
2. Ajouter des cabinets trouvés **manuellement** (annuaires publics, sites) avec l'URL de la source ; statut *À contacter* ; première action datée.
3. *Modèles* → personnaliser, **copier**, envoyer **vous-même** ; revenir enregistrer « message envoyé ».
4. *Relances* chaque matin ; noter chaque conversation.
5. *Entretiens* après chaque échange : distinguer ce qui est **dit** de ce qui est **engagé**.
6. *Analyse* : ne rien conclure avant 10 entretiens ; comparer avec `VALIDATION_SCORECARD.md`.

---

## 🇬🇧 English

### Run
```bash
npm run growth          # → http://127.0.0.1:5174   (READYFILE AI stays on: npm start → :5173)
npm test                # unit tests (READYFILE AI + GROWTH)
npm run test:growth     # GROWTH browser tests
npm run test:all        # everything
```
Requires Node ≥ 20. No dependencies, no accounts, no spending.

### Why a separate app
So that no READYFILE AI customer can ever reach it, GROWTH is **not** under `public/`: it has its **own server and port** (hence a **different browser origin**: the product’s `localStorage` and GROWTH’s are isolated). The product server serves nothing from `growth/` and the product code never references it — tests verify this (`growth-security.test.js`, e2e “Isolation”).

### What it does
Dashboard (9 KPIs, funnel, weekly cumulative lines, goals, reminders), prospects (full record, search, filters, sorting, edit, delete **with confirmation**, detail sheet with history), follow-ups (visual reminders only: overdue, today, replies to handle, demos to prepare; snooze; add a note after each conversation), message templates (6 × FR/EN, copy button, *manual* send logging), interviews (full sheet; **verbal interest kept separate from real commitment**), analysis (firm comparison, tallies, **small-sample guard**), data & settings (CSV exports, JSON backup/restore, demo data, security limits).

### Calculation rules (no invented statistics)
- **Messages sent** = “message sent” actions *you* record after sending them yourself. The tool sends nothing.
- **Replies / demos** = recorded “reply received” / “demo done” actions.
- **Purchase intents** = prospects at “Interest confirmed”, “Offer presented” or “Paying customer”. **Serious intents** = commitment ≥ 4 (written agreement) or paying customer.
- **Firms studied** = prospects no longer at “To research”; “French” = country FR; “English-speaking” = GB, IE, US, CA, AU, NZ, SG, ZA.
- **Funnel** = number of firms that reached each stage (raw counts). **No conversion rate** is computed.
- **Analysis**: below **10** firms with an interview (`MIN_SAMPLE`), raw counts only — never averages, medians or percentages; above, an *indicative* budget median. Hours, frequencies and budgets are **stated**, unverified. Each firm counts once per value.
- **Verbal interest ≠ willingness to pay**: level 5 requires an **explicitly accepted, stated price**; ticking “price accepted” without an amount (or the reverse) is rejected.

### Preset goals (editable)
15 firms studied · 10 French · 5 English-speaking · 5 demos · 3 serious intents · 1 paying customer; the dashboard shows progress, what remains and “Goal reached”.

### Data and backup
Data lives in this browser’s **`localStorage`** (origin `127.0.0.1:5174`): it survives code updates but not a browser wipe or a change of port/machine → **make JSON backups regularly**. A versioned schema validates every reload and import; an invalid file is rejected without touching data. The fictional demo set is flagged `demo: true`; “Start with my own data” removes *only* those records. CSV exports are UTF-8 with BOM, RFC 4180 quoting and **formula-injection protection**.

### Security and limits
Real guarantees: nothing is sent (no email/SMS/LinkedIn, no send API in the code — checked by static analysis); no automatic collection (no scraping; every prospect is typed by hand, **source URL required**); CSP `connect-src 'none'` (the browser cannot make outgoing requests from the tool); server on `127.0.0.1` only with `Host` check, GET/HEAD only, `noindex`; optional professional email requires a **legitimacy attestation**; origin isolation from READYFILE AI.
Limits: **no authentication** (anyone using the user’s session sees the data); **no encryption at rest**; do not host as is; a malicious script/extension in the same browser could read storage; the user remains responsible for the legitimacy of sources and for B2B prospecting rules (not legal advice — have a lawyer validate).

### Architecture and future hardening
`createStore({ storage, codec, clock })` provides the extension points: a **`codec`** for encryption at rest (WebCrypto with a passphrase; tested with a demo codec) and a **`storage`** adapter to move to an encrypted server-side database behind an authenticated API. Then: authentication, access log, retention with purge, per-person export/erasure, encrypted backups. Personal fields: `contactName`, `contactRole`, `contactEmail`, notes and activities.
