"""Génère site/ : accueil, pages métiers (exemples copiables), pages types de messages, légal, sitemap."""
import html, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from engine import brand
from engine.catalog import METIERS, MESSAGE_TYPES

OUT = pathlib.Path(__file__).resolve().parents[1] / "site"
N, P1, P3 = brand.NAME, brand.PRICE_SINGLE, brand.PRICE_PACK
CSS = """:root{--bg:#f6f8fb;--ink:#14213d;--accent:#1f6feb;--card:#fff;--muted:#59627a}
@media(prefers-color-scheme:dark){:root{--bg:#0f1524;--ink:#eef1f8;--card:#192038;--muted:#a7b0c8;--accent:#5b9bff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.6 system-ui,sans-serif}
main,header,footer{max-width:780px;margin:auto;padding:16px}h1{font-size:2rem;line-height:1.2}a{color:inherit}
.card{background:var(--card);border-radius:14px;padding:20px;margin:16px 0}
.btn{display:inline-block;background:var(--accent);color:#fff;font-weight:700;padding:14px 24px;border-radius:10px;text-decoration:none;margin:4px 8px 4px 0}
blockquote{margin:8px 0;padding:10px 14px;border-left:4px solid var(--accent);background:var(--bg)}
.muted{color:var(--muted);font-size:.9rem}nav a{margin-right:12px}"""

def page(title, desc, body, slug):
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title><meta name="description" content="{html.escape(desc)}"><link rel="canonical" href="{brand.DOMAIN}/{slug}">
<link rel="stylesheet" href="style.css"></head><body><header><a href="index.html"><strong>🎙️ {N}</strong></a></header><main>{body}</main>
<footer class="muted"><nav><a href="cgv.html">CGV</a><a href="mentions-legales.html">Mentions légales</a><a href="confidentialite.html">Confidentialité</a></nav>
<p>Textes rédigés avec l'aide d'une IA, voix de synthèse. © {N}</p></footer><script src="config.js"></script>
<script>document.querySelectorAll('[data-pack]').forEach(a=>a.href=window.LINK_PACK||'#');document.querySelectorAll('[data-single]').forEach(a=>a.href=window.LINK_SINGLE||'#')</script></body></html>"""

CTA = f"""<p><a class="btn" data-pack href="#">Pack 3 messages — {P3} €</a><a class="btn" data-single href="#">1 message — {P1} €</a></p>
<p class="muted">Paiement sécurisé Stripe · livraison par e-mail en moins d'une heure · MP3 + WAV pour standard · remboursé si insatisfait</p>"""

def home():
    ms = "".join(f"<li><strong>{m['label']}</strong></li>" for m in MESSAGE_TYPES.values())
    mt = "".join(f'<li><a href="{m["slug"]}.html">{m["nom"].capitalize()}</a></li>' for m in METIERS)
    return page(f"{N} — Messages d'accueil et répondeurs professionnels en voix IA, en 1 heure",
      "Message d'accueil, répondeur, message d'attente : texte rédigé pour votre métier, voix française naturelle, fichiers MP3 et WAV prêts pour votre standard.",
      f"""<h1>Votre message d'accueil téléphonique professionnel, prêt en moins d'une heure</h1>
<p>Indiquez le nom de votre entreprise et vos horaires : nous rédigeons le texte, nous l'enregistrons avec une voix française naturelle et vous recevez les fichiers prêts à installer sur votre box, standard ou application.</p>{CTA}
<div class="card"><h2>Ce que vous recevez</h2><ul>{ms}</ul><p>Chaque message en <strong>MP3</strong> et en <strong>WAV 8 kHz mono</strong> (format des standards classiques), avec le texte pour relecture.</p></div>
<div class="card"><h2>Pourquoi nous</h2><ul><li>Sans attente : 1 heure au lieu de 24-48 h chez un comédien.</li><li>{P1} € le message, {P3} € le pack de 3, sans abonnement (un standard IA coûte à partir d'environ 49 €/mois).</li><li>Une modification de texte offerte, remboursement si le résultat ne convient pas.</li></ul></div>
<div class="card"><h2>Exemples par métier</h2><ul>{mt}</ul></div>
<p class="muted">Voix de synthèse : transparence assurée. Nous ne promettons rien que vous n'ayez fourni : horaires et noms viennent de vous, relisez avant de publier.</p>{CTA}""", "")

