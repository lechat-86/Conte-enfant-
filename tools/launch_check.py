"""État de préparation au lancement : lecture seule, aucun appel réseau, aucune dépense.  python3 tools/launch_check.py"""
import os, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT))
from engine import brand
from engine.catalog import SAMPLES

def checks():
    site = ROOT / "site"; cfg = (site / "config.js").read_text() if (site / "config.js").exists() else ""
    pages = "".join(p.read_text() for p in site.glob("*.html"))
    env = ["STRIPE_SECRET_KEY", "ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_F", "ELEVENLABS_VOICE_M", "SMTP_USER", "SMTP_PASSWORD", "OWNER_EMAIL"]
    return [
      ("Nom de domaine renseigné (engine/brand.py)", ".example" not in brand.DOMAIN + brand.SUPPORT_EMAIL),
      ("Lien Stripe pack dans site/config.js", bool(re.search(r'LINK_PACK="https://', cfg))),
      ("Lien Stripe message seul dans site/config.js", bool(re.search(r'LINK_SINGLE="https://', cfg))),
      ("Pages légales sans champ [À COMPLÉTER]", "À COMPLÉTER" not in pages),
      (f"Exemples audio générés ({sum((site/'audio'/(s['key']+'.mp3')).exists() for s in SAMPLES)}/{len(SAMPLES)})", all((site / "audio" / f"{s['key']}.mp3").exists() for s in SAMPLES)),
      ("Variables d'environnement locales (facultatif ici, obligatoires en secrets GitHub)", all(os.environ.get(k) for k in env)),
    ]

if __name__ == "__main__":
    res = checks()
    for label, ok in res: print(("[OK] " if ok else "[À FAIRE] ") + label)
    print(f"\n{sum(ok for _, ok in res)}/{len(res)} prêts. Détail des étapes : docs/LANCEMENT.md")
