#!/usr/bin/env python3
"""
Bot de trading EN SIMULATION UNIQUEMENT (aucun ordre réel, aucune clé API).

Données : historique journalier public BTC/EUR de Coinbase Exchange (sans clé),
          depuis avril 2015, mis en cache dans un fichier CSV local.

STRATÉGIE FIXE (constantes RAPIDE/LENTE, volontairement non modifiables en ligne
de commande pour ne pas être tentée de l'ajuster après avoir vu un résultat) :
  - moyenne des 10 dernières clôtures > moyenne des 30 dernières -> position BTC
  - sinon -> position en euros
  Le signal est calculé à la clôture du jour J, l'ordre est exécuté à l'OUVERTURE
  du jour J+1. Long uniquement.

RÉALISME (inchangé) : 100 € fictifs, frais 0,40 % par ordre, glissement 0,05 %
  défavorable, minimums d'ordre 0,0001 BTC et 5 €, quantité arrondie à 8 décimales.

DEUX MODES
  python bot_simulation.py test     historique coupé en périodes chronologiques ;
                                    sur chaque période, bot vs BTC conservé vs euros
  python bot_simulation.py suivi    simulation sur les PROCHAINS jours, état sauvegardé
                                    entre les exécutions (à relancer chaque jour)

Ce n'est pas un conseil financier : les performances passées ne disent rien du futur.
"""
import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

# ----------------------------------------------------------------------------
# Paramètres FIXES (ne pas ajuster après avoir regardé un résultat)
# ----------------------------------------------------------------------------
CAPITAL = 100.0
RAPIDE, LENTE = 10, 30
FRAIS = 0.0040        # 0,40 % par ordre
SLIPPAGE = 0.0005     # 0,05 % défavorable
MIN_BTC = 0.0001
MIN_EUR = 5.0

# Fenêtre dont le résultat (stratégie 10/30) a déjà été affiché lors d'un essai
# précédent. Aucun réglage n'en a été tiré, mais elle n'est plus "vierge".
FENETRE_DEJA_VUE = ("2024-12-02", "2026-11-21")

COINBASE = ("https://api.exchange.coinbase.com/products/BTC-EUR/candles"
            "?granularity=86400&start={}&end={}")
DEBUT_HISTORIQUE = datetime(2015, 4, 1, tzinfo=timezone.utc)
FMT_ISO = "%Y-%m-%dT%H:%M:%SZ"


# ----------------------------------------------------------------------------
# Données publiques
# ----------------------------------------------------------------------------
def _jour_utc(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d")


def lire_cache(chemin):
    if not os.path.exists(chemin):
        return []
    with open(chemin, newline="", encoding="utf-8") as f:
        return [{"date": r["date"], "open": float(r["open"]), "close": float(r["close"])}
                for r in csv.DictReader(f)]


def ecrire_cache(chemin, data):
    tmp = chemin + ".tmp"
    with open(tmp, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["date", "open", "close"])
        w.writeheader()
        w.writerows(data)
    os.replace(tmp, chemin)


def _requete(url):
    for essai in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "simulation-bot"})
            with urllib.request.urlopen(req, timeout=30) as r:
                bloc = json.load(r)
            if isinstance(bloc, list):
                return bloc
            raise RuntimeError("réponse inattendue : %s" % str(bloc)[:120])
        except (urllib.error.URLError, RuntimeError):
            if essai == 3:
                raise
            time.sleep(1.5 * (essai + 1))


def telecharger(depuis):
    """Bougies journalières Coinbase [temps, bas, haut, ouverture, clôture, volume]."""
    jours = {}
    debut, maintenant = depuis, datetime.now(timezone.utc)
    while debut <= maintenant:
        fin = min(debut + timedelta(days=299), maintenant)  # max 300 bougies / requête
        for c in _requete(COINBASE.format(debut.strftime(FMT_ISO), fin.strftime(FMT_ISO))):
            jours[_jour_utc(c[0])] = {"date": _jour_utc(c[0]), "open": float(c[3]),
                                      "close": float(c[4])}
        debut = fin + timedelta(days=1)
        time.sleep(0.4)
    return jours


