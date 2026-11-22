# Réel vs simulé

## ✅ Réellement fonctionnel (en local)

- Navigation, 10 vues, routage, FR/EN à chaud (578 clés par langue, parité testée), préférence mémorisée.
- **Sauvegarde / restauration / export** : sauvegarde JSON complète de l'état (enveloppe versionnée), restauration avec validation stricte du fichier, sauvegarde obligatoire de l'état actuel puis confirmation explicite avant remplacement (aucune fusion), export CSV compatible Excel (UTF-8 avec BOM, `;` en FR / `,` en EN, protection contre l'injection de formules). Tout reste local : aucun envoi, aucun service externe.
- **Relances** : liste des dossiers à relancer (échéance dépassée > documents à corriger > documents manquants), filtres, date de dernière relance *préparée* lue dans l'historique existant (`message_approved`). Elle indique qu'un message a été relu et validé par un humain, **pas qu'il a été envoyé** : rien n'est envoyé.
- Tableau de bord : tous les chiffres et graphiques sont **calculés** depuis les données (invariants testés).
- Clients : ajout (validation + échappement), recherche, filtres pays/situation, fiche, historique.
- Dossiers : création depuis 4 modèles, filtres statut/modèle/recherche, statut et complétion **dérivés** des pièces.
- Dépôts (portail, « simuler un dépôt » côté cabinet), re-dépôts, historique d'actions, mise à jour croisée cabinet ↔ portail.
- Assistant de correction : génération FR/EN depuis l'état réel du dossier, édition, copie presse-papiers, case de relecture obligatoire, trace de l'approbation.
- Paramètres validés et persistés, réinitialisation de la démo, persistance `localStorage`.
- Calculateur de revenus récurrents (arithmétique).

## 🎭 Simulé (ne pas présenter comme réel)

| Fonction | Réalité actuelle |
|---|---|
| **Analyse documentaire / « IA »** | Moteur déterministe : le résultat dépend du **scénario choisi** ou de **mots-clés du nom de fichier** (`flou`, `copie`, `ancienne`, `partiel`, `autre`). Le contenu du fichier n'est **jamais lu**. Aucun OCR, aucun modèle. Chaque résultat est étiqueté « Simulation ». |
| Données extraites, lisibilité (%), empreinte | Valeurs fabriquées par le scénario |
| Détection de doublon | Empreinte fabriquée ; référence un autre document du dossier, sinon une « archive fictive » (`archive-demo.pdf`) |
| Dépôt de fichier | Seuls nom et taille lus ; rien n'est transmis ni stocké |
| Envoi des messages | **Désactivé** : le bouton « Envoyer » est inactif ; aucun email/SMS. « Valider » = trace interne de relecture humaine |
| Relances automatiques | Non implémentées : la page Relances est une aide à la décision, elle n'envoie ni ne planifie rien |
| Paiement / abonnement | Aucun : le bouton « Choisir » n'affiche qu'une notification |
| Prix en dollars | Taux fixe 1,08 (hypothèse), non actualisé |
| Tarifs et quotas | Hypothèses commerciales, pas des offres vendues |
| Authentification / comptes / rôles | Inexistants ; le portail s'ouvre avec un jeton visible dans l'URL |
| Multi-cabinet, isolation, chiffrement, purge, durée de conservation, journal d'accès, RGPD | **Non implémentés** (l'écran Paramètres les liste comme « Non implémenté ») ; la durée de conservation est un champ non appliqué |
| Persistance | `localStorage` du navigateur (un seul poste, pas de synchronisation). La sauvegarde JSON permet de déplacer les données **à la main** ; ce n'est ni une synchronisation ni une sauvegarde automatique. Le navigateur ne confirme pas que le fichier téléchargé a bien été enregistré : on sait seulement que le téléchargement a été déclenché sans erreur |
| Délai d'analyse (≈ 1,2 s) | Temporisation artificielle pour montrer l'état « en cours » |
| Liens du portail | Fonctionnent uniquement dans le navigateur qui détient les données (copier le lien ailleurs ne marche pas) |
