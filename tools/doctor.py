"""Diagnostic avant lancement (aucun envoi client, ~quelques centaines de crédits ElevenLabs pour le test audio).
Usage : ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_F=... ELEVENLABS_VOICE_M=... python3 tools/doctor.py [--tts]"""
import json, os, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine import audio

def get(path):
    req = urllib.request.Request(audio.BASE() + path, headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]})
    return json.load(urllib.request.urlopen(req, timeout=30))

def main(argv):
    ko = 0
    need = ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_F", "ELEVENLABS_VOICE_M"]
    for k in need:
        if not os.environ.get(k): print(f"[KO] variable manquante : {k}"); ko += 1
    if ko: return 1
    sub = get("/v1/user/subscription")
    tier, used, limit = sub.get("tier"), sub.get("character_count"), sub.get("character_limit")
    print(f"[OK] abonnement : {tier} (statut {sub.get('status')}) - crédits {used}/{limit}")
    if tier == "free": print("[KO] plan gratuit : usage commercial INTERDIT"); ko += 1
    for label, k in (("féminine", "ELEVENLABS_VOICE_F"), ("masculine", "ELEVENLABS_VOICE_M")):
        v = get("/v1/voices/" + os.environ[k])
        cat = v.get("category")
        langs = [x.get("language") for x in v.get("verified_languages") or []]
        print(f"[OK] voix {label} : {v.get('name')} (catégorie {cat}, langues vérifiées {langs or 'non indiquées'})")
        if cat != "premade":
            print(f"[À VÉRIFIER] voix {label} de catégorie « {cat} » : lire ses conditions d'usage commercial dans la bibliothèque de voix avant vente.")
        if langs and "fr" not in langs: print(f"[À VÉRIFIER] voix {label} sans français vérifié : écouter attentivement.")
        if "--tts" in argv:
            mp3 = audio.synthesize("Bonjour, vous êtes bien chez Dupont Plomberie. Merci de patienter un instant.", os.environ[k])
            out = f"doctor_{label}.mp3"; open(out, "wb").write(mp3); print(f"[OK] audio de test écrit : {out} ({len(mp3)} octets) : ÉCOUTEZ-LE")
    return 1 if ko else 0

if __name__ == "__main__": sys.exit(main(sys.argv[1:]))