def charger_donnees(chemin_cache, hors_ligne=False):
    """Jours CLOS uniquement (la bougie du jour UTC en cours est exclue)."""
    cache = lire_cache(chemin_cache)
    maintenant = datetime.now(timezone.utc)
    aujourdhui = maintenant.strftime("%Y-%m-%d")
    veille = (maintenant - timedelta(days=1)).strftime("%Y-%m-%d")
    if not hors_ligne and not (cache and cache[-1]["date"] >= veille):
        try:
            if cache:
                depuis = datetime.strptime(cache[-1]["date"], "%Y-%m-%d").replace(
                    tzinfo=timezone.utc) + timedelta(days=1)
            else:
                depuis = DEBUT_HISTORIQUE
            print("Téléchargement des prix publics Coinbase depuis %s ..." % depuis.date())
            fusion = {d["date"]: d for d in cache}
            fusion.update(telecharger(depuis))
            cache = [fusion[k] for k in sorted(fusion) if k < aujourdhui]
            ecrire_cache(chemin_cache, cache)
        except Exception as e:
            if not cache:
                sys.exit("Impossible de récupérer les prix publics : %s" % e)
            print("ATTENTION : téléchargement impossible (%s) -> cache local utilisé." % e)
    data = [d for d in cache if d["date"] < aujourdhui]
    if len(data) < LENTE + 10:
        sys.exit("Pas assez de données.")
    return data


# ----------------------------------------------------------------------------
# Stratégie et portefeuille simulé
# ----------------------------------------------------------------------------
def moyenne(v):
    return sum(v) / len(v)


def signal(closes, i):
    """Signal calculé avec les clôtures jusqu'au jour i inclus ; exécuté le jour i+1."""
    if i + 1 < LENTE:
        return None
    return "long" if moyenne(closes[i + 1 - RAPIDE:i + 1]) > moyenne(closes[i + 1 - LENTE:i + 1]) else "cash"


def max_drawdown(courbe):
    """Plus grosse baisse (%) entre un sommet et le creux suivant."""
    sommet, pire = courbe[0], 0.0
    for v in courbe:
        sommet = max(sommet, v)
        pire = min(pire, v / sommet - 1)
        # sommet > 0 toujours : le capital fictif ne peut pas devenir négatif
    return pire * 100


class Portefeuille:
    def __init__(self, cash=CAPITAL, btc=0.0, total_frais=0.0, ordres=None):
        self.cash, self.btc, self.total_frais = cash, btc, total_frais
        self.ordres = ordres if ordres is not None else []

    def to_dict(self):
        return {"cash": self.cash, "btc": self.btc, "total_frais": self.total_frais,
                "ordres": self.ordres}

    @classmethod
    def from_dict(cls, d):
        return cls(d["cash"], d["btc"], d["total_frais"], d["ordres"])

    def _note(self, date, sens, statut, raison, prix, qty, montant, frais):
        self.ordres.append({"date": date, "sens": sens, "statut": statut, "raison": raison,
                            "prix": round(prix, 2), "quantite_btc": qty,
                            "montant_eur": round(montant, 2), "frais_eur": round(frais, 2),
                            "cash_apres": round(self.cash, 2), "btc_apres": self.btc})

    def acheter(self, date, ouverture):
        prix = ouverture * (1 + SLIPPAGE)
        qty = int(self.cash / (prix * (1 + FRAIS)) * 1e8) / 1e8
        if qty < MIN_BTC:
            return self._note(date, "ACHAT", "REFUSÉ", "sous %.4f BTC" % MIN_BTC, prix, 0, 0, 0)
        if qty * prix < MIN_EUR:
            return self._note(date, "ACHAT", "REFUSÉ", "sous %.0f €" % MIN_EUR, prix, 0, 0, 0)
        montant = qty * prix
        frais = montant * FRAIS
        self.cash -= montant + frais
        self.btc += qty
        self.total_frais += frais
        self._note(date, "ACHAT", "EXÉCUTÉ", "", prix, qty, montant, frais)

    def vendre(self, date, ouverture):
        prix = ouverture * (1 - SLIPPAGE)
        qty = round(self.btc, 8)
        if qty < MIN_BTC or qty * prix < MIN_EUR:
            return self._note(date, "VENTE", "REFUSÉ", "sous le minimum", prix, 0, 0, 0)
        montant = qty * prix
        frais = montant * FRAIS
        self.cash += montant - frais
        self.btc = 0.0 if self.btc - qty < 1e-9 else self.btc - qty
        self.total_frais += frais
        self._note(date, "VENTE", "EXÉCUTÉ", "", prix, qty, montant, frais)

    def valeur(self, cours):
        return self.cash + self.btc * cours

    def frais_sortie(self, cours):
        """Frais d'une vente virtuelle de la position restante (0 si en euros)."""
        return self.btc * cours * (1 - SLIPPAGE) * FRAIS

    def valeur_liquidation(self, cours):
        """Valeur si l'on vendait tout au dernier cours (frais + glissement inclus)."""
        return self.cash + self.btc * cours * (1 - SLIPPAGE) * (1 - FRAIS)


