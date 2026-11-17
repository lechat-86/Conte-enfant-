# Architecture proposée — version commercialisable

> Proposition, rien de ceci n'est construit. À valider par un test de marché avant tout investissement.

## Vue d'ensemble

```
Navigateur (cabinet)  ─┐                       ┌─ File de jobs (analyse asynchrone)
Portail client (jeton) ─┼─► CDN/WAF ─► API ─────┤        │
                        │     (TLS)   (auth,    │        ▼
                        │              RBAC)    │   Workers d'analyse : OCR → classification → extraction
                        │                │      │        │  (modèle d'IA, appelé côté serveur uniquement)
                        │                ▼      │        ▼
                        │     PostgreSQL (RLS)  └─► Règles métier (domain/rules) → verdict + journal
                        │     Stockage objet chiffré (documents)
                        └─► Service de messagerie (envoi après validation humaine)
```

## Choix recommandés

| Domaine | Proposition | Raison |
|---|---|---|
| Frontend | TypeScript + framework à composants (React/Vue/Svelte) + i18n à clés (on garde `fr/en`) | Migration naturelle : `views/`+`ui/` seulement ; `domain/` reste tel quel |
| API | TypeScript (Node) ou Python (FastAPI), REST + OpenAPI | Réutilise `domain/` ; typage des contrats |
| Base | PostgreSQL avec **Row-Level Security** par `tenant_id` | Isolation entre cabinets garantie par la base, pas seulement par le code |
| Documents | Stockage objet UE, **chiffrement par cabinet** (KMS), URL signées à courte durée, antivirus à l'upload | Confidentialité, durée de vie maîtrisée |
| Analyse | Workers asynchrones ; contrat `engine.analyze()` déjà défini ; OCR open source auto-hébergé en premier, LLM via fournisseur UE avec DPA ; verdict par règles | Coût maîtrisé, auditabilité |
| Authentification | OIDC/SSO, MFA pour les utilisateurs du cabinet ; **liens client à jeton aléatoire, expirable, révocable** (+ code optionnel) | Remplace l'accès « jeton visible » du prototype |
| Autorisations | RBAC (propriétaire, collaborateur, lecture), vérification systématique du `tenant_id` | Contrôle d'accès par utilisateur |
| Audit | Journal immuable (qui, quoi, quand, IP) consultable par le cabinet | Journalisation des accès |
| Conservation | Politique par type de document, purge planifiée + preuve de purge, suppression sur demande | Durées configurables, droit à l'effacement |
| RGPD | Registre des traitements, DPA, export/effacement des données d'un client final, gestion du consentement au dépôt | Droits des personnes |
| Messagerie | Envoi par un fournisseur de messagerie transactionnelle **uniquement après validation humaine** (déjà modélisée), traçabilité de l'approbation | Conserve la règle « humain dans la boucle » |
| Observabilité | Logs structurés **sans contenu de documents**, métriques de précision par type de pièce, alertes | Qualité et sécurité |
| Qualité | CI : tests unitaires `domain/`, tests de contrat du moteur, e2e Playwright, SAST/dépendances | Réutilise la suite actuelle |
| Facturation | Fournisseur de paiement (à choisir plus tard), plans `starter/pro/business` déjà modélisés dans `domain/pricing.js` | Aucun paiement tant que la demande n'est pas validée |

## Feuille de route suggérée

0. **Validation du besoin** (sans code supplémentaire) : 10–15 démos à des cabinets, mesurer l'intérêt réel et la volonté de payer.
1. **MVP réel étroit** : un type de pièce (relevé bancaire), un pays, OCR + règles, humain dans la boucle, quelques cabinets pilotes sous contrat et DPA.
2. Sécurité/conformité de base (chiffrement, isolation, audit, purge) **avant** les données réelles.
3. Relances automatiques, modèles de dossiers, exports, intégrations comptables.
4. Mesure continue de la précision ; passage à l'échelle ; paiement.

## Ce qu'on conserve du prototype

`domain/` (règles + tests), le contrat du moteur, les messages FR/EN, le modèle de dossiers/pièces/événements, le design system, la suite e2e comme spécification exécutable.
