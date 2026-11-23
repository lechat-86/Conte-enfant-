# Livraison — démo publique READYFILE AI

| Fichier | Rôle |
|---|---|
| `readyfile-demo-public.zip` | **À déposer sur Cloudflare Pages.** Contient uniquement le site statique (index.html à la racine). |
| `GUIDE-DEPLOIEMENT-CLOUDFLARE.md` | Guide pas à pas, sans prérequis technique. |
| `captures/` | 16 captures haute résolution de la vraie interface (sans barre de navigateur) pour le PDF commercial : 13 en français (dont 3 mobiles), 3 en anglais. |
| `../DEMO-PUBLIC/` | Le même site, non compressé (identique au contenu du ZIP). |

Régénérer : `npm run build:demo` (site + ZIP) · `node scripts/capture-screenshots.mjs` (captures) · `npm run test:public` (tests de la démo publique).

## Ce que la démo publique contient
Présentation commerciale, démo guidée en 7 étapes, tableau de bord, clients, dossiers, relances, analyse documentaire (simulée), portail client (dépôts simulés), paramètres (export de données fictives uniquement), FR/EN.

## Ce qui a été retiré ou désactivé volontairement
- **Tout READYFILE GROWTH** (prospects, notes, modèles de messages), les tests, la documentation interne, les scripts, le serveur Node, `package.json`.
- **Restauration de sauvegardes** et **toute sélection de fichier réel** (le dépôt reste simulé : « Utiliser un fichier fictif »).
- **Page « Offres & tarifs » et section tarifs de la présentation** : ce sont des hypothèses commerciales non validées et un calculateur de revenus interne. À réintégrer si vous le décidez.
- Indexation par les moteurs de recherche (`noindex`, `robots.txt`).
