# Stratégie de test des prix / Price-testing strategy

> Les prix **49 / 99 / 199 € par mois** sont des **hypothèses de travail**, pas des prix validés. Ils ne reposent sur aucune donnée de marché. Ce document décrit comment les tester sans les présenter comme établis.
> The **€49 / €99 / €199 per month** prices are **working hypotheses**, not validated prices. They rest on no market data. This document describes how to test them without presenting them as established.

---

## 🇫🇷 Français

### 1. Principes
1. **Valeur avant prix** : comprendre la douleur et le coût actuel (entretien §2 et §5) avant d'évoquer un chiffre.
2. **Questions ouvertes d'abord**, grille ensuite : on ne s'ancre pas sur nos chiffres.
3. **Engagement > opinion** : un prix « raisonnable » dit à l'oral vaut peu ; une lettre d'intention ou un pilote payé vaut beaucoup.
4. **Honnêteté** : toujours dire « hypothèses », « produit en développement, analyse simulée ». Pas de fausse rareté, pas de remise « limitée », pas de prix « de lancement ».
5. **Aucun paiement** ni abonnement ne sont encaissés par ce prototype. Tout accord éventuel se fait hors du produit, par écrit, avec un périmètre clair (pilote), et selon les règles légales applicables : à faire valider juridiquement avant le premier engagement financier.
6. Petit échantillon : on cherche des **signaux directionnels**, pas une significativité statistique.

### 2. Protocole (à appliquer en entretien, après la section 5)
**Étape A — Questions de sensibilité au prix (Van Westendorp), posées à l'oral, sans montrer la grille :**
1. À partir de quel prix mensuel diriez-vous « c'est tellement bon marché que je doute de la qualité » ?
2. « C'est une affaire, un bon prix » ?
3. « C'est cher, mais je pourrais encore l'envisager » ?
4. « C'est trop cher, je n'achèterais pas » ?

**Étape B — Mesure par la valeur :** « Vous estimez perdre ~N h/mois sur le sujet (déclaré). À quel coût horaire interne ? » → valeur annuelle déclarée (ancrage sur la valeur, non sur nos prix).

**Étape C — Grille indicative (une variante par entretien, en rotation) :**
| Variante | Starter | Pro | Business | Rôle |
|---|---|---|---|---|
| A (actuelle) | 49 € | 99 € | 199 € | Référence |
| B (haute) | 79 € | 149 € | 299 € | Teste la marge de hausse |
| C (basse) | 29 € | 59 € | 129 € | Teste la sensibilité |
Annoncer : « Voici des **hypothèses**, je cherche votre réaction, pas votre accord. » Noter : offre choisie (ou aucune), réaction spontanée, ce qui ferait changer d'offre.

**Étape D — Test de métrique :** « Cela vous semble-t-il plus juste par utilisateur, par client actif suivi, ou par document analysé ? » (les offres actuelles mêlent les trois : utilisateurs, clients actifs, documents/mois.)

**Étape E — Échelle d'engagement** (voir `VALIDATION_SCORECARD.md`) : « Si c'était disponible à ce prix, que faudrait-il pour que vous signiez un pilote de 3 mois ? »

### 3. Tableau de relevé
| Cabinet | Variante montrée | Offre choisie | Trop bas / Bon / Cher / Trop cher (Étape A) | Valeur déclarée (B) | Métrique préférée (D) | Niveau d'engagement (E) | Notes |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

