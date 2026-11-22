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
  python bot_simulation.py suivi    simulation EN DIRECT sur les prochains jours : ordres
                                    fictifs au meilleur prix vendeur (achat) / acheteur (vente)
                                    public de Coinbase au moment du lancement ; état sauvegardé,
                                    jamais de doublon, jamais d'ordre à un ancien prix

Ce n'est pas un conseil financier : les performances passées ne disent rien du futur.
"""
import argparse
import csv
import json
import os
import re
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


def parametres(direct=False):
    print("Stratégie fixe  : moyennes mobiles %d/%d jours, long uniquement" % (RAPIDE, LENTE))
    if direct:
        print("Exécution       : au prix public du moment (achat = meilleur vendeur, vente = meilleur acheteur)")
    else:
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
# Mode 2 : suivi EN DIRECT sur la cotation publique (simulation, état sauvegardé)
# ----------------------------------------------------------------------------
# Règles :
#  - le signal 10/30 vient des bougies journalières CLOSES ; il est connu à 00h00 UTC ;
#  - un ordre fictif n'est créé que si le programme tourne, dans les 24 h après ce
#    signal, ET qu'une cotation publique fiable est lisible à cet instant ;
#  - achat au MEILLEUR PRIX VENDEUR, vente au MEILLEUR PRIX ACHETEUR, puis le glissement
#    et les frais habituels ;
#  - jamais d'ordre rejoué à un ancien prix : programme arrêté ou cotation indisponible
#    => aucun ordre ; au prochain lancement, seule la cotation du moment est utilisée ;
#  - une relance ne duplique jamais un ordre (voir "ANTI-DOUBLON" ci-dessous).
COINBASE_BOOK = "https://api.exchange.coinbase.com/products/BTC-EUR/book?level=2"
SPREAD_MAX = 0.01        # écart vendeur/acheteur maximal toléré (1 %)
DECALAGE_MAX_S = 60      # écart maximal cotation / horloge locale
VALIDITE_SIGNAL_H = 24   # un signal ne s'exécute que dans les 24 h suivant la clôture
VERROU_PERIME_S = 600    # un verrou plus vieux est considéré comme laissé par un crash
VERSION_ETAT = 2
MAX_EVENEMENTS = 200


class CotationIndisponible(Exception):
    pass


def lire_iso(s):
    """'2026-11-22T18:45:30.460070424Z' -> datetime UTC (tout Python 3.8+)."""
    m = re.match(r"^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d+))?Z?$", str(s))
    if not m:
        raise ValueError("horodatage illisible : %r" % (s,))
    base = datetime.strptime(m.group(1), "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    return base.replace(microsecond=int((m.group(2) or "0")[:6].ljust(6, "0")))


def iso(dt):
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (dt.microsecond // 1000)


def court(t):
    return t[:19].replace("T", " ") + " UTC"


def obtenir_cotation():
    """Meilleurs prix acheteur/vendeur BTC/EUR du carnet public Coinbase, plus la quantité
    disponible dans la marge de glissement (le glissement simulé suppose qu'un ordre de
    cette taille se remplit au plus à ce prix limite). Lève CotationIndisponible si la
    cotation manque ou n'est pas fiable."""
    try:
        req = urllib.request.Request(COINBASE_BOOK, headers={"User-Agent": "simulation-bot"})
        with urllib.request.urlopen(req, timeout=10) as r:
            corps = json.load(r)
    except Exception as e:
        raise CotationIndisponible("réseau ou serveur : %s" % e)
    try:
        bids = [(float(p), float(q)) for p, q, *_ in corps["bids"]]
        asks = [(float(p), float(q)) for p, q, *_ in corps["asks"]]
        bid, ask = max(p for p, _ in bids), min(p for p, _ in asks)
        heure = lire_iso(corps["time"])
    except (KeyError, IndexError, ValueError, TypeError) as e:
        raise CotationIndisponible("réponse incomplète (%s)" % e)
    if corps.get("auction_mode"):
        raise CotationIndisponible("carnet en mode enchère")
    if not 0 < bid < ask:
        raise CotationIndisponible("cotation incohérente (acheteur %s, vendeur %s)" % (bid, ask))
    if (ask - bid) / ((ask + bid) / 2) > SPREAD_MAX:
        raise CotationIndisponible("écart acheteur/vendeur anormal (%.2f %%)"
                                   % (100 * (ask - bid) / ((ask + bid) / 2)))
    ecart = abs((datetime.now(timezone.utc) - heure).total_seconds())
    if ecart > DECALAGE_MAX_S:
        raise CotationIndisponible("horloge locale décalée ou cotation périmée (%.0f s)" % ecart)
    return {"bid": bid, "ask": ask,
            "taille_bid": sum(q for p, q in bids if p >= bid * (1 - SLIPPAGE)),
            "taille_ask": sum(q for p, q in asks if p <= ask * (1 + SLIPPAGE)),
            "heure_utc": iso(heure)}


