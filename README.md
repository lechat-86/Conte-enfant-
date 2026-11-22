# READYFILE AI — prototype local de démonstration

> **Nom provisoire.** Prototype pour cabinets comptables : collecte documentaire, vérification automatisée *(simulée)*, relances assistées.
> **Aucun déploiement, aucun compte externe, aucun paiement, aucune donnée réelle.** Tout tourne en local, à 0 €.

## Validation commerciale (Mission 2)

L'application s'ouvre sur une **page de présentation** avec une **démo guidée de 7 étapes** (3 à 5 min). Documents de validation de marché, bilingues FR/EN : [`AUDIT`](docs/AUDIT.md) · [`POSITIONING`](docs/POSITIONING.md) · [`SALES_DEMO`](docs/SALES_DEMO.md) · [`CUSTOMER_INTERVIEW`](docs/CUSTOMER_INTERVIEW.md) · [`OBJECTIONS`](docs/OBJECTIONS.md) · [`COMPETITORS`](docs/COMPETITORS.md) · [`PRICING_TEST`](docs/PRICING_TEST.md) · [`VALIDATION_SCORECARD`](docs/VALIDATION_SCORECARD.md).

## READYFILE GROWTH — outil interne de prospection (Mission 3)

Espace de gestion commerciale **réservé à l'équipe**, séparé du produit (autre serveur, autre port, autre origine navigateur) : `npm run growth` → http://127.0.0.1:5174. Rien n'est envoyé, rien n'est collecté automatiquement. Voir [`docs/GROWTH.md`](docs/GROWTH.md).

## Lancer en 30 secondes

Prérequis : **Node.js ≥ 20** (aucune dépendance à installer, pas de `npm install`).

```bash
npm start
# → http://127.0.0.1:5173
```

Le serveur n'écoute que sur `127.0.0.1`. Les données de démonstration sont stockées dans le `localStorage` de votre navigateur ;
*Paramètres → Réinitialiser la démo* les remet à zéro.

## Parcours de démonstration conseillé (≈ 5 min)

1. **Tableau de bord** : indicateurs, graphiques, dossiers à traiter, activité (cliquez sur une carte KPI → liste filtrée).
2. **Dossiers → DOS-007** : 3 anomalies différentes ; simulez un dépôt (scénario au choix) ; cliquez **Préparer un message**.
3. **Assistant** : message FR/EN, modification libre, copie, case « j'ai relu » obligatoire, aucun envoi.
   **Relances** (`#/followups`) : tous les dossiers à relancer par priorité (échéance dépassée → documents à corriger → documents manquants), filtres, date de la dernière relance préparée, bouton « Préparer le message » qui ouvre l'assistant. Rien n'est envoyé.
4. **Analyse documentaire** : les 6 scénarios, contrôles, données extraites (simulées), « Exécuter les scénarios ».
5. **Portail client** (bouton « Ouvrir le portail client » d'un dossier, ou `#/portal/demo-dos-003`) : déposer un fichier fictif en choisissant le scénario, voir la raison du refus et la progression.
6. **Offres & tarifs** : 49 / 99 / 199 € (≈ $), calculateur de revenus récurrents vers 10 000 €/mois.
7. **Paramètres → Sauvegarde et export** : téléchargez une sauvegarde JSON complète, restaurez-la (sauvegarde de l'état actuel obligatoire + confirmation explicite, aucune fusion) ou exportez le suivi en CSV pour Excel (`;` en FR, `,` en EN).
8. Basculez **FR ↔ EN** à tout moment (sans rechargement).

## Tests

```bash
npm test            # 191 tests unitaires (node:test) — logique métier, relances, sauvegarde/CSV, i18n, store, données
npm run test:e2e    # 44 tests navigateur (Playwright/Chromium déjà installé) — toutes pages, relances, sauvegarde/restauration/CSV, mobile, tablette
npm run test:growth # 31 tests navigateur de l'outil interne GROWTH
npm run test:all
```

Les tests e2e lancent leur propre serveur et vérifient aussi : aucune erreur JS, aucune clé de traduction manquante, aucune requête externe, aucun débordement horizontal.

## Documentation

| Fichier | Contenu |
|---|---|
| [`docs/TECHNICAL.md`](docs/TECHNICAL.md) | Stack, arborescence, couches, modèle de données, règles métier, sécurité du prototype |
| [`docs/SIMULATED.md`](docs/SIMULATED.md) | Ce qui est **réel** et ce qui est **simulé** (à lire avant toute démo) |
| [`docs/RISKS.md`](docs/RISKS.md) | Risques techniques, juridiques et commerciaux |
| [`docs/FUTURE_ARCHITECTURE.md`](docs/FUTURE_ARCHITECTURE.md) | Architecture proposée pour la version commercialisable |

## Avertissement honnête

L'« IA documentaire » de ce prototype est un **moteur de simulation déterministe** : elle ne lit jamais le contenu d'un fichier.
Elle sert à montrer le parcours et à mesurer l'intérêt de vrais cabinets. Ne pas l'utiliser avec des documents réels.
