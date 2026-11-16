import json, os, shutil, subprocess, tempfile, urllib.request

def synthesize(text, voice_id, api_key=None, model=None, post=None):
    payload = {"text": text, "model_id": model or os.environ.get("ELEVEN_MODEL", "eleven_multilingual_v2"),
               "language_code": "fr", "voice_settings": {"stability": 0.7, "similarity_boost": 0.75, "speed": 0.95}}
    if post:
        return post(payload)
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        data=json.dumps(payload).encode(), method="POST",
        headers={"xi-api-key": api_key or os.environ["ELEVENLABS_API_KEY"], "content-type": "application/json"})
    return urllib.request.urlopen(req, timeout=120).read()

def to_wav_pbx(mp3):
    """WAV 8 kHz mono 16 bits (format attendu par la plupart des standards). None si ffmpeg absent/échec."""
    if not shutil.which("ffmpeg"):
        return None
    with tempfile.TemporaryDirectory() as d:
        src, dst = f"{d}/in.mp3", f"{d}/out.wav"
        open(src, "wb").write(mp3)
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ar", "8000", "-ac", "1", "-sample_fmt", "s16", dst])
        return open(dst, "rb").read() if r.returncode == 0 else None