class Suivi:
    """Un bot + ses deux références, avancé jour après jour (même code pour le
    test historique et pour le suivi sur les prochains jours)."""

    def __init__(self):
        self.bot, self.bh = Portefeuille(), Portefeuille()
        self.signal = None          # décidé à la clôture du jour précédent
        self.bh_achete = False
        self.courbe_bot, self.courbe_bh = [CAPITAL], [CAPITAL]
        self.premiere_date = self.derniere_date = None
        self.premier_open, self.dernier_close = None, 0.0

    def jour(self, date, ouverture, cloture, signal_suivant):
        # 1) ordres décidés hier, exécutés à l'ouverture d'aujourd'hui
        if self.signal == "long" and self.bot.btc == 0:
            self.bot.acheter(date, ouverture)
        elif self.signal == "cash" and self.bot.btc > 0:
            self.bot.vendre(date, ouverture)
        if not self.bh_achete:
            self.bh.acheter(date, ouverture)
            self.bh_achete = True
        # 2) valorisation à la clôture
        self.courbe_bot.append(self.bot.valeur(cloture))
        self.courbe_bh.append(self.bh.valeur(cloture))
        if self.premiere_date is None:
            self.premiere_date, self.premier_open = date, ouverture
        self.derniere_date, self.dernier_close = date, cloture
        # 3) signal de demain, avec les seules clôtures connues
        self.signal = signal_suivant

    def to_dict(self):
        return {"bot": self.bot.to_dict(), "bh": self.bh.to_dict(), "signal": self.signal,
                "bh_achete": self.bh_achete, "courbe_bot": self.courbe_bot,
                "courbe_bh": self.courbe_bh, "premiere_date": self.premiere_date,
                "derniere_date": self.derniere_date, "premier_open": self.premier_open,
                "dernier_close": self.dernier_close}

    @classmethod
    def from_dict(cls, d):
        s = cls()
        s.bot, s.bh = Portefeuille.from_dict(d["bot"]), Portefeuille.from_dict(d["bh"])
        for k in ("signal", "bh_achete", "courbe_bot", "courbe_bh", "premiere_date",
                  "derniere_date", "premier_open", "dernier_close"):
            setattr(s, k, d[k])
        return s


def resume(sim):
    c = sim.dernier_close
    def ligne(p, courbe):
        valeur = p.valeur_liquidation(c)
        return {"valeur": valeur, "gain": valeur - CAPITAL,
                "pct": (valeur / CAPITAL - 1) * 100, "baisse": max_drawdown(courbe),
                "executes": sum(o["statut"] == "EXÉCUTÉ" for o in p.ordres),
                "refuses": sum(o["statut"] == "REFUSÉ" for o in p.ordres),
                "frais": p.total_frais + p.frais_sortie(c)}
    return {"bot": ligne(sim.bot, sim.courbe_bot), "bh": ligne(sim.bh, sim.courbe_bh),
            "eur": {"valeur": CAPITAL, "gain": 0.0, "pct": 0.0, "baisse": 0.0,
                    "executes": 0, "refuses": 0, "frais": 0.0}}