def heure_cloture(date_bougie):
    """Une bougie journalière finit (et son signal est connu) à 00h00 UTC le lendemain."""
    return datetime.strptime(date_bougie, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)


def debut_serie(data, closes, i):
    """Heure depuis laquelle le signal en vigueur à la bougie i n'a pas changé."""
    s, j = signal(closes, i), i
    while j - 1 >= LENTE - 1 and signal(closes, j - 1) == s:
        j -= 1
    return heure_cloture(data[j]["date"])


class Verrou:
    """ANTI-DOUBLON (1/4) : une seule exécution à la fois (deux lancements simultanés
    ne peuvent pas créer deux fois le même ordre)."""

    def __init__(self, chemin_etat):
        self.chemin = chemin_etat + ".lock"

    def __enter__(self):
        for _ in range(2):
            try:
                fd = os.open(self.chemin, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(fd, str(os.getpid()).encode())
                os.close(fd)
                return self
            except FileExistsError:
                try:
                    perime = time.time() - os.path.getmtime(self.chemin) > VERROU_PERIME_S
                    if perime:
                        os.remove(self.chemin)
                        continue
                except OSError:
                    continue
                sys.exit("Une autre exécution du suivi est en cours (verrou %s). "
                         "Rien n'a été modifié." % self.chemin)
        sys.exit("Impossible de poser le verrou %s." % self.chemin)

    def __exit__(self, *exc):
        try:
            os.remove(self.chemin)
        except OSError:
            pass


def lire_etat(chemin):
    if not os.path.exists(chemin):
        return None
    try:
        with open(chemin, encoding="utf-8") as f:
            etat = json.load(f)
        version = etat["version"]
    except (ValueError, KeyError, TypeError) as e:
        sys.exit("Fichier d'état illisible (%s). Rien n'a été modifié ; sauvegardez-le puis "
                 "relancez avec --reset pour repartir de zéro." % e)
    if version != VERSION_ETAT:
        sys.exit("Fichier d'état d'un ancien format (version %s). Rien n'a été modifié ; "
                 "utilisez --reset ou --etat avec un autre nom de fichier." % version)
    return etat


def ecrire_etat(chemin, etat, revision_lue):
    """ANTI-DOUBLON (2/4) : écriture atomique (ordre + marque 'signal traité' dans le même
    fichier, remplacé d'un bloc) avec contrôle de révision : si un autre processus a écrit
    entre-temps, on n'écrit rien."""
    if revision_lue is not None and os.path.exists(chemin):
        try:
            with open(chemin, encoding="utf-8") as f:
                actuelle = json.load(f).get("revision", 0)
        except ValueError:
            actuelle = -1
        if actuelle != revision_lue:
            sys.exit("L'état a été modifié par une autre exécution : rien n'a été écrit. Relancez.")
    etat["revision"] = (revision_lue or 0) + 1
    tmp = chemin + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(etat, f, ensure_ascii=False, indent=1)
    os.replace(tmp, chemin)


def verifier_profondeur(sens, p, cot):
    """La quantité disponible entre le meilleur prix et le prix limite (meilleur prix +/-
    glissement) doit couvrir l'ordre, sinon pas d'ordre."""
    if sens == "ACHAT":
        qty = p.cash / (cot["ask"] * (1 + SLIPPAGE) * (1 + FRAIS))
        dispo = cot["taille_ask"]
    else:
        qty, dispo = p.btc, cot["taille_bid"]
    if qty > dispo:
        raise CotationIndisponible("liquidité insuffisante dans la marge de glissement "
                                   "(%.6f BTC pour %.6f voulus)" % (dispo, qty))


def passer_ordre(p, sens, cot, ordre_id, meta):
    """Ordre FICTIF au prix public du moment : meilleur vendeur (achat) ou meilleur
    acheteur (vente), puis glissement et frais de Portefeuille.
    ANTI-DOUBLON (3/4) : un identifiant d'ordre déjà enregistré n'est jamais rejoué."""
    if any(o.get("ordre_id") == ordre_id for o in p.ordres):
        return None
    if sens == "ACHAT":
        prix_cotation = cot["ask"]
        p.acheter(cot["heure_utc"], prix_cotation)
    else:
        prix_cotation = cot["bid"]
        p.vendre(cot["heure_utc"], prix_cotation)
    o = p.ordres[-1]
    o.update(meta, ordre_id=ordre_id, heure_execution_utc=cot["heure_utc"],
             prix_cotation=prix_cotation, cotation_bid=cot["bid"], cotation_ask=cot["ask"])
    return o


def _evenement(etat, t, type_, detail):
    etat["evenements"].append({"t": t, "type": type_, "detail": detail})
    del etat["evenements"][:-MAX_EVENEMENTS]


def mode_suivi(data, chemin_etat, reset=False, cotation_fn=obtenir_cotation, maintenant_fn=None):
    maintenant_fn = maintenant_fn or (lambda: datetime.now(timezone.utc))
    closes = [d["close"] for d in data]
    with Verrou(chemin_etat):
        maintenant = maintenant_fn()
        etat = None if reset else lire_etat(chemin_etat)
        revision_lue = None if reset else (etat.get("revision", 0) if etat else 0)

        i = len(data) - 1
        d_signal, t_signal = data[i]["date"], heure_cloture(data[i]["date"])
        age_h = (maintenant - t_signal).total_seconds() / 3600
        signal_valide = 0 <= age_h <= VALIDITE_SIGNAL_H
        cible = signal(closes, i)
        depuis = iso(debut_serie(data, closes, i))
        meta = {"signal": cible, "bougie_signal": d_signal, "heure_signal_utc": iso(t_signal),
                "signal_depuis_utc": depuis}
        try:
            cot, cot_err = cotation_fn(), None
        except CotationIndisponible as e:
            cot, cot_err = None, str(e)
        notes = []

        if etat is None:
            # ---- DÉMARRAGE : un seul départ, bot et BTC conservé sur la même cotation
            if not signal_valide:
                sys.exit("Les bougies journalières ne sont pas à jour (dernière : %s). "
                         "Aucun démarrage, aucun ordre. Réessayez dans quelques minutes." % d_signal)
            if cot is None:
                sys.exit("Cotation publique indisponible (%s). Aucun démarrage, aucun ordre créé."
                         % cot_err)
            bot, bh = Portefeuille(), Portefeuille()
            try:
                verifier_profondeur("ACHAT", bh, cot)
            except CotationIndisponible as e:
                sys.exit("Cotation inutilisable (%s). Aucun démarrage, aucun ordre créé." % e)
            passer_ordre(bh, "ACHAT", cot, "BH-DEMARRAGE-ACHAT",
                         {"reference": "BTC conservé", "heure_signal_utc": None})
            if cible == "long":
                passer_ordre(bot, "ACHAT", cot, "BOT-%s-ACHAT" % d_signal, meta)
            etat = {"version": VERSION_ETAT, "demarrage_utc": cot["heure_utc"],
                    "dernier_signal_traite": d_signal, "bot": bot.to_dict(), "bh": bh.to_dict(),
                    "releves": [], "evenements": []}
            notes.append("NOUVEAU DÉPART : 100 € fictifs, BTC conservé acheté au même instant.")
            notes.append("Signal en vigueur : %s -> %s." % (
                "position BTC" if cible == "long" else "rester en euros",
                "achat simulé au meilleur prix vendeur" if cible == "long" else "aucun ordre"))
        else:
            bot, bh = Portefeuille.from_dict(etat["bot"]), Portefeuille.from_dict(etat["bh"])
            if d_signal <= etat["dernier_signal_traite"]:
                # ANTI-DOUBLON (4/4) : ce signal a déjà été traité -> aucune action
                notes.append("Signal du %s déjà traité : aucun nouvel ordre." % d_signal)
            elif not signal_valide:
                _evenement(etat, iso(maintenant), "DONNEES_PERIMEES",
                           "dernière bougie %s ; aucun ordre" % d_signal)
                notes.append("Bougies journalières non à jour : aucun ordre.")
            elif cot is None:
                _evenement(etat, iso(maintenant), "COTATION_INDISPONIBLE", cot_err)
                notes.append("Cotation indisponible (%s) : AUCUN ordre créé ; nouvelle tentative "
                             "au prochain lancement tant que le signal est valide (24 h)." % cot_err)
            else:
                sens = ("ACHAT" if cible == "long" and bot.btc == 0
                        else "VENTE" if cible == "cash" and bot.btc > 0 else None)
                try:
                    if sens:
                        verifier_profondeur(sens, bot, cot)
                except CotationIndisponible as e:
                    cot_err = str(e)
                    _evenement(etat, iso(maintenant), "COTATION_INSUFFISANTE", cot_err)
                    notes.append("Cotation inutilisable (%s) : AUCUN ordre créé." % cot_err)
                else:
                    if sens:
                        passer_ordre(bot, sens, cot, "BOT-%s-%s" % (d_signal, sens), meta)
                        notes.append("Signal du %s : ordre %s simulé (%.0f min après la clôture)."
                                     % (d_signal, sens, age_h * 60))
                    else:
                        notes.append("Signal du %s : position déjà conforme, aucun ordre." % d_signal)
                    etat["dernier_signal_traite"] = d_signal
            etat["bot"], etat["bh"] = bot.to_dict(), bh.to_dict()

        if cot is not None:
            etat["releves"].append({"t": cot["heure_utc"], "bid": cot["bid"], "ask": cot["ask"],
                                    "bot": bot.valeur(cot["bid"]), "bh": bh.valeur(cot["bid"])})
        ecrire_etat(chemin_etat, etat, revision_lue)
    afficher_suivi(etat, cot, cot_err, notes, maintenant, chemin_etat, d_signal, cible, depuis)
    return etat


def afficher_ordre_live(n, o):
    print("  #%d %-5s %-8s [%s]" % (n, o["sens"], o["statut"], o["ordre_id"]))
    if o.get("heure_signal_utc"):
        retard = (lire_iso(o["heure_execution_utc"]) - lire_iso(o["heure_signal_utc"])).total_seconds()
        print("      signal      : %s (bougie du %s, en vigueur depuis %s)"
              % (court(o["heure_signal_utc"]), o["bougie_signal"], court(o["signal_depuis_utc"])))
        print("      exécution   : %s (%.0f min après le signal)"
              % (court(o["heure_execution_utc"]), retard / 60))
    else:
        print("      exécution   : %s (démarrage, référence BTC conservé)" % court(o["heure_execution_utc"]))
    cote = "meilleur vendeur" if o["sens"] == "ACHAT" else "meilleur acheteur"
    print("      prix utilisé: %s %.2f € (acheteur %.2f / vendeur %.2f) -> prix appliqué %.2f € "
          "avec glissement" % (cote, o["prix_cotation"], o["cotation_bid"], o["cotation_ask"], o["prix"]))
    if o["statut"] == "EXÉCUTÉ":
        print("      quantité    : %.8f BTC, montant %.2f €, frais %.2f €"
              % (o["quantite_btc"], o["montant_eur"], o["frais_eur"]))
    else:
        print("      refusé      : %s" % o["raison"])


def afficher_suivi(etat, cot, cot_err, notes, maintenant, chemin, d_signal, cible, depuis):
    bot, bh = Portefeuille.from_dict(etat["bot"]), Portefeuille.from_dict(etat["bh"])
    entete("SUIVI EN SIMULATION - COTATION PUBLIQUE COINBASE (aucun ordre réel)")
    print("Démarrage       : %s   (%.0f € fictifs)" % (court(etat["demarrage_utc"]), CAPITAL))
    print("Cette exécution : %s" % court(iso(maintenant)))
    if cot:
        print("Cotation        : meilleur acheteur %.2f € | meilleur vendeur %.2f € (à %s)"
              % (cot["bid"], cot["ask"], court(cot["heure_utc"])))
    else:
        print("Cotation        : INDISPONIBLE (%s)" % cot_err)
    print("Signal en vigueur: %s (bougie du %s, depuis %s)"
          % ("position BTC" if cible == "long" else "euros", d_signal, court(depuis)))
    parametres(direct=True)
    print()
    for n in notes:
        print(">> " + n)
    releves = etat["releves"]
    if releves:
        ref = cot["bid"] if cot else releves[-1]["bid"]
        sim = Suivi()
        sim.bot, sim.bh = bot, bh
        sim.courbe_bot = [CAPITAL] + [r["bot"] for r in releves]
        sim.courbe_bh = [CAPITAL] + [r["bh"] for r in releves]
        sim.dernier_close = ref
        print("\nDEPUIS LE MÊME DÉMARRAGE (valorisé au meilleur prix acheteur de %.2f €, après frais"
              % ref)
        print("et glissement d'une vente ; baisse mesurée sur %d relevé(s)) :" % len(releves))
        afficher_bloc(sim)
    print("\nORDRES DU BOT (%d)" % len(bot.ordres))
    if not bot.ordres:
        print("  (aucun ordre : le bot est en euros)")
    for n, o in enumerate(bot.ordres, 1):
        afficher_ordre_live(n, o)
    print("\nACHAT DU BTC CONSERVÉ (référence)")
    for n, o in enumerate(bh.ordres, 1):
        afficher_ordre_live(n, o)
    if etat["evenements"]:
        print("\nÉVÉNEMENTS (aucun ordre créé dans ces cas) - les 5 derniers :")
        for e in etat["evenements"][-5:]:
            print("  %s  %-22s %s" % (court(e["t"]), e["type"], e["detail"]))
    print("\nÉtat enregistré dans : %s. Relancez-le au moins une fois par jour après 00h00 UTC" % chemin)
    print("(01h/02h à Paris) ; un signal non exécuté dans les 24 h suivant la clôture est abandonné.")


# ----------------------------------------------------------------------------
def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    commun = argparse.ArgumentParser(add_help=False)
    commun.add_argument("--cache", default="donnees_btc_eur.csv", help="cache des prix")
    a = argparse.ArgumentParser(description="Bot de trading en simulation (100 € fictifs).")
    sub = a.add_subparsers(dest="cmd")
    t = sub.add_parser("test", parents=[commun], help="test sur périodes chronologiques")
    t.add_argument("--hors-ligne", action="store_true",
                   help="n'utilise que le cache local, sans réseau")
    t.add_argument("--periodes", type=int, default=3)
    t.add_argument("--ordres", action="store_true", help="liste tous les ordres de chaque période")
    t.add_argument("--csv", default="historique_ordres.csv")
    s = sub.add_parser("suivi", parents=[commun], help="simulation sur les prochains jours")
    s.add_argument("--etat", default="etat_suivi_live.json")
    s.add_argument("--reset", action="store_true", help="efface l'état et repart de zéro")
    args = a.parse_args()
    if args.cmd is None:
        args = a.parse_args(["test"] + sys.argv[1:])

    if args.cmd == "test" and not 2 <= args.periodes <= 10:
        sys.exit("--periodes doit être entre 2 et 10")
    data = charger_donnees(args.cache, getattr(args, "hors_ligne", False))
    if args.cmd == "suivi":
        mode_suivi(data, args.etat, args.reset)
    else:
        mode_test(data, args.periodes, args.ordres, args.csv)


if __name__ == "__main__":
    main()
