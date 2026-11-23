# Mettre la démo READYFILE AI en ligne — guide Cloudflare Pages (≈ 10 minutes)

> **Rien n'est publié tant que vous n'avez pas fait ces étapes vous-même.** Ce guide n'engage aucune dépense : Cloudflare Pages dispose d'une offre gratuite (vérifiez sur la page des tarifs Cloudflare au moment de vous inscrire ; si on vous demande une carte bancaire, arrêtez-vous et dites-le-moi).

## Ce dont vous avez besoin
- Le fichier **`readyfile-demo-public.zip`** (dans ce dossier `LIVRAISON-DEMO`).
- Une adresse e-mail pour créer un compte Cloudflare gratuit.

## Étape 1 — Créer le compte (2 min)
1. Allez sur **dash.cloudflare.com/sign-up**.
2. Saisissez votre e-mail et un mot de passe, puis confirmez l'e-mail reçu.

## Étape 2 — Déposer le ZIP (3 min)
1. Dans le menu de gauche, cliquez sur **Workers & Pages** (ou « Compute / Workers & Pages » selon l'affichage).
2. Cliquez sur **Create** (Créer) → onglet **Pages** → **Upload assets** (« Charger des ressources » / *Direct Upload*).
3. **Nom du projet** : tapez par exemple `readyfile-demo` (lettres minuscules et tirets). Ce nom devient l'adresse du site : `https://readyfile-demo.pages.dev`. S'il est déjà pris, ajoutez quelque chose (`readyfile-demo-cabinet`).
4. Cliquez sur **Create project**.
5. **Glissez-déposez le fichier `readyfile-demo-public.zip`** dans la zone de dépôt (ou cliquez pour le choisir). Ne le décompressez pas.
6. Cliquez sur **Deploy site** (Déployer).
7. Au bout de quelques secondes, Cloudflare affiche l'adresse : **`https://….pages.dev`**. C'est le lien à partager.

## Étape 3 — Vérifier AVANT de partager (3 min)
Ouvrez l'adresse **dans une fenêtre de navigation privée** (pour voir ce que verra le prospect), puis contrôlez :
- [ ] La page de présentation s'affiche, avec le bandeau bleu « Démonstration publique : l'analyse documentaire est SIMULÉE… ».
- [ ] Le cadenas HTTPS est présent dans la barre d'adresse.
- [ ] Cliquez sur **Lancer la démo guidée** et parcourez les 7 étapes jusqu'à « Terminer » (le dossier DOS-013 passe de 0 % à 50 % puis 100 %).
- [ ] Dans un dossier, cliquez sur **Copier le lien du portail** : le lien collé commence par votre adresse `https://….pages.dev/#/portal/…` (et **pas** par `localhost`).
- [ ] Ouvrez le site depuis **votre téléphone** : le menu et les pages sont lisibles.
- [ ] Il n'y a **pas** de bouton « Restaurer une sauvegarde », ni de choix de fichier réel dans le portail (seulement « Utiliser un fichier fictif »).

Si un point ne va pas : ne partagez pas le lien, et dites-moi lequel.

## Étape 4 — Partager
Copiez l'adresse `https://….pages.dev` dans votre e-mail. Quelques repères honnêtes à donner au prospect :
- Les données sont **fictives** ; l'analyse des documents est **simulée** (aucune IA ni OCR réels) ; **aucun message n'est envoyé**.
- Chaque visiteur travaille sur **sa propre copie**, dans son navigateur : rien n'est partagé entre visiteurs et vous ne voyez pas ce qu'il fait.
- Le site demande de **ne saisir aucune donnée réelle**. Il n'est pas référencé par les moteurs de recherche (balise « noindex »), mais **toute personne qui connaît le lien peut l'ouvrir**.

## Mettre à jour plus tard
Dans Cloudflare : **Workers & Pages → votre projet → Create deployment**, puis déposez le nouveau ZIP. L'adresse ne change pas.

## Retirer la démo
**Workers & Pages → votre projet → Settings → Delete project.** Le lien cesse de fonctionner.

## Ce que ce site ne fait pas
Pas de compte, pas de base de données, pas de serveur, pas d'envoi d'e-mail, pas de collecte de coordonnées. Comme pour tout site hébergé, Cloudflare peut conserver des journaux techniques d'accès (adresse IP, date) selon sa propre politique ; l'application, elle, n'envoie aucune donnée.

## En cas de problème
| Symptôme | Que faire |
|---|---|
| « Nom déjà utilisé » | Choisissez un autre nom de projet. |
| Page blanche | Vérifiez que vous avez déposé le **ZIP d'origine** (pas un dossier vide ni un ZIP contenant un sous-dossier). Redéployez. |
| Le lien du portail ne marche pas sur un autre appareil pour un dossier créé dans la démo guidée | Normal : ce dossier n'existe que dans le navigateur où il a été créé. Les dossiers d'exemple (ex. `#/portal/demo-dos-003`) fonctionnent partout. |
| Ancienne version affichée | Rechargez en forçant (Ctrl+F5) ou ouvrez une fenêtre privée. |