# ----------------------------------------------------------------------------
# Affichage
# ----------------------------------------------------------------------------
def afficher_bloc(sim):
    r = resume(sim)
    cols = [r["bot"], r["bh"], r["eur"]]
    def lig(nom, f):
        print("  %-30s" % nom + "".join("%17s" % f(c) for c in cols))
    print("  %-30s%17s%17s%17s" % ("", "BOT 10/30", "BTC CONSERVÉ", "RESTER EN EUROS"))
    lig("Valeur finale (après frais)", lambda c: "%.2f €" % c["valeur"])
    lig("Gain / perte", lambda c: "%+.2f €" % c["gain"])
    lig("Rendement", lambda c: "%+.2f %%" % c["pct"])
    lig("Plus grosse baisse", lambda c: "%.2f %%" % c["baisse"])
    lig("Ordres exécutés (refusés)", lambda c: "%d (%d)" % (c["executes"], c["refuses"]))
    lig("Frais totaux", lambda c: "%.2f €" % c["frais"])


def afficher_ordres(ordres, indent="  "):
    if not ordres:
        print(indent + "(aucun ordre)")
        return
    print(indent + "%-11s %-6s %-8s %10s %12s %10s %8s" %
          ("Date", "Sens", "Statut", "Prix €", "Qté BTC", "Montant €", "Frais €"))
    for o in ordres:
        txt = indent + "%-11s %-6s %-8s %10.2f %12.8f %10.2f %8.2f" % (
            o["date"], o["sens"], o["statut"], o["prix"], o["quantite_btc"],
            o["montant_eur"], o["frais_eur"])
        print(txt + ("   (%s)" % o["raison"] if o["raison"] else ""))


def entete(titre):
    print("\n" + "=" * 70)
    print(titre)
    print("=" * 70)


def parametres():
    print("Stratégie fixe  : moyennes mobiles %d/%d jours, long uniquement" % (RAPIDE, LENTE))
    print("Exécution       : à l'OUVERTURE du jour suivant le signal")
    print("Frais/glissement: %.2f %% / %.2f %% par ordre ; minimums %.4f BTC et %.0f €"
          % (FRAIS * 100, SLIPPAGE * 100, MIN_BTC, MIN_EUR))
    print("Capital         : %.0f € fictifs (aucune clé API, aucun ordre réel)" % CAPITAL)


# ----------------------------------------------------------------------------
# Mode 1 : test sur périodes chronologiques
# ----------------------------------------------------------------------------
def simuler_periode(data, closes, s, e):
    sim = Suivi()
    sim.signal = signal(closes, s - 1)   # décidé à la clôture de la veille de la période
    for i in range(s, e):
        sim.jour(data[i]["date"], data[i]["open"], data[i]["close"], signal(closes, i))
    return sim


