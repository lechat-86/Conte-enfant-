# Documentation technique

## Choix de stack (projet initial vide)

- **JavaScript natif (modules ES)**, sans framework, sans bundler, sans dépendance npm → 0 € de licence, 0 risque de supply-chain, démarrage instantané, code lisible par n'importe quel développeur.
- **Serveur Node minimal** (`server.js`) : fichiers statiques, `127.0.0.1` uniquement, CSP stricte (`default-src 'self'`, aucune ressource externe, polices système).
- **Tests** : `node:test` (unitaires) et Playwright/Chromium préinstallé (e2e). Aucun ajout au `package.json`.
- Compromis assumé : pour la version commerciale, migrer l'UI vers un framework typé (voir `FUTURE_ARCHITECTURE.md`). La séparation en couches ci-dessous rend cette migration peu coûteuse : seul `views/` et `ui/` seraient réécrits.

## Arborescence

```
server.js                    serveur statique local
public/
  index.html, assets/        coque HTML, CSS (design system), favicon
  js/
    domain/                  RÈGLES MÉTIER PURES (aucun DOM, aucun stockage) — testées en Node
      docTypes.js            types de pièces, modèles de dossiers
      rules.js               règles de décision (lisibilité, type, doublon, période, pages)
      dossier.js             statuts, complétion, interventions, création
      stats.js               statistiques du tableau de bord
      messages.js            génération des messages client FR/EN
      validation.js          validation des formulaires (clés d'erreur i18n)
      period.js, pricing.js, countries.js
    engine/                  MOTEUR D'ANALYSE BRANCHABLE
      index.js               registre, contrat d'un moteur, analyzeDocument()
      simulated.js           moteur de simulation déterministe
    data/                    DONNÉES
      seed.js                jeu de démonstration (100 % fictif)
      store.js               état + persistance localStorage + actions métier
    core/                    html.js (templates échappés), i18n.js, format.js, actions.js, bus.js
    i18n/                    fr.js, en.js (405 clés chacune, parité testée)
    ui/                      composants, graphiques SVG/CSS, modales, toasts, icônes
    views/                   une vue par page (+ formulaires, assistant, landing, tour = démo guidée)
    app.js                   routeur par hash, coque, rendu
tests/unit/                  84 tests ; tests/e2e/run.mjs : 27 tests navigateur
```

**Règle de dépendance** : `domain` ← `engine` ← `data` ← `views/ui` ← `app`. `domain` n'importe jamais de `views`/`ui`/DOM (vérifié : les tests unitaires l'importent directement sous Node).

## Modèle de données

- **Client** `{id, company, contact, email, country, language, createdAt}`
- **Dossier** `{id, clientId, template, period (AAAA-MM), createdAt, dueDate, token, slots[]}`
  - **Slot** (pièce attendue) `{id, type, doc|null}` — la liste « attendus » est `slots`, la liste « reçus » est `slots` dont `doc != null`.
  - **Doc** `{id, fileName, sizeKB, receivedAt, via, status: valid|invalid|analyzing, attempts, analysis?, pendingScenario?}`
  - **Analysis** `{engine:{id,name,simulated}, scenario?, extraction, verdict, issue, checks[], details, analyzedAt}`
- **Event** `{id, at, type, clientId?, dossierId?, params}` — historique stocké sous forme de **clés + paramètres**, traduit à l'affichage (donc l'historique change de langue avec l'interface).

### Règles métier

| Règle | Définition |
|---|---|
| Statut du dossier | `analyzing` si une pièce est en analyse ; sinon `to_fix` si une pièce invalide ; sinon `pending` s'il manque une pièce ; sinon `complete` |
| Complétion | pièces **validées** / pièces attendues (arrondi) |
| Intervention requise | pièce à corriger **ou** échéance dépassée sur dossier non complet |
| Ordre des anomalies | illisible > mauvais type > doublon > mauvaise période > incomplet |
| Seuil de lisibilité | 0,6 |
| Période | comparée au mois (types mensuels) ou à l'année (types annuels) ; ignorée pour les pièces sans période |
| Cohérence des stats | `reçus + manquants = attendus` et `validés + incorrects + en analyse = reçus` (testé) |

## Brancher un vrai moteur OCR / IA

Implémenter le contrat décrit dans `public/js/engine/index.js` :

```js
registerEngine({
  id: 'mon-moteur', name: 'OCR + LLM', simulated: false,
  async analyze({ fileName, sizeKB, expected: { type, period } }, known) {
    // 1) OCR  2) classification du type  3) extraction période/pages  4) empreinte du contenu
    return { extraction: { legibility, detectedType, detectedPeriod, pages: { found, expected }, fingerprint } };
  },
});
setActiveEngine('mon-moteur');
```

Le **verdict reste calculé par `domain/rules.js`** : le modèle propose des extractions, des règles auditables décident. Un test (`engine.test.js`) branche un faux moteur pour prouver que l'interface suffit. Côté production, l'appel doit se faire **côté serveur** (jamais depuis le navigateur).

## Sécurité du prototype (ce qui existe réellement)

- Échappement automatique de toute valeur injectée dans le HTML (`core/html.js`), testé avec une charge XSS (e2e).
- CSP `default-src 'self'`, pas de `eval`, pas de ressource externe ; les tests e2e échouent si une requête sort de `127.0.0.1`.
- Portail : accès par **jeton** (pas par identifiant) et affichage limité au seul dossier concerné ; fichiers jamais lus ni stockés (nom et taille seulement), extensions et taille (10 Mo) vérifiées.
- **Non opérationnel** (liste complète en page Paramètres) : authentification, chiffrement, contrôle d'accès, isolation entre cabinets, journal d'accès, purge, RGPD. Les jetons de démonstration sont **devinables** (`demo-dos-003`) : normal pour un prototype, inacceptable en production.
- `localStorage` : lisible par tout script de la même origine, effaçable par l'utilisateur ; ce n'est pas une base de données.

## Accessibilité & responsive

Navigation clavier, modale avec piège de focus et retour du focus, `aria-*` sur barres de progression / graphiques / dialogues / toasts, `prefers-reduced-motion` respecté. Trois largeurs testées : 1360, 820 (tablette), 390 (mobile, menu tiroir, tableaux en cartes). Une revue WCAG complète n'a pas été faite.
