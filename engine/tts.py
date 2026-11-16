import json, os, urllib.request

def chunks(text, limit=2500):
    out, cur = [], ""
    for p in text.split("\n\n"):
        if cur and len(cur) + len(p) > limit:
            out.append(cur); cur = ""
        cur += p + "\n\n"
    if cur.strip():
        out.append(cur)
    return out

def synthesize(title, body, api_key=None, voice_id=None, model=None, post=None):
    api_key = api_key or os.environ["ELEVENLABS_API_KEY"]
    voice_id = voice_id or os.environ["ELEVENLABS_VOICE_ID"]
    model = model or os.environ.get("ELEVEN_MODEL", "eleven_multilingual_v2")
    audio = b""
    for c in chunks(f"{title}.\n\n{body}"):
        payload = {"text": c, "model_id": model, "language_code": "fr",
                   "voice_settings": {"stability": 0.6, "similarity_boost": 0.75, "speed": 0.9}}
        if post:
            audio += post(payload)
        else:
            req = urllib.request.Request(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_96",
                data=json.dumps(payload).encode(), method="POST",
                headers={"xi-api-key": api_key, "content-type": "application/json"})
            audio += urllib.request.urlopen(req, timeout=180).read()
    return audio
