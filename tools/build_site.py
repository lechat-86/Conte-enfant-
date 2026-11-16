"""Génère le site statique (site/) : accueil, 12 pages SEO par situation, légal, sitemap."""
import html, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from engine import brand
from engine.themes import THEMES

OUT = pathlib.Path(__file__).resolve().parents[1] / "site"
NAME, PRICE = brand.NAME, f"{brand.PRICE_EUR:.2f}".replace(".", ",")
CSS = """:root{--bg:#fdf8ef;--ink:#1f2a44;--accent:#f2a93b;--card:#fff;--muted:#5b6478}
@media(prefers-color-scheme:dark){:root{--bg:#141a2e;--ink:#f1ecdf;--card:#1f2742;--muted:#aab2c8}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.6 system-ui,sans-serif}
main,header,footer{max-width:760px;margin:auto;padding:16px}
h1{font-size:2rem;line-height:1.2}a{color:inherit}.card{background:var(--card);border-radius:16px;padding:20px;margin:16px 0}
.btn{display:inline-block;background:var(--accent);color:#1f2a44;font-weight:700;padding:14px 26px;border-radius:999px;text-decoration:none}
.muted{color:var(--muted);font-size:.9rem}ul{padding-left:20px}nav a{margin-right:12px}"""

def page(title, desc, body, slug):
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title><meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{brand.DOMAIN}/{slug}"><link rel="stylesheet" href="style.css"></head><body>
<header><a href="index.html"><strong>🌙 {NAME}</strong></a></header><main>{body}</main>
<footer class="muted"><nav><a href="cgv.html">CGV</a><a href="mentions-legales.html">Mentions légales</a><a href="confidentialite.html">Confidentialité</a></nav>
<p>Histoires créées avec l'aide d'une IA, voix de synthèse. © {NAME}</p></footer>
<script src="config.js"></script><script>document.querySelectorAll('[data-buy]').forEach(a=>a.href=window.PAYMENT_LINK||'#')</script></body></html>"""

CTA = f'<p><a class="btn" data-buy href="#">Créer son histoire — {PRICE} €</a></p><p class="muted">Paiement sécurisé Stripe · livraison par e-mail en moins d\'une heure · satisfait ou remboursé</p>'

def home():
    items = "".join(f'<li><a href="{t["slug"]}.html">{t["label"]}</a></li>' for t in THEMES)
    return page(f"{NAME} — Histoires du soir personnalisées avec le prénom de votre enfant",
     "Une histoire audio originale dont votre enfant est le héros, pour le coucher ou pour traverser une étape (noir, rentrée, bébé…). Livrée par e-mail.",
     f"""<h1>L'histoire du soir où votre enfant est le héros</h1>
<p>Donnez le prénom et l'âge de votre enfant, choisissez la situation qu'il vit : nous créons une histoire originale, lue à voix douce, à écouter ensemble avant de dormir.</p>{CTA}
<div class="card"><h2>Comment ça marche</h2><ol><li>Vous payez en 1 minute ({PRICE} €).</li><li>Vous indiquez le prénom, l'âge et la situation.</li><li>Vous recevez par e-mail l'audio MP3 (≈ 5 à 6 min) et le texte à lire vous-même.</li></ol></div>
<div class="card"><h2>Pour quelles situations ?</h2><ul>{items}</ul></div>
<div class="card"><h2>En toute transparence</h2><p>Les histoires sont écrites par une intelligence artificielle, vérifiées automatiquement, et lues par une voix de synthèse. Elles accompagnent un moment de complicité ; elles ne remplacent ni un professionnel de santé ni l'avis d'un psychologue. Nous ne conservons pas les données de l'enfant au-delà de la livraison.</p></div>{CTA}""", "")

def theme(t):
    return page(f"{t['label']} : histoire personnalisée pour votre enfant | {NAME}",
      t["intro"][:155], f"""<h1>{t['label']} : une histoire à son prénom</h1><p>{t['intro']}</p>
<div class="card"><h2>Ce que vous recevez</h2><ul><li>Une histoire originale de 5 à 6 minutes dont votre enfant est le héros.</li><li>La version audio MP3 et le texte à lire à voix haute.</li><li>Un vocabulaire adapté à son âge (2 à 10 ans).</li></ul></div>{CTA}
<p class="muted">Conseil : lisez ou écoutez l'histoire plusieurs soirs de suite ; la répétition rassure. Si la difficulté persiste, parlez-en à votre pédiatre ou à un professionnel.</p>""", t["slug"] + ".html")