### 4. Lecture et décisions
- **Plancher de prix** (utilisé dans la grille de validation) : le prix mensuel minimal (par exemple l'offre Starter) que la majorité des cabinets *intéressés* déclarent acceptable *et* accompagné d'un engagement ≥ niveau 3. À définir **avant** les entretiens.
- Si la variante C est choisie plus souvent que A sans écart d'engagement → hypothèse « prix trop haut ».
- Si la variante B reçoit autant d'engagement que A → marge de hausse à explorer.
- Si personne ne choisit Business → vérifier si l'offre est comprise ou inutile.
- Si les cabinets préfèrent un prix par client suivi → revoir la structure des offres.
- Ne **pas** conclure avant ≥ 10 entretiens qualifiés ; ne pas modifier la grille entre deux entretiens d'une même série.

### 5. Économie unitaire à documenter avant toute décision de prix
- Coût par document analysé (OCR + modèle) — **inconnu aujourd'hui**.
- Coût d'hébergement conforme, support, acquisition — **inconnus**.
- Exemple de contrôle de cohérence : 49 €/mois pour 200 documents ≈ 0,25 € par document avant tout autre coût.
- Objectif de 10 000 € MRR : ≈ 102 abonnés Pro, ou un mélange (45 Starter / 50 Pro / 15 Business ≈ 10 140 €) — sans attrition ni coûts (voir `RISKS.md`).

### 6. Ce que l'on ne fait pas
- Présenter la page « Offres » comme une offre commerciale.
- Dire « premiers clients à ce prix à vie » ou toute promesse de garantie de prix.
- Prendre un paiement ou une carte bancaire pour un produit qui n'existe pas encore.
- Inventer une comparaison chiffrée avec des concurrents non vérifiés.

---

## 🇬🇧 English

### 1. Principles
1. **Value before price**: understand the pain and current cost (interview §2 and §5) before mentioning a number.
2. **Open questions first**, grid afterwards: do not anchor on our numbers.
3. **Commitment > opinion**: a “reasonable” price said aloud is worth little; a letter of intent or a paid pilot is worth a lot.
4. **Honesty**: always say “hypotheses”, “product in development, analysis simulated”. No false scarcity, no “limited” discount, no “launch price”.
5. **No payment** or subscription is collected by this prototype. Any agreement happens outside the product, in writing, with a clear scope (pilot), and under applicable legal rules: have it reviewed legally before the first financial commitment.
6. Small sample: look for **directional signals**, not statistical significance.

### 2. Protocol (apply in interviews, after section 5)
**Step A — Price-sensitivity questions (Van Westendorp), asked aloud without showing the grid:**
1. At what monthly price would you say “so cheap I doubt the quality”?
2. “A bargain, a good price”?
3. “Expensive, but I could still consider it”?
4. “Too expensive, I would not buy”?

**Step B — Value measurement:** “You estimate losing ~N h/month on this (stated). At what internal hourly cost?” → stated annual value (anchor on value, not on our prices).

**Step C — Indicative grid (one variant per interview, rotated):**
| Variant | Starter | Pro | Business | Role |
|---|---|---|---|---|
| A (current) | €49 | €99 | €199 | Reference |
| B (high) | €79 | €149 | €299 | Tests headroom for higher prices |
| C (low) | €29 | €59 | €129 | Tests sensitivity |
Say: “These are **hypotheses**; I want your reaction, not your agreement.” Record: plan chosen (or none), spontaneous reaction, what would make them switch plan.

**Step D — Metric test:** “Does it feel fairer per user, per active client tracked, or per document analysed?” (current plans mix all three: users, active clients, documents/month.)

**Step E — Commitment ladder** (see `VALIDATION_SCORECARD.md`): “If it were available at this price, what would it take for you to sign a 3-month pilot?”

### 3. Recording table
| Firm | Variant shown | Plan chosen | Too low / Good / Expensive / Too expensive (Step A) | Stated value (B) | Preferred metric (D) | Commitment level (E) | Notes |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

### 4. Reading and decisions
- **Price floor** (used in the validation scorecard): the minimum monthly price (e.g. the Starter plan) that most *interested* firms say is acceptable *and* with commitment ≥ level 3. Define **before** the interviews.
- If variant C is chosen more often than A with no difference in commitment → “price too high” hypothesis.
- If variant B gets as much commitment as A → headroom to explore.
- If nobody picks Business → check whether the plan is misunderstood or unnecessary.
- If firms prefer per-tracked-client pricing → rework the plan structure.
- Do **not** conclude before ≥ 10 qualified interviews; do not change the grid between interviews in the same series.

### 5. Unit economics to document before any pricing decision
- Cost per analysed document (OCR + model) — **unknown today**.
- Compliant hosting, support, acquisition costs — **unknown**.
- Sanity check: €49/month for 200 documents ≈ €0.25 per document before any other cost.
- €10,000 MRR target: ≈ 102 Pro subscribers, or a mix (45 Starter / 50 Pro / 15 Business ≈ €10,140) — ignoring churn and costs (see `RISKS.md`).

### 6. What we do not do
- Present the “Plans” page as a commercial offer.
- Say “first customers at this price for life” or any price-guarantee promise.
- Take a payment or card for a product that does not exist yet.
- Invent numeric comparisons with unverified competitors.
