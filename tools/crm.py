"""Suivi de prospects local (CSV) + brouillons d'e-mails conformes. N'ENVOIE JAMAIS RIEN : vous copiez et envoyez vous-même.
Usage :
  python3 tools/crm.py add "Dupont Plomberie" --email jean@dupont.fr --prenom Jean --secteur plombier --ville Lyon --type nominative --source "site web de l'entreprise"
  python3 tools/crm.py list [--statut contacte]     python3 tools/crm.py next      python3 tools/crm.py stats
  python3 tools/crm.py draft <id> [--modele email_1|email_2|email_partenaire] [--observation "..."]
  python3 tools/crm.py mark <id> contacte|repondu|gagne|perdu      python3 tools/crm.py optout <email>
Les fichiers prospection/prospects.csv et optout.txt sont ignorés par git (données personnelles)."""
import argparse, csv, datetime, os, string, sys
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "prospection")
CSV = os.environ.get("CRM_CSV", os.path.join(ROOT, "prospects.csv"))
OPTOUT = os.environ.get("CRM_OPTOUT", os.path.join(ROOT, "optout.txt"))
FIELDS = ["id", "entreprise", "prenom", "email", "type_adresse", "secteur", "ville", "source", "statut", "dernier_contact", "relances", "notes"]
STATUTS = ["nouveau", "contacte", "repondu", "gagne", "perdu", "optout"]
RELANCE_APRES_JOURS = 4

sys.path.insert(0, os.path.dirname(ROOT))
from engine import brand

def load():
    if not os.path.exists(CSV): return []
    with open(CSV, newline="", encoding="utf-8") as f: return list(csv.DictReader(f))

def save(rows):
    os.makedirs(os.path.dirname(CSV), exist_ok=True)
    with open(CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, FIELDS); w.writeheader(); w.writerows(rows)

def optouts():
    return {l.strip().lower() for l in open(OPTOUT, encoding="utf-8")} if os.path.exists(OPTOUT) else set()

def find(rows, i):
    for r in rows:
        if r["id"] == str(i): return r
    raise SystemExit(f"prospect {i} introuvable")

def cmd_add(a, rows):
    email = a.email.lower().strip()
    if email in optouts(): raise SystemExit("cette adresse est dans la liste d'opposition : ajout refusé")
    if any(r["email"].lower() == email for r in rows): raise SystemExit("doublon")
    rows.append(dict(id=str(max([int(r["id"]) for r in rows] or [0]) + 1), entreprise=a.entreprise, prenom=a.prenom or "", email=email,
        type_adresse=a.type, secteur=a.secteur, ville=a.ville, source=a.source, statut="nouveau", dernier_contact="", relances="0", notes=""))
    save(rows); print("ajouté :", rows[-1]["id"])

def cmd_draft(a, rows):
    r = find(rows, a.id)
    if r["email"].lower() in optouts() or r["statut"] == "optout": raise SystemExit("opposition enregistrée : aucun contact autorisé")
    if r["type_adresse"] not in ("nominative", "generique"):
        raise SystemExit("adresse non professionnelle ou type non renseigné : pas de brouillon (B2B uniquement, adresse pro)")
    if r["type_adresse"] == "generique": print("[ATTENTION] adresse générique : vérifiez la règle CNIL en vigueur avant d'envoyer.", file=sys.stderr)
    tpl = open(os.path.join(ROOT, "templates", f"{a.modele}.txt"), encoding="utf-8").read()
    sig = os.environ.get("SIGNATURE", f"[VOTRE NOM], {brand.NAME}, SIRET [À COMPLÉTER], [ADRESSE]")
    txt = string.Template(tpl).safe_substitute(entreprise=r["entreprise"], prenom=r["prenom"] or "", metier=r["secteur"] or "professionnel",
        observation=a.observation or "[À REMPLIR : ce que vous avez constaté en appelant (honnêtement), ou supprimer cette ligne]",
        prix_msg=brand.PRICE_SINGLE, lien=brand.DOMAIN + "/", lien_exemples=brand.DOMAIN + "/#exemples", signature=sig, source=r["source"] or "[source]",
        expediteur=brand.NAME, contact=brand.SUPPORT_EMAIL, commission=os.environ.get("COMMISSION", "20"))
    os.makedirs(os.path.join(ROOT, "drafts"), exist_ok=True)
    path = os.path.join(ROOT, "drafts", f"{r['id']}_{a.modele}.txt"); open(path, "w", encoding="utf-8").write(f"À : {r['email']}\n{txt}")
    print(f"brouillon : {path}  (NON envoyé)")

