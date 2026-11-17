# Audit produit — avant validation commerciale

Audit du prototype existant, réalisé en le parcourant comme un prospect (navigateur réel) puis en relisant le code. Constats vérifiés ; corrections limitées au strict nécessaire.

## 1. Utilisable réellement vs simulé

| Réel (utilisable en démo) | Simulé (à dire explicitement) |
|---|---|
| Création client/dossier, modèles de pièces, statuts, complétion, échéances | **Analyse des documents** (aucune lecture de fichier, scénarios déterministes) |
| Tableau de bord calculé, filtres, recherche, historique | Données extraites (type, période, pages, lisibilité), empreinte de doublon |
| Portail par jeton, dépôt, raison du refus, progression | Contenu des fichiers (jamais lu ni stocké), « délai d'analyse » artificiel |
| Messages FR/EN générés depuis l'état du dossier, édition, copie, relecture obligatoire | **Envoi** (désactivé), relances automatiques (inexistantes) |
| Bascule FR/EN à chaud | Paiement, comptes, authentification, chiffrement, RGPD |

## 2. Constats et décisions

| # | Constat | Gravité en démo | Décision |
|---|---|---|---|
| A1 | L'application s'ouvrait directement sur le tableau de bord : aucun contexte, un prospect ne comprend pas le problème résolu | Élevée | **Corrigé** : page de présentation à l'ouverture (`#/welcome`) + démo guidée |
| A2 | Pour un dossier tout juste créé, le message généré disait « Nous avons **bien reçu** vos documents… » alors que rien n'a été reçu | **Élevée** (incohérence visible à l'étape « demande de documents ») | **Corrigé** : formulation de première demande (`msg.intro_request`), testée FR/EN |
| A3 | Pas d'étape explicite « envoyer la demande de documents » dans le parcours | Moyenne | **Couvert** par l'assistant en mode demande (envoi toujours simulé) et l'étape 3 de la démo guidée |
| A4 | Pas de fil conducteur : les écrans sont riches mais l'ordre de découverte est laissé au présentateur | Moyenne | **Corrigé** : démo guidée en 7 étapes, qui rappelle à chaque étape ce qui est simulé |
| A5 | Un bouton « Envoyer » grisé et 8 lignes « Non implémenté » en Paramètres peuvent faire « inachevé » | Faible | **Conservé volontairement** : l'honnêteté prime ; à expliquer (voir `OBJECTIONS.md`) |
| A6 | Noms de fichiers de démonstration en français même en mode EN | Faible | Non modifié (cosmétique, données fictives) ; à signaler si démo en anglais |
| A7 | Les dates de la démo sont relatives au premier chargement (échéances, « dépassée ») | Faible | Non modifié ; « Réinitialiser la démo » ou la démo guidée repart d'un état connu |
| A8 | Le dossier « clôture annuelle » de démonstration (DOS-004) a une période mensuelle de référence alors que certaines pièces sont annuelles | Faible | Non modifié (données de démonstration) ; éviter d'ouvrir ce dossier devant un comptable pointilleux |
| A9 | Liens du portail valables seulement dans le navigateur qui détient les données | Moyenne | Documenté ; **ne pas** envoyer de lien au prospect : montrer sur votre écran |
| A10 | Le prix « Choisir (démo) » peut faire croire à une inscription | Faible | Texte « Aucun paiement — simulation » et notification déjà présents |

## 3. Éléments susceptibles de perturber un prospect

- Le mot « IA » : il sera interprété comme « ça lit mes documents ». La démo ne le fait pas. → Employer « contrôles automatisés (simulés dans la démo) », ne jamais laisser croire qu'un fichier réel est analysé.
- La densité du tableau de bord : commencer par la démo guidée plutôt que par l'application brute.
- Les 8 exigences « Non implémenté » : bonne occasion de parler sécurité, pas à cacher.
- Les prix : toujours présentés comme hypothèses (voir `PRICING_TEST.md`).

## 4. Non modifié volontairement

Fonctionnement existant, données de démonstration, moteur, règles, tarifs, tests existants (tous conservés et verts).
