# Risques techniques et commerciaux

## Techniques

| Risque | Gravité | Atténuation proposée |
|---|---|---|
| **Fiabilité réelle de l'OCR/IA** : documents de mauvaise qualité, formats variés, faux positifs/négatifs → perte de confiance | Élevée | Garder la décision par règles auditables ; seuils de confiance ; « humain dans la boucle » systématique au début ; mesurer précision/rappel sur un jeu annoté de documents **consentis** avant de promettre quoi que ce soit |
| **Détection de doublons / périodes** sur scans non structurés : difficile | Moyenne | Empreintes perceptuelles + extraction de dates ; commencer par relevés bancaires et factures |
| **Données sensibles** (pièces d'identité, bancaires, paie) : une fuite est fatale | Critique | Chiffrement, isolation par cabinet, journal d'accès, hébergement UE, pentest avant la 1ʳᵉ donnée réelle |
| Coût des modèles/OCR par document qui grignote la marge (49 €/mois pour 200 documents ≈ 0,25 €/doc) | Moyenne | Chiffrer le coût unitaire réel ; OCR open source auto-hébergé ; quotas par offre |
| Dette du prototype (localStorage, pas de typage, UI sans framework) | Moyenne | Prototype jetable côté données ; conserver `domain/` et les tests ; migrer l'UI |
| Jetons de portail devinables, pas d'authentification | Critique (si réutilisé tel quel) | Jetons aléatoires à expiration, liens à usage limité, option de code de vérification |
| Accessibilité non auditée | Faible/Moyenne | Audit WCAG 2.1 AA avant commercialisation |
| Prototype testé sur Chromium uniquement | Faible | Ajouter Firefox/WebKit à la CI ; `input type=month` se dégrade en champ texte (validé côté code) |

## Juridiques / conformité

- **RGPD** : responsable de traitement (le cabinet) vs sous-traitant (nous) → DPA, registre, droits des personnes, durées de conservation, sous-traitants ultérieurs (fournisseur IA), transferts hors UE.
- Pièces d'identité : cadre strict (finalité, minimisation, durée).
- **Règlement européen sur l'IA** : à qualifier (probablement risque limité), obligation de transparence : ne jamais présenter une simulation ou un score comme une certitude.
- Responsabilité : une validation automatique erronée engage la réputation du cabinet ; conditions et messages doivent rappeler que le contrôle final reste humain.
- Secret professionnel de l'expert-comptable : exigences possibles de l'Ordre sur l'hébergement et la sous-traitance.

## Commerciaux

| Risque | Atténuation |
|---|---|
| **La volonté de payer n'est pas prouvée** (les prix 49/99/199 € sont des hypothèses) | Entretiens et démos *avec de vrais cabinets* (sans leurs données), pré-engagements, test de prix ; décider sur des signaux (rendez-vous obtenus, lettres d'intention), pas sur l'enthousiasme |
| **Concurrence** : suites comptables intégrées (collecte de pièces, OCR déjà inclus), outils de GED, portails clients | Se différencier sur un point étroit (contrôle de conformité + relance), intégrations plutôt que remplacement |
| **Cycle de vente et dépendance aux intégrations** (logiciels comptables du marché) | Commencer par un export simple (CSV/ZIP) ; intégrations après validation |
| **Objectif 10 000 € MRR** : ≈ 102 abonnés PRO, ou un mélange ~110 abonnés (45 Starter / 50 Pro / 15 Business ≈ 10 140 €). Hors attrition, coûts, support | Estimer CAC, churn et coûts avant de s'engager ; viser d'abord 10 clients payants |
| Un cabinet unique peut peser lourd ; marché de niche plutôt local (réglementations par pays) | Choisir un pays/segment de départ ; internationalisation (FR/EN) ensuite |
| **Risque de promesse excessive** : présenter la démo comme une IA fonctionnelle | Dire explicitement « maquette fonctionnelle, moteur en cours de développement » lors des démos |
| Aucun budget (0 €) : pas d'hébergement conforme, pas de pentest, pas de support | Prévoir un budget minimal avant tout client réel ; ne rien promettre avant |