def cmd_next(a, rows):
    today = datetime.date.today(); n = 0
    for r in rows:
        if r["statut"] == "nouveau": print(f"[à contacter] {r['id']} {r['entreprise']} ({r['secteur']}, {r['ville']})"); n += 1
        elif r["statut"] == "contacte" and r["relances"] == "0" and r["dernier_contact"]:
            if (today - datetime.date.fromisoformat(r["dernier_contact"])).days >= RELANCE_APRES_JOURS:
                print(f"[relance J+{RELANCE_APRES_JOURS}, une seule] {r['id']} {r['entreprise']}"); n += 1
    if not n: print("rien à faire aujourd'hui")

def cmd_mark(a, rows):
    r = find(rows, a.id)
    if a.statut not in STATUTS: raise SystemExit(f"statut : {STATUTS}")
    if a.statut == "contacte":
        if r["statut"] == "contacte": r["relances"] = str(int(r["relances"]) + 1)
        r["dernier_contact"] = datetime.date.today().isoformat()
    r["statut"] = a.statut; save(rows); print("ok")

def cmd_optout(a, rows):
    os.makedirs(os.path.dirname(OPTOUT), exist_ok=True)
    open(OPTOUT, "a", encoding="utf-8").write(a.email.lower().strip() + "\n")
    for r in rows:
        if r["email"].lower() == a.email.lower().strip(): r["statut"] = "optout"
    save(rows); print("opposition enregistrée")

def cmd_stats(a, rows):
    c = {s: sum(r["statut"] == s for r in rows) for s in STATUTS}
    contacted = sum(c[s] for s in ("contacte", "repondu", "gagne", "perdu"))
    print(c, f"| contactés {contacted} | taux réponse {((c['repondu'] + c['gagne']) / contacted * 100) if contacted else 0:.0f} % | gagnés {c['gagne']}/10")
    by = {}
    for r in rows: by.setdefault(r["secteur"], [0, 0]); by[r["secteur"]][0] += r["statut"] in ("contacte", "repondu", "gagne", "perdu"); by[r["secteur"]][1] += r["statut"] == "gagne"
    for s, (n, g) in by.items(): print(f"  {s or '?':<20} contactés {n}  gagnés {g}")

def cmd_list(a, rows):
    for r in rows:
        if not a.statut or r["statut"] == a.statut: print(r["id"], r["statut"], r["entreprise"], r["secteur"], r["ville"], r["email"], sep=" | ")

def main(argv=None):
    p = argparse.ArgumentParser(); sp = p.add_subparsers(dest="cmd", required=True)
    s = sp.add_parser("add"); s.add_argument("entreprise"); s.add_argument("--email", required=True); s.add_argument("--prenom"); s.add_argument("--secteur", default="")
    s.add_argument("--ville", default=""); s.add_argument("--type", choices=["nominative", "generique", "personnelle"], required=True); s.add_argument("--source", default="")
    s = sp.add_parser("draft"); s.add_argument("id"); s.add_argument("--modele", default="email_1", choices=["email_1", "email_2", "email_partenaire"]); s.add_argument("--observation")
    s = sp.add_parser("mark"); s.add_argument("id"); s.add_argument("statut")
    s = sp.add_parser("optout"); s.add_argument("email")
    s = sp.add_parser("list"); s.add_argument("--statut")
    sp.add_parser("next"); sp.add_parser("stats")
    a = p.parse_args(argv); globals()["cmd_" + a.cmd](a, load())

if __name__ == "__main__": main()