def mode_test(data, nb_periodes, montrer_ordres, csv_ordres):
    closes = [d["close"] for d in data]
    entete("SIMULATION - TEST SUR PÉRIODES CHRONOLOGIQUES")
    manquants = (datetime.strptime(data[-1]["date"], "%Y-%m-%d")
                 - datetime.strptime(data[0]["date"], "%Y-%m-%d")).days + 1 - len(data)
    print("Source          : Coinbase Exchange BTC/EUR, bougies journalières publiques")
    print("Historique      : %s -> %s (%d jours, %d jour(s) manquant(s) à la source)"
          % (data[0]["date"], data[-1]["date"], len(data), manquants))
    parametres()
    print("Échauffement    : les %d premiers jours ne servent qu'à calculer les moyennes" % LENTE)

    debut_eval = LENTE
    n = len(data) - debut_eval
    bornes = [debut_eval + round(j * n / nb_periodes) for j in range(nb_periodes + 1)]
    lignes_resume, tous_ordres = [], []

    for j in range(nb_periodes):
        s, e = bornes[j], bornes[j + 1]
        sim = simuler_periode(data, closes, s, e)
        dates = [d["date"] for d in data[s:e]]
        vus = sum(FENETRE_DEJA_VUE[0] <= d <= FENETRE_DEJA_VUE[1] for d in dates)
        role = "TEST FINAL (hold-out)" if j == nb_periodes - 1 else "développement"
        btc_pct = (sim.dernier_close / sim.premier_open - 1) * 100
        print("\nPÉRIODE %d/%d - %s" % (j + 1, nb_periodes, role))
        print("  Dates : %s -> %s (%d jours)   BTC : %.0f € -> %.0f € (%+.1f %%)"
              % (dates[0], dates[-1], len(dates), sim.premier_open, sim.dernier_close, btc_pct))
        print("  Déjà affichée lors d'un essai précédent : %.0f %% de la période"
              % (100 * vus / len(dates)))
        afficher_bloc(sim)
        if montrer_ordres:
            print("  Ordres du bot :")
            afficher_ordres(sim.bot.ordres, indent="    ")
        r = resume(sim)
        lignes_resume.append((j + 1, dates[0], dates[-1], r, 100 * vus / len(dates)))
        for o in sim.bot.ordres:
            tous_ordres.append(dict(o, periode=j + 1))

    entete("RÉCAPITULATIF (rendement après frais ; entre parenthèses : plus grosse baisse)")
    print("%-3s %-23s %15s %15s %9s %9s" % ("P", "Dates", "BOT", "BTC CONSERVÉ", "EUROS", "ordres"))
    for num, d0, d1, r, _ in lignes_resume:
        print("%-3d %-23s %15s %15s %9s %9d" % (
            num, "%s>%s" % (d0[2:], d1[2:]),
            "%+.1f%% (%.0f%%)" % (r["bot"]["pct"], r["bot"]["baisse"]),
            "%+.1f%% (%.0f%%)" % (r["bh"]["pct"], r["bh"]["baisse"]),
            "0.0%", r["bot"]["executes"]))
    bat_bh = sum(r["bot"]["valeur"] > r["bh"]["valeur"] for _, _, _, r, _ in lignes_resume)
    bat_eur = sum(r["bot"]["valeur"] > CAPITAL for _, _, _, r, _ in lignes_resume)
    print("\nLe bot fait mieux que BTC conservé sur %d période(s) sur %d, "
          "et mieux que les euros sur %d sur %d." % (bat_bh, nb_periodes, bat_eur, nb_periodes))

    entete("LIMITES À LIRE AVANT DE CONCLURE")
    print("- Aucun paramètre n'a été réglé sur ces données : 10/30 est fixé dans le code.")
    print("- Il n'existe PAS de période réellement indépendante : la dernière période")
    print("  recoupe une fenêtre dont le résultat avait déjà été affiché lors d'un essai")
    print("  précédent (voir le pourcentage 'déjà affichée'), et l'historique BTC est connu de tous.")
    print("  La seule vraie preuve hors échantillon = le mode 'suivi' (prochains jours) :")
    print("      python bot_simulation.py suivi")
    print("- Peu d'ordres par période : un écart de quelques points n'est pas significatif.")
    print("- Le bitcoin est très volatil ; ce n'est pas un conseil financier.")

    if tous_ordres:
        champs = ["periode"] + [k for k in tous_ordres[0] if k != "periode"]
        with open(csv_ordres, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=champs, delimiter=";")
            w.writeheader()
            w.writerows(tous_ordres)
        print("\nHistorique des ordres du bot enregistré dans : %s" % csv_ordres)


# ----------------------------------------------------------------------------
# Mode 2 : suivi sur les prochains jours, état sauvegardé
# ----------------------------------------------------------------------------
def sauver_etat(chemin, etat):
    tmp = chemin + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(etat, f, ensure_ascii=False, indent=1)
    os.replace(tmp, chemin)


