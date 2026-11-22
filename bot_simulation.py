#!/usr/bin/env python3
"""
Bot de trading EN SIMULATION UNIQUEMENT (aucun ordre réel, aucune clé API).

Données : prix journaliers publics BTC/EUR de Kraken (endpoint public, sans clé).
Capital : 100 € fictifs.

STRATÉGIE : croisement de moyennes mobiles (long uniquement)
  - moyenne rapide = moyenne des 10 dernières clôtures
  - moyenne lente  = moyenne des 30 dernières clôtures
  - rapide > lente  -> la tendance est haussière -> on ACHÈTE (tout le capital)
  - rapide < lente  -> la tendance est baissière -> on VEND tout et on reste en euros
  Le signal est calculé à la clôture du jour J, l'ordre est exécuté à l'ouverture
  du jour J+1 (on ne "voit" jamais le futur).

RÉALISME :
  - frais de 0,40 % par ordre (taker Kraken, palier de départ)
  - glissement (slippage) de 0,05 % défavorable sur chaque ordre
  - minimums d'ordre : 0,0001 BTC et 5 € ; sinon l'ordre est REFUSÉ
  - quantité arrondie à 8 décimales (vers le bas)

COMPARAISON : "acheter et conserver" = tout acheter au 1er jour exécutable
  (mêmes frais), ne plus toucher. Les deux sont valorisés en fin de période
  après déduction d'un frais de vente virtuel, pour une comparaison équitable.

Ce n'est PAS un conseil financier : les performances passées ne disent rien du futur.
"""
import argparse
import csv
import json
import sys
import urllib.request
from datetime import datetime, timezone

URL = "https://api.kraken.com/0/public/OHLC?pair={pair}&interval=1440"


