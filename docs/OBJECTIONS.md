# Objections et réponses honnêtes / Objections and honest answers

> Principe : si la réponse honnête est « nous ne savons pas encore », on le dit, puis on propose comment le vérifier.
> Principle: if the honest answer is “we don't know yet”, say so, then propose how to check.

---

## 🇫🇷 Français

| # | Objection | Réponse honnête | À vérifier / action |
|---|---|---|---|
| 1 | « Mon logiciel comptable fait déjà ça. » | « Possible, certains proposent une collecte de pièces. Montrez-moi comment vous contrôlez aujourd'hui qu'une pièce est lisible, complète et du bon mois : c'est là que nous cherchons à apporter quelque chose. Si votre outil le fait bien, je préfère le savoir. » | Remplir `COMPETITORS.md` avec leur fonctionnement réel |
| 2 | « Vos analyses sont-elles fiables ? » | « **Je ne peux pas le dire : dans cette démo l'analyse est simulée.** La fiabilité réelle est le premier risque ; nous la mesurerions sur un jeu de documents consentis avant de promettre quoi que ce soit. » | Prototype OCR + évaluation (précision/rappel par type) |
| 3 | « Et si l'IA se trompe ? » | « C'est pour ça que rien n'est envoyé sans validation humaine, et que les règles de décision sont explicites. Mais je ne prétends pas que le taux d'erreur soit acceptable pour vous : quel serait votre seuil ? » | Noter le seuil déclaré (Q14) |
| 4 | « Mes clients n'utiliseront jamais un portail. » | « C'est un risque réel. Quels clients le feraient, lesquels jamais ? Un dépôt par simple lien sans compte est l'hypothèse ; nous devons la tester avec quelques-uns de vos clients. » | Pilote à petite échelle |
| 5 | « Et la sécurité / le RGPD ? » | « **Rien n'est en place aujourd'hui** : pas de chiffrement, pas d'authentification, pas d'hébergement conforme (page Paramètres). Voici ce que nous prévoirions (`FUTURE_ARCHITECTURE.md`). Aucun document réel ne doit être déposé dans cette démo. » | Prérequis avant tout pilote avec données réelles |
| 6 | « Où seraient hébergées les données ? » | « Pas décidé. Hypothèse : région UE, prestataire certifié, sous-traitants documentés. Qu'exigez-vous ? » | Noter les exigences (Q15) |
| 7 | « C'est trop cher. » | « D'accord. Par rapport à quoi ? Quel est le coût actuel du problème pour vous ? Les prix 49/99/199 € sont des **hypothèses** ; votre réaction m'aide à les ajuster. » | `PRICING_TEST.md` |
| 8 | « C'est gratuit/inclus dans mon logiciel. » | « Dans ce cas il n'y a pas de place pour nous, sauf si ce qui est inclus ne couvre pas le contrôle et la relance. Pouvez-vous me montrer ce qu'il couvre ? » | `COMPETITORS.md` |
| 9 | « Je n'ai pas le temps de changer d'outil. » | « Compris. L'idée serait de s'ajouter à l'existant sans le remplacer, mais l'intégration reste à étudier. Qu'est-ce qui rendrait l'essai quasi sans effort ? » | Cartographier les intégrations utiles |
| 10 | « Qui êtes-vous ? Serez-vous encore là dans 2 ans ? » | « Un projet en phase de validation, sans client ni financement aujourd'hui. C'est pour cela que je commence par vous écouter et que je ne vous demande aucun engagement lourd. » | Ne rien promettre de pérenne |
| 11 | « Avez-vous des références ? » | « Non, pas encore. Vous seriez parmi les premiers à influencer le produit. » | Ne jamais inventer de références |
| 12 | « Combien de temps ça me fera gagner ? » | « Je n'ai aucun chiffre mesuré. Si vous estimez perdre N heures par semaine, nous pourrons mesurer ensemble sur un pilote. » | Mesures avant/après sur pilote |
| 13 | « Et pour mes clients qui envoient tout par email/WhatsApp ? » | « Aujourd'hui non géré : seule la voie « lien de dépôt » est montrée. C'est une limite à évaluer avec vous. » | Noter le % de clients concernés (déclaré) |
| 14 | « Je veux l'essayer avec mes vrais dossiers. » | « Pas encore : sans sécurité ni conformité, ce serait irresponsable pour vous. On peut commencer par des documents **anonymisés/synthétiques**. » | Jeu de test synthétique |
| 15 | « Vous pouvez m'envoyer le lien ? » | « La démo tourne en local sur mon poste ; il n'y a pas de version publiée. Je peux la refaire avec vous en visio. » | — |

---

## 🇬🇧 English

| # | Objection | Honest answer | To verify / action |
|---|---|---|---|
| 1 | “My accounting software already does this.” | “Possibly — some offer document collection. Show me how you check today that a document is legible, complete and for the right month: that’s where we hope to add value. If your tool does it well, I’d rather know.” | Fill in `COMPETITORS.md` with how they really work |
| 2 | “Are your analyses reliable?” | “**I can’t say: in this demo the analysis is simulated.** Real reliability is the first risk; we would measure it on a consented document set before promising anything.” | OCR prototype + evaluation (precision/recall by type) |
| 3 | “What if the AI is wrong?” | “That’s why nothing is sent without human approval and decision rules are explicit. But I don’t claim the error rate would be acceptable to you: what would your threshold be?” | Record the stated threshold (Q14) |
| 4 | “My clients will never use a portal.” | “That’s a real risk. Which clients would, which never? A simple no-account upload link is the hypothesis; we must test it with a few of your clients.” | Small-scale pilot |
| 5 | “What about security / GDPR?” | “**Nothing is in place today**: no encryption, no authentication, no compliant hosting (Settings page). Here is what we would plan (`FUTURE_ARCHITECTURE.md`). No real document should be uploaded to this demo.” | Prerequisite before any pilot with real data |
| 6 | “Where would data be hosted?” | “Not decided. Hypothesis: EU region, certified provider, documented sub-processors. What do you require?” | Record requirements (Q15) |
| 7 | “It’s too expensive.” | “Understood. Compared to what? What does the problem cost you today? The €49/99/199 prices are **hypotheses**; your reaction helps me adjust them.” | `PRICING_TEST.md` |
| 8 | “It’s free/included in my software.” | “Then there is no room for us, unless what’s included doesn’t cover checking and follow-up. Can you show me what it covers?” | `COMPETITORS.md` |
| 9 | “I have no time to change tools.” | “Understood. The idea would be to add to what exists without replacing it, but integration still needs study. What would make a trial almost effortless?” | Map useful integrations |
| 10 | “Who are you? Will you be around in 2 years?” | “A project in validation, with no customers or funding today. That’s why I start by listening and ask for no heavy commitment.” | Promise nothing long-term |
| 11 | “Do you have references?” | “No, not yet. You would be among the first to influence the product.” | Never invent references |
| 12 | “How much time will it save me?” | “I have no measured figure. If you estimate losing N hours a week, we could measure together in a pilot.” | Before/after pilot measurements |
| 13 | “What about clients who send everything by email/WhatsApp?” | “Not handled today: only the upload-link route is shown. That’s a limit to assess with you.” | Note the (stated) share of such clients |
| 14 | “I want to try it with my real files.” | “Not yet: without security or compliance it would be irresponsible for you. We can start with **anonymised/synthetic** documents.” | Synthetic test set |
| 15 | “Can you send me the link?” | “The demo runs locally on my machine; there is no published version. I can run it again with you by video.” | — |