def mode_suivi(data, chemin_etat, reset=False):
    closes = [d["close"] for d in data]
    etat = None
    if os.path.exists(chemin_etat) and not reset:
        try:
            with open(chemin_etat, encoding="utf-8") as f:
                etat = json.load(f)
            sim = Suivi.from_dict(etat["sim"])
        except (ValueError, KeyError) as e:
            sys.exit("Fichier d'état illisible (%s). Relancez avec --reset pour repartir "
                     "de zéro (cela efface l'historique du suivi)." % e)
    nouveaux = 0
    if etat is None:
        i = len(data) - 1
        sim = Suivi()
        sim.signal = signal(closes, i)
        etat = {"version": 1, "debut": data[i]["date"], "derniere_date": data[i]["date"]}
        sauver_etat(chemin_etat, dict(etat, sim=sim.to_dict()))
        entete("SUIVI EN SIMULATION - NOUVEAU DÉPART")
        print("Départ à la clôture du %s avec %.0f € fictifs." % (data[i]["date"], CAPITAL))
        print("Signal calculé à cette clôture : %s -> premier ordre possible à l'OUVERTURE du jour suivant."
              % ("position BTC" if sim.signal == "long" else "rester en euros"))
        print("Rien n'est exécuté avec des prix postérieurs au départ : relancez la commande")
        print("chaque jour (la bougie du jour est close à 00h00 UTC, soit 01h/02h à Paris).")
    else:
        for i, d in enumerate(data):
            if d["date"] > etat["derniere_date"]:
                sim.jour(d["date"], d["open"], d["close"], signal(closes, i))
                etat["derniere_date"] = d["date"]
                nouveaux += 1
        if nouveaux:
            sauver_etat(chemin_etat, dict(etat, sim=sim.to_dict()))
        entete("SUIVI EN SIMULATION - PROCHAINS JOURS")
        print("Départ : clôture du %s   |   Dernier jour traité : %s   |   Nouveaux jours : %d"
              % (etat["debut"], etat["derniere_date"], nouveaux))
        if not nouveaux:
            print("Aucun nouveau jour clos depuis la dernière exécution : rien à simuler.")
    parametres()
    if sim.premiere_date is None:
        print("\nAucun jour simulé pour l'instant : relancez après la prochaine clôture.")
        return
    print("\nPériode simulée : %s -> %s (%d jours)   BTC : %.0f € -> %.0f € (%+.1f %%)"
          % (sim.premiere_date, sim.derniere_date, len(sim.courbe_bot) - 1, sim.premier_open,
             sim.dernier_close, (sim.dernier_close / sim.premier_open - 1) * 100))
    print("Position actuelle du bot : %.2f € en euros + %.8f BTC ; signal en attente : %s"
          % (sim.bot.cash, sim.bot.btc,
             "position BTC" if sim.signal == "long" else "euros"))
    afficher_bloc(sim)
    print("\nHistorique des ordres du bot :")
    afficher_ordres(sim.bot.ordres)
    print("\nÉtat enregistré dans : %s (supprimez-le ou utilisez --reset pour recommencer)"
          % chemin_etat)


# ----------------------------------------------------------------------------
def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    commun = argparse.ArgumentParser(add_help=False)
    commun.add_argument("--cache", default="donnees_btc_eur.csv", help="cache des prix")
    commun.add_argument("--hors-ligne", action="store_true",
                        help="n'utilise que le cache local, sans réseau")
    a = argparse.ArgumentParser(description="Bot de trading en simulation (100 € fictifs).")
    sub = a.add_subparsers(dest="cmd")
    t = sub.add_parser("test", parents=[commun], help="test sur périodes chronologiques")
    t.add_argument("--periodes", type=int, default=3)
    t.add_argument("--ordres", action="store_true", help="liste tous les ordres de chaque période")
    t.add_argument("--csv", default="historique_ordres.csv")
    s = sub.add_parser("suivi", parents=[commun], help="simulation sur les prochains jours")
    s.add_argument("--etat", default="etat_simulation.json")
    s.add_argument("--reset", action="store_true", help="efface l'état et repart de zéro")
    args = a.parse_args()
    if args.cmd is None:
        args = a.parse_args(["test"] + sys.argv[1:])

    if args.cmd == "test" and not 2 <= args.periodes <= 10:
        sys.exit("--periodes doit être entre 2 et 10")
    data = charger_donnees(args.cache, args.hors_ligne)
    if args.cmd == "suivi":
        mode_suivi(data, args.etat, args.reset)
    else:
        mode_test(data, args.periodes, args.ordres, args.csv)


if __name__ == "__main__":
    main()