def simple(title, body, slug):
    return page(f"{title} | {NAME}", title, body, slug)

LEGAL = {
"cgv.html": ("Conditions générales de vente", f"""<h1>Conditions générales de vente</h1>
<p><strong>Objet.</strong> Vente d'une histoire personnalisée numérique (audio MP3 et texte), au prix de {PRICE} € TTC (TVA non applicable, art. 293 B du CGI — à ajuster selon le statut).</p>
<p><strong>Commande.</strong> Après paiement via Stripe, le client renseigne prénom, âge et situation. L'histoire est livrée par e-mail, en principe sous une heure.</p>
<p><strong>Droit de rétractation.</strong> Le contenu numérique étant fourni immédiatement avec l'accord exprès du client, qui renonce à son droit de rétractation (art. L221-28 13° du Code de la consommation).</p>
<p><strong>Garantie commerciale.</strong> Si l'histoire ne vous convient pas ou n'est pas livrée, écrivez à {brand.SUPPORT_EMAIL} : nous la refaisons ou vous remboursons.</p>
<p><strong>Usage.</strong> Usage personnel et familial uniquement. Contenu généré avec l'aide d'une IA, voix de synthèse.</p>
<p><strong>Médiation.</strong> Médiateur de la consommation : [À COMPLÉTER avant l'ouverture].</p>"""),
"mentions-legales.html": ("Mentions légales", f"""<h1>Mentions légales</h1><p>Éditeur : [NOM PRÉNOM], entrepreneur individuel, SIRET [À COMPLÉTER], [ADRESSE]. Contact : {brand.SUPPORT_EMAIL}.</p>
<p>Hébergement : [Cloudflare Pages / GitHub Pages — À COMPLÉTER]. Paiement : Stripe Payments Europe Ltd.</p>"""),
"confidentialite.html": ("Politique de confidentialité", f"""<h1>Politique de confidentialité</h1>
<p>Données collectées : e-mail du parent, prénom et âge de l'enfant, situation choisie. Finalité : créer et livrer l'histoire commandée (exécution du contrat). Elles sont transmises à nos sous-traitants techniques (Stripe pour le paiement, Anthropic pour l'écriture, ElevenLabs pour la voix, un service d'envoi d'e-mails) et ne sont pas utilisées à d'autres fins.</p>
<p>Le prénom et l'âge de l'enfant ne sont pas conservés dans nos fichiers ; l'e-mail et les données de paiement sont conservés par Stripe selon les obligations comptables. Droits d'accès, de rectification et d'effacement : {brand.SUPPORT_EMAIL}. Réclamation possible auprès de la CNIL.</p>"""),
"merci.html": ("Merci !", """<h1>Merci ! 🌙</h1><p>Votre histoire est en cours de création. Vous la recevrez par e-mail en moins d'une heure (pensez à vérifier vos courriers indésirables).</p>"""),
}

def main():
    OUT.mkdir(exist_ok=True)
    (OUT / "style.css").write_text(CSS)
    if not (OUT / "config.js").exists():
        (OUT / "config.js").write_text('window.PAYMENT_LINK="";// coller ici le lien affiché par engine.setup_stripe\n')
    (OUT / "index.html").write_text(home())
    for t in THEMES: (OUT / f"{t['slug']}.html").write_text(theme(t))
    for f, (title, body) in LEGAL.items(): (OUT / f).write_text(simple(title, body, f))
    urls = ["", *[t["slug"] + ".html" for t in THEMES], "cgv.html", "mentions-legales.html", "confidentialite.html"]
    (OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(f"<url><loc>{brand.DOMAIN}/{u}</loc></url>" for u in urls) + "</urlset>")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {brand.DOMAIN}/sitemap.xml\n")
    print(len(list(OUT.iterdir())), "fichiers")
main()