def metier(m):
    return page(f"Message d'accueil et répondeur pour {m['nom']} : exemples | {N}",
      f"Exemples de message d'accueil et de répondeur pour {m['nom']}, à copier, ou à faire enregistrer en voix IA en 1 heure.",
      f"""<h1>Message d'accueil et répondeur pour un {m['nom']}</h1>
<p>Voici deux textes courts, adaptables, qui rassurent l'appelant et donnent l'information essentielle. Remplacez les noms et horaires par les vôtres.</p>
<div class="card"><h2>Message d'accueil (pré-décroché)</h2><blockquote>{m['accueil']}</blockquote>
<h2>Répondeur hors horaires</h2><blockquote>{m['horaires']}</blockquote></div>
<h2>Recevez-les enregistrés</h2><p>Nous adaptons ces textes à votre entreprise, les enregistrons avec une voix française naturelle et vous livrons les fichiers prêts pour votre téléphone.</p>{CTA}
<p class="muted">Conseils : 10 à 20 secondes pour l'accueil ; citez vos horaires ; demandez nom, numéro et motif ; évitez les numéros de téléphone dans un message d'attente.</p>""", m["slug"] + ".html")

def simple(title, body, slug): return page(f"{title} | {N}", title, body, slug)
LEGAL = {
"cgv.html": ("Conditions générales de vente", f"""<h1>Conditions générales de vente</h1>
<p><strong>Objet.</strong> Vente de messages vocaux numériques (audio MP3/WAV et texte) : {P1} € TTC le message, {P3} € TTC le pack de 3 (TVA non applicable, art. 293 B du CGI, à ajuster selon le statut). Vente destinée aux professionnels et aux particuliers.</p>
<p><strong>Commande.</strong> Après paiement via Stripe, les informations saisies (entreprise, voix, horaires et services à citer) servent à rédiger et enregistrer les messages, livrés par e-mail, en principe sous une heure.</p>
<p><strong>Responsabilité du contenu.</strong> Le client relit et valide les textes (horaires, noms, mentions) avant tout usage. Les textes sont rédigés avec l'aide d'une IA à partir de ses seules informations ; la voix est synthétique.</p>
<p><strong>Droit de rétractation.</strong> Contenu numérique fourni immédiatement avec l'accord exprès du consommateur, qui renonce à son droit de rétractation (art. L221-28 13° du Code de la consommation).</p>
<p><strong>Garantie commerciale.</strong> Une modification de texte offerte ; si le résultat ne convient pas ou n'est pas livré, écrivez à {brand.SUPPORT_EMAIL} : remboursement.</p>
<p><strong>Licence d'usage.</strong> Le client peut utiliser les enregistrements sur ses lignes téléphoniques et son site, sans limite de durée. Revente interdite.</p>
<p><strong>Médiation.</strong> Médiateur de la consommation : [À COMPLÉTER avant l'ouverture].</p>"""),
"mentions-legales.html": ("Mentions légales", f"""<h1>Mentions légales</h1><p>Éditeur : [NOM PRÉNOM], entrepreneur individuel, SIRET [À COMPLÉTER], [ADRESSE]. Contact : {brand.SUPPORT_EMAIL}. Hébergement : [À COMPLÉTER]. Paiement : Stripe Payments Europe Ltd.</p>"""),
"confidentialite.html": ("Politique de confidentialité", f"""<h1>Politique de confidentialité</h1>
<p>Données : e-mail, nom de l'entreprise et informations saisies pour les messages. Finalité : fabriquer et livrer la commande. Sous-traitants techniques : Stripe (paiement), Anthropic (rédaction), ElevenLabs (voix), service d'envoi d'e-mails. Les contenus de commande ne sont pas conservés dans nos fichiers au-delà de la livraison et du support ; les données de paiement sont conservées par Stripe selon les obligations comptables. Droits d'accès, rectification, effacement : {brand.SUPPORT_EMAIL}. Réclamation possible auprès de la CNIL. Ne saisissez pas de données personnelles de tiers dans les informations à citer.</p>"""),
"merci.html": ("Merci !", "<h1>Merci ! 🎙️</h1><p>Vos messages sont en cours de création. Vous les recevrez par e-mail en moins d'une heure (vérifiez vos courriers indésirables).</p>"),
}

def main():
    OUT.mkdir(exist_ok=True)
    (OUT / "style.css").write_text(CSS)
    if not (OUT / "config.js").exists():
        (OUT / "config.js").write_text('window.LINK_SINGLE="";window.LINK_PACK="";// coller les liens affichés par engine.setup_stripe\n')
    (OUT / "index.html").write_text(home())
    for m in METIERS: (OUT / f"{m['slug']}.html").write_text(metier(m))
    for f, (t, b) in LEGAL.items(): (OUT / f).write_text(simple(t, b, f))
    urls = ["", *[m["slug"] + ".html" for m in METIERS], "cgv.html", "mentions-legales.html", "confidentialite.html"]
    (OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(f"<url><loc>{brand.DOMAIN}/{u}</loc></url>" for u in urls) + "</urlset>")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {brand.DOMAIN}/sitemap.xml\n")
    print(len(list(OUT.iterdir())), "fichiers")
main()
