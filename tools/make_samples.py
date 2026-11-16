"""Génère les exemples audio du site avec VOTRE compte ElevenLabs (≈ 1 000 caractères consommés). Résultat : site/audio/*.mp3
Usage : ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_F=... ELEVENLABS_VOICE_M=... python3 tools/make_samples.py
Écoutez chaque fichier avant de publier le site."""
import os, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT))
from engine import audio
from engine.catalog import SAMPLES
(ROOT / "site" / "audio").mkdir(parents=True, exist_ok=True)
for s in SAMPLES:
    mp3 = audio.synthesize(s["texte"], os.environ[f"ELEVENLABS_VOICE_{s['voix'].upper()}"])
    out = audio.master_mp3(mp3) or mp3
    (ROOT / "site" / "audio" / f"{s['key']}.mp3").write_bytes(out); print("écrit", s["key"], len(out), "octets")
print("Relancez ensuite : python3 tools/build_site.py")
