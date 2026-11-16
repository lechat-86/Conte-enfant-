"""Voix (ElevenLabs) + post-traitement professionnel (ffmpeg) + validation des fichiers livrés."""
import io, json, os, shutil, subprocess, tempfile, urllib.request, wave

BASE = lambda: os.environ.get("ELEVENLABS_BASE", "https://api.elevenlabs.io")
# Modèles qui acceptent le paramètre language_code (les autres le rejettent).
LANG_ENFORCE = ("eleven_flash_v2_5", "eleven_turbo_v2_5")

def synthesize(text, voice_id, api_key=None, model=None, post=None):
    model = model or os.environ.get("ELEVEN_MODEL", "eleven_multilingual_v2")
    payload = {"text": text, "model_id": model,
               "voice_settings": {"stability": 0.7, "similarity_boost": 0.75, "style": 0.0, "use_speaker_boost": True, "speed": 0.95}}
    if model in LANG_ENFORCE:
        payload["language_code"] = "fr"
    if post:
        return post(payload)
    req = urllib.request.Request(f"{BASE()}/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        data=json.dumps(payload).encode(), method="POST",
        headers={"xi-api-key": api_key or os.environ["ELEVENLABS_API_KEY"], "content-type": "application/json"})
    return urllib.request.urlopen(req, timeout=120).read()

# Coupe les silences de début/fin, ajoute 0,2 s avant et 0,4 s après, normalise le volume (EBU R128, -16 LUFS).
_CLEAN = ("silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
          "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
          "adelay=200:all=1,apad=pad_dur=0.4,loudnorm=I=-16:TP=-1.5:LRA=9")

def _ffmpeg(src_bytes, args, ext_in="mp3", ext_out="mp3"):
    if not shutil.which("ffmpeg"):
        return None
    with tempfile.TemporaryDirectory() as d:
        src, dst = f"{d}/in.{ext_in}", f"{d}/out.{ext_out}"
        with open(src, "wb") as f: f.write(src_bytes)
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, *args, dst], capture_output=True)
        if r.returncode != 0:
            return None
        with open(dst, "rb") as f: return f.read()

def master_mp3(mp3):
    """MP3 final : nettoyé et normalisé. Retourne None si ffmpeg est indisponible/en échec."""
    return _ffmpeg(mp3, ["-af", _CLEAN, "-ar", "44100", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "128k"])

def to_wav_pbx(mp3):
    """WAV 8 kHz mono 16 bits (standards téléphoniques). Retourne None si échec."""
    return _ffmpeg(mp3, ["-af", _CLEAN, "-ar", "8000", "-ac", "1", "-sample_fmt", "s16"], ext_out="wav")

def validate_wav(data, min_s=2, max_s=150):
    """Lève ValueError si le WAV n'est pas du 8 kHz / mono / 16 bits de durée plausible."""
    try:
        w = wave.open(io.BytesIO(data))
    except Exception as e:
        raise ValueError(f"WAV illisible : {e}")
    dur = w.getnframes() / float(w.getframerate() or 1)
    if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (8000, 1, 2):
        raise ValueError("WAV hors format 8 kHz / mono / 16 bits")
    if not (min_s <= dur <= max_s):
        raise ValueError(f"durée audio suspecte : {dur:.1f}s")
    return dur