def charger_prix(pair):
    req = urllib.request.Request(URL.format(pair=pair), headers={"User-Agent": "simulation-bot"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    if data.get("error"):
        raise RuntimeError("Erreur Kraken : %s" % data["error"])
    cle = next(k for k in data["result"] if k != "last")
    lignes = data["result"][cle][:-1]  # on enlève la bougie du jour, non terminée
    return [
        {"date": datetime.fromtimestamp(l[0], timezone.utc).strftime("%Y-%m-%d"),
         "open": float(l[1]), "close": float(l[4])}
        for l in lignes
    ]


def moyenne(valeurs):
    return sum(valeurs) / len(valeurs)


def max_drawdown(courbe):
    """Plus grosse baisse (en %) entre un sommet et le creux suivant."""
    sommet, pire = courbe[0], 0.0
    for v in courbe:
        sommet = max(sommet, v)
        pire = min(pire, v / sommet - 1)
    return pire * 100


class Portefeuille:
    def __init__(self, capital, frais, slippage, min_qty, min_eur):
        self.cash, self.btc = capital, 0.0
        self.frais, self.slip = frais, slippage
        self.min_qty, self.min_eur = min_qty, min_eur
        self.total_frais = 0.0
        self.ordres = []

    def _refus(self, date, sens, prix, raison):
        self.ordres.append({"date": date, "sens": sens, "statut": "REFUSÉ (%s)" % raison,
                            "prix": round(prix, 2), "quantite_btc": 0, "montant_eur": 0,
                            "frais_eur": 0, "cash_apres": round(self.cash, 2),
                            "btc_apres": self.btc})

    def acheter(self, date, ouverture):
        prix = ouverture * (1 + self.slip)
        qty = int(self.cash / (prix * (1 + self.frais)) * 1e8) / 1e8
        if qty < self.min_qty:
            return self._refus(date, "ACHAT", prix, "< min %.4f BTC" % self.min_qty)
        if qty * prix < self.min_eur:
            return self._refus(date, "ACHAT", prix, "< min %.0f €" % self.min_eur)
        montant = qty * prix
        frais = montant * self.frais
        self.cash -= montant + frais
        self.btc += qty
        self.total_frais += frais
        self._ok(date, "ACHAT", prix, qty, montant, frais)

    def vendre(self, date, ouverture):
        prix = ouverture * (1 - self.slip)
        qty = round(self.btc, 8)
        if qty < self.min_qty or qty * prix < self.min_eur:
            return self._refus(date, "VENTE", prix, "sous le minimum")
        montant = qty * prix
        frais = montant * self.frais
        self.cash += montant - frais
        self.btc = 0.0 if self.btc - qty < 1e-9 else self.btc - qty
        self.total_frais += frais
        self._ok(date, "VENTE", prix, qty, montant, frais)

    def _ok(self, date, sens, prix, qty, montant, frais):
        self.ordres.append({"date": date, "sens": sens, "statut": "EXÉCUTÉ",
                            "prix": round(prix, 2), "quantite_btc": qty,
                            "montant_eur": round(montant, 2), "frais_eur": round(frais, 2),
                            "cash_apres": round(self.cash, 2), "btc_apres": self.btc})

    def valeur(self, cours):
        return self.cash + self.btc * cours

    def valeur_liquidation(self, cours):
        """Valeur si on vendait tout au dernier cours (frais + glissement inclus)."""
        return self.cash + self.btc * cours * (1 - self.slip) * (1 - self.frais)


def simuler(prix, args):
    p = Portefeuille(args.capital, args.frais / 100, args.slippage / 100, args.min_btc, args.min_eur)
    bh = Portefeuille(args.capital, args.frais / 100, args.slippage / 100, args.min_btc, args.min_eur)
    closes = [x["close"] for x in prix]
    courbe_bot, courbe_bh = [], []
    signal_prec = None
    bh_achete = False

    for i, jour in enumerate(prix):
        # 1) exécuter les ordres décidés hier, à l'ouverture d'aujourd'hui
        if i > 0 and signal_prec is not None:
            if signal_prec == "long" and p.btc == 0:
                p.acheter(jour["date"], jour["open"])
            elif signal_prec == "cash" and p.btc > 0:
                p.vendre(jour["date"], jour["open"])
        if i > 0 and not bh_achete:
            bh.acheter(jour["date"], jour["open"])
            bh_achete = True
        # 2) valoriser à la clôture
        courbe_bot.append(p.valeur(jour["close"]))
        courbe_bh.append(bh.valeur(jour["close"]))
        # 3) calculer le signal de demain avec les clôtures connues
        if i + 1 >= args.lente:
            rapide = moyenne(closes[i + 1 - args.rapide:i + 1])
            lente = moyenne(closes[i + 1 - args.lente:i + 1])
            signal_prec = "long" if rapide > lente else "cash"
    return p, bh, courbe_bot, courbe_bh


def afficher(prix, p, bh, cb, cbh, args):
    dernier = prix[-1]["close"]
    fin_bot, fin_bh = p.valeur_liquidation(dernier), bh.valeur_liquidation(dernier)
    # le drawdown utilise la valeur de marché quotidienne (hors frais de sortie)
    print("=" * 66)
    print("  SIMULATION - aucun ordre réel, aucune clé API")
    print("=" * 66)
    print("Marché          : %s (Kraken, prix publics journaliers)" % args.pair)
    print("Période         : %s -> %s (%d jours)" % (prix[0]["date"], prix[-1]["date"], len(prix)))
    print("Stratégie       : moyennes mobiles %d/%d jours, long uniquement" % (args.rapide, args.lente))
    print("Frais / slippage: %.2f %% / %.2f %% par ordre" % (args.frais, args.slippage))
    print("Minimums d'ordre: %.4f BTC et %.0f €" % (args.min_btc, args.min_eur))
    print("Capital départ  : %.2f €" % args.capital)
    print("-" * 66)
    print("%-28s %14s %14s" % ("", "BOT", "ACHAT-CONSERVÉ"))
    print("%-28s %12.2f € %12.2f €" % ("Valeur finale (après frais)", fin_bot, fin_bh))
    print("%-28s %+12.2f € %+12.2f €" % ("Gain / perte", fin_bot - args.capital, fin_bh - args.capital))
    print("%-28s %+12.2f %% %+12.2f %%" % ("Rendement",
          (fin_bot / args.capital - 1) * 100, (fin_bh / args.capital - 1) * 100))
    print("%-28s %12.2f %% %12.2f %%" % ("Plus grosse baisse", max_drawdown(cb), max_drawdown(cbh)))
    print("%-28s %12.2f € %12.2f €" % ("Frais payés", p.total_frais, bh.total_frais))
    verdict = "BAT" if fin_bot > fin_bh else "NE BAT PAS"
    print("-" * 66)
    print("Verdict : le bot %s l'achat-conservé sur cette période (%+.2f € d'écart)."
          % (verdict, fin_bot - fin_bh))
    print("=" * 66)
    print("HISTORIQUE DES ORDRES DU BOT (%d)" % len(p.ordres))
    print("%-11s %-6s %-9s %10s %12s %10s %8s" %
          ("Date", "Sens", "Statut", "Prix €", "Qté BTC", "Montant €", "Frais €"))
    for o in p.ordres:
        print("%-11s %-6s %-9s %10.2f %12.8f %10.2f %8.2f" %
              (o["date"], o["sens"], o["statut"][:9], o["prix"], o["quantite_btc"],
               o["montant_eur"], o["frais_eur"]))
        if o["statut"].startswith("REFUSÉ"):
            print("            -> %s" % o["statut"])
    print("=" * 66)
    if p.btc > 0:
        print("Position ouverte en fin de période : %.8f BTC (valorisée au dernier cours)." % p.btc)
    print("Rappel : simulation pédagogique, pas un conseil financier.")


def main():
    # Évite les erreurs d'encodage dans la console Windows
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    a = argparse.ArgumentParser(description="Bot de trading en simulation (100 € fictifs).")
    a.add_argument("--pair", default="XBTEUR", help="paire Kraken (défaut XBTEUR)")
    a.add_argument("--capital", type=float, default=100.0)
    a.add_argument("--rapide", type=int, default=10)
    a.add_argument("--lente", type=int, default=30)
    a.add_argument("--frais", type=float, default=0.40, help="%% par ordre")
    a.add_argument("--slippage", type=float, default=0.05, help="%% par ordre")
    a.add_argument("--min-btc", type=float, default=0.0001)
    a.add_argument("--min-eur", type=float, default=5.0)
    a.add_argument("--csv", default="historique_ordres.csv", help="fichier CSV des ordres")
    args = a.parse_args()
    if args.rapide >= args.lente:
        sys.exit("--rapide doit être inférieur à --lente")

    try:
        prix = charger_prix(args.pair)
    except Exception as e:
        sys.exit("Impossible de récupérer les prix publics : %s" % e)
    if len(prix) < args.lente + 5:
        sys.exit("Pas assez de données.")

    p, bh, cb, cbh = simuler(prix, args)
    afficher(prix, p, bh, cb, cbh, args)

    if p.ordres:
        with open(args.csv, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=list(p.ordres[0].keys()), delimiter=";")
            w.writeheader()
            w.writerows(p.ordres)
        print("Historique enregistré dans : %s" % args.csv)


if __name__ == "__main__":
    main()
