import json, os, re, urllib.request
from .themes import BY_KEY

MODEL = os.environ.get("CLAUDE_MODEL", "claude-haiku-5-5")
BANNED = re.compile(r"\b(mort(?:el)?|tuer|sang|suicide|arme|haine|drogue|alcool)\b", re.I)

SYSTEM = """Tu es conteur(se) pour enfants francophones. Tu écris des histoires du soir douces, positives, en français simple et chaleureux, faites pour être LUES À VOIX HAUTE.
Règles : aucune violence, aucun contenu effrayant sans résolution rassurante, aucun conseil médical ou psychologique, aucune marque commerciale, aucune référence religieuse ou politique.
Style : phrases courtes, répétitions rassurantes, onomatopées légères, dialogues simples. Le prénom de l'enfant revient souvent.
Longueur : environ 750 à 900 mots. Fin apaisante qui conduit doucement vers le sommeil.
Format STRICT : première ligne « TITRE: <titre> », puis une ligne vide, puis le texte en paragraphes séparés par une ligne vide. Pas de markdown, pas de commentaire."""

def clean_name(raw):
    name = re.sub(r"[^A-Za-zÀ-ÖØ-öø-ÿ'’\- ]", "", (raw or "")).strip()[:20]
    return name.title() if name else "Le petit héros"

def clean_age(raw):
    try:
        a = int(float(raw))
    except (TypeError, ValueError):
        return 5
    return min(max(a, 2), 10)

def build_prompt(name, age, theme_key):
    th = BY_KEY[theme_key]
    return (f"Écris une histoire dont {name}, {age} ans, est le héros/l'héroïne.\n"
            f"Situation : {th['label']}.\nConsigne de fond : {th['guide']}\n"
            f"Adapte le vocabulaire à un enfant de {age} ans.")

def parse(text):
    m = re.match(r"\s*TITRE\s*:\s*(.+?)\n+(.+)", text, re.S)
    if not m:
        raise ValueError("format inattendu")
    title, body = m.group(1).strip(), m.group(2).strip()
    if len(body.split()) < 400:
        raise ValueError("histoire trop courte")
    if BANNED.search(body):
        raise ValueError("mot sensible détecté : relecture humaine requise")
    return title, body

def generate(name, age, theme_key, api_key=None, post=None):
    api_key = api_key or os.environ["ANTHROPIC_API_KEY"]
    payload = {"model": MODEL, "max_tokens": 2500, "system": SYSTEM,
               "messages": [{"role": "user", "content": build_prompt(name, age, theme_key)}]}
    if post:
        data = post(payload)
    else:
        req = urllib.request.Request("https://api.anthropic.com/v1/messages",
            data=json.dumps(payload).encode(), method="POST",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        data = json.load(urllib.request.urlopen(req, timeout=120))
    return parse(data["content"][0]["text"])
