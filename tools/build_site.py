"""Génère site/ : accueil, métiers, guides, légal, sitemap. Les exemples audio n'apparaissent que si site/audio/<clé>.mp3 existe."""
import html as H, json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine import brand
from engine.catalog import METIERS, MESSAGE_TYPES, SAMPLES, FAQ, GUIDES

OUT = ROOT / "site"
N, P1, P3, D = brand.NAME, brand.PRICE_SINGLE, brand.PRICE_PACK, brand.DOMAIN
CSS = """:root{--bg:#f5f7fb;--ink:#0f1b33;--muted:#55607a;--card:#fff;--line:#e2e7f0;--brand:#12306b;--accent:#f59e0b;--accent-ink:#2a1a00;--ok:#0f8a5f}
@media(prefers-color-scheme:dark){:root{--bg:#0b1222;--ink:#eef2fb;--muted:#a3adc6;--card:#131c33;--line:#25304d;--brand:#7aa7ff;--accent:#fbbf24;--accent-ink:#1d1300;--ok:#34d399}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding-bottom:76px}
a{color:var(--brand)}img,audio{max-width:100%}.wrap{max-width:1040px;margin:auto;padding:0 18px}
header.top{background:var(--card);border-bottom:1px solid var(--line)}header.top .wrap{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;gap:12px}
.logo{font-weight:800;font-size:1.2rem;text-decoration:none;color:var(--ink)}.logo span{color:var(--accent)}
.btn{display:inline-block;background:var(--accent);color:var(--accent-ink);font-weight:800;padding:14px 26px;border-radius:12px;text-decoration:none;border:0;cursor:pointer;font-size:1rem;box-shadow:0 2px 0 rgba(0,0,0,.15)}
.btn:hover{filter:brightness(1.05)}.btn.alt{background:transparent;color:var(--ink);border:2px solid var(--line);box-shadow:none}
.hero{padding:44px 0 28px}.hero .grid{display:grid;grid-template-columns:1.2fr 1fr;gap:32px;align-items:center}
h1{font-size:2.3rem;line-height:1.15;margin:0 0 14px}h2{font-size:1.55rem;line-height:1.25;margin:0 0 12px}h3{margin:0 0 6px}
.lead{font-size:1.15rem;color:var(--muted)}.badges{display:flex;flex-wrap:wrap;gap:8px 18px;list-style:none;padding:0;margin:18px 0 0;color:var(--muted);font-size:.93rem}.badges li:before{content:"✓ ";color:var(--ok);font-weight:800}
.phone{background:var(--brand);color:#fff;border-radius:22px;padding:22px;box-shadow:0 12px 30px rgba(18,48,107,.25)}
@media(prefers-color-scheme:dark){.phone{background:#1c2a4d;color:#fff}}
.phone small{opacity:.8}.phone q{display:block;font-size:1.1rem;margin:8px 0 12px;quotes:none}
section{padding:30px 0}.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px}
.cols{display:grid;gap:16px}.c3{grid-template-columns:repeat(3,1fr)}.c2{grid-template-columns:repeat(2,1fr)}
.step b{display:inline-flex;width:34px;height:34px;border-radius:50%;background:var(--accent);color:var(--accent-ink);align-items:center;justify-content:center;margin-bottom:8px}
.offer{position:relative}.offer.best{border:2px solid var(--accent)}.tag{position:absolute;top:-13px;left:18px;background:var(--accent);color:var(--accent-ink);font-weight:800;font-size:.8rem;padding:3px 12px;border-radius:99px}
.price{font-size:2.4rem;font-weight:800}.price small{font-size:1rem;color:var(--muted);font-weight:500}.offer ul{padding-left:20px;margin:12px 0 18px}
audio{width:100%;margin-top:8px}.sample p{margin:6px 0;color:var(--muted)}.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.95rem}th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--muted)}
details{border-bottom:1px solid var(--line);padding:12px 0}summary{cursor:pointer;font-weight:700}details p{margin:8px 0 0;color:var(--muted)}
blockquote{margin:10px 0;padding:12px 16px;border-left:4px solid var(--accent);background:var(--card);border-radius:0 10px 10px 0}
.muted{color:var(--muted);font-size:.92rem}.links a{display:inline-block;margin:4px 10px 4px 0}
.sticky{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:10px 14px;display:none;gap:10px;z-index:9}.sticky .btn{flex:1;text-align:center;padding:12px}
footer{border-top:1px solid var(--line);padding:24px 0;color:var(--muted);font-size:.9rem}footer a{margin-right:14px}
@media(max-width:760px){h1{font-size:1.75rem}.hero .grid,.c3,.c2{grid-template-columns:1fr}.sticky{display:flex}.hero{padding-top:24px}body{font-size:16.5px}th,td{padding:8px 6px;font-size:.82rem}}"""

JS = """(function(){var q=new URLSearchParams(location.search),r=q.get('ref');try{if(r){r=r.replace(/[^A-Za-z0-9_-]/g,'').slice(0,60);sessionStorage.setItem('ref',r)}else r=sessionStorage.getItem('ref')}catch(e){}
var L={pack:window.LINK_PACK,single:window.LINK_SINGLE};document.querySelectorAll('[data-buy]').forEach(function(a){var u=L[a.dataset.buy];
if(!u){a.href='mailto:'+(window.CONTACT||'')+'?subject=Commande';return}if(r)u+=(u.indexOf('?')<0?'?':'&')+'client_reference_id='+encodeURIComponent(r);a.href=u})})();"""

def has_audio(k): return (OUT / "audio" / f"{k}.mp3").exists()

def head(title, desc, slug, extra=""):
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{H.escape(title)}</title><meta name="description" content="{H.escape(desc)}"><link rel="canonical" href="{D}/{slug}">
<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:site_name" content="{N}"><meta property="og:title" content="{H.escape(title)}"><meta property="og:description" content="{H.escape(desc)}"><meta property="og:url" content="{D}/{slug}">
<meta name="theme-color" content="#12306b"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%2312306b'/%3E%3Cpath d='M30 40h12l16-14v48L42 60H30z' fill='%23f59e0b'/%3E%3C/svg%3E">
<link rel="stylesheet" href="style.css">{extra}</head>"""

def layout(title, desc, slug, body, extra="", sticky=True):
    bar = f"""<div class="sticky"><a class="btn" data-buy="pack" href="#">Pack 3 messages — {P3} €</a><a class="btn alt" data-buy="single" href="#">1 message — {P1} €</a></div>""" if sticky else ""
    return head(title, desc, slug, extra) + f"""<body><header class="top"><div class="wrap"><a class="logo" href="index.html">🎙️ Première <span>Voix</span></a>
<a class="btn" data-buy="pack" href="#">Commander</a></div></header>{body}
<footer><div class="wrap"><p><strong>{N}</strong> — messages d'accueil, répondeurs et messages d'attente professionnels.</p>
<p><a href="guide-message-accueil-telephonique.html">Guides</a><a href="cgv.html">CGV</a><a href="mentions-legales.html">Mentions légales</a><a href="confidentialite.html">Confidentialité</a><a href="mailto:{brand.SUPPORT_EMAIL}">Contact</a></p>
<p>Textes rédigés avec l'aide d'une intelligence artificielle ; voix de synthèse. Paiement sécurisé par Stripe.</p></div></footer>{bar}
<script src="config.js"></script><script>{JS}</script></body></html>"""

def buy(cls=""): return f"""<p><a class="btn" data-buy="pack" href="#">Pack 3 messages — {P3} €</a> <a class="btn alt" data-buy="single" href="#">1 message — {P1} €</a></p>"""
def wrap(inner): return f'<div class="wrap">{inner}</div>'

def samples():
    cards = ""
    for s in SAMPLES:
        player = f'<audio controls preload="none" src="audio/{s["key"]}.mp3"></audio>' if has_audio(s["key"]) else '<p class="muted">🔊 Version audio à venir.</p>'
        cards += f"""<div class="card sample"><h3>{s['titre']} · voix {'féminine' if s['voix']=='f' else 'masculine'}</h3><p>Exemple fictif — {H.escape(s['entreprise'])}</p>{player}<blockquote>{H.escape(s['texte'])}</blockquote></div>"""
    return cards

def home():
    faq = "".join(f"<details><summary>{H.escape(q)}</summary><p>{H.escape(a)}</p></details>" for q, a in FAQ)
    metiers = "".join(f'<a href="{m["slug"]}.html">{m["nom"].capitalize()}</a>' for m in METIERS)
    ld = {"@context": "https://schema.org", "@graph": [
      {"@type": "Organization", "name": N, "url": D + "/", "email": brand.SUPPORT_EMAIL},
      {"@type": "Product", "name": f"Pack 3 messages vocaux professionnels ({N})", "description": "Message d'accueil, répondeur hors horaires et message d'attente, en MP3 et WAV 8 kHz.",
       "brand": {"@type": "Brand", "name": N}, "offers": {"@type": "Offer", "price": str(P3), "priceCurrency": "EUR", "availability": "https://schema.org/InStock", "url": D + "/"}},
      {"@type": "Product", "name": f"Message vocal professionnel ({N})", "description": "Un message d'accueil, répondeur, attente ou fermeture, en MP3 et WAV 8 kHz.",
       "brand": {"@type": "Brand", "name": N}, "offers": {"@type": "Offer", "price": str(P1), "priceCurrency": "EUR", "availability": "https://schema.org/InStock", "url": D + "/"}},
      {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}]}
    body = f"""<main><section class="hero"><div class="wrap grid"><div>
<h1>Un message d'accueil professionnel pour votre téléphone, prêt en moins d'une heure</h1>
<p class="lead">Ne laissez plus un répondeur absent ou approximatif faire fuir vos futurs clients. Donnez le nom de votre entreprise et vos horaires : nous rédigeons, enregistrons en voix française naturelle et vous livrons des fichiers prêts à installer.</p>
{buy()}<ul class="badges"><li>Livraison par e-mail en moins d'une heure</li><li>MP3 + WAV 8 kHz pour standard</li><li>Sans abonnement</li><li>Modification offerte, remboursé si insatisfait</li></ul></div>
<div class="phone"><small>🔔 L'appelant entend :</small><q>« Bonjour, vous êtes bien chez Dupont Plomberie. Merci de patienter un instant, nous allons prendre votre appel. »</q><small>Exemple de message d'accueil · texte adapté à votre métier</small></div></div></section>
<section><div class="wrap"><h2>Comment ça marche</h2><div class="cols c3">
<div class="card step"><b>1</b><h3>Vous commandez</h3><p>Paiement sécurisé Stripe. Vous indiquez entreprise, voix (féminine ou masculine) et infos à citer.</p></div>
<div class="card step"><b>2</b><h3>Nous créons</h3><p>Texte rédigé pour votre métier, enregistrement en voix française, audio nettoyé et volume normalisé.</p></div>
<div class="card step"><b>3</b><h3>Vous installez</h3><p>Vous recevez MP3 et WAV 8 kHz mono par e-mail, avec les textes pour relecture et une notice d'installation.</p></div></div></div></section>
<section id="exemples"><div class="wrap"><h2>Écoutez avant de commander</h2><div class="cols c3">{samples()}</div></div></section>
<section id="offres"><div class="wrap"><h2>Nos offres</h2><div class="cols c2">
<div class="card offer best"><span class="tag">Le plus choisi</span><h3>Pack 3 messages</h3><div class="price">{P3} €</div>
<ul><li>Message d'accueil</li><li>Répondeur hors horaires</li><li>Message d'attente</li><li>Voix au choix, MP3 + WAV 8 kHz</li><li>1 modification de texte offerte</li></ul><a class="btn" data-buy="pack" href="#">Commander le pack</a></div>
<div class="card offer"><h3>1 message</h3><div class="price">{P1} €</div>
<ul><li>Accueil, répondeur, attente <em>ou</em> fermeture exceptionnelle</li><li>Voix au choix, MP3 + WAV 8 kHz</li><li>1 modification de texte offerte</li></ul><a class="btn alt" data-buy="single" href="#">Commander 1 message</a></div></div>
<p class="muted">Paiement unique, sans abonnement. Prix en euros ; mention TVA selon statut. Besoin d'un message en anglais, d'une voix spécifique ou de plusieurs services ? <a href="mailto:{brand.SUPPORT_EMAIL}">Écrivez-nous</a>.</p></div></section>
<section><div class="wrap"><h2>Pourquoi nous choisir</h2><div class="card"><div class="tw"><table><tr><th></th><th>{N}</th><th>Voix off humaine (plateformes)</th><th>Standard IA complet</th></tr>
<tr><td>Délai</td><td><strong>≈ 1 heure</strong></td><td>souvent 24 h ou plus</td><td>installation parfois sous 48 h</td></tr>
<tr><td>Tarif observé*</td><td><strong>{P1} € le message, {P3} € le pack</strong></td><td>environ 15 à 35 $ le message sur annonces</td><td>à partir d'environ 49 €/mois</td></tr>
<tr><td>Engagement</td><td><strong>aucun</strong></td><td>aucun</td><td>abonnement</td></tr>
<tr><td>Fichiers prêts pour standard</td><td><strong>MP3 + WAV 8 kHz</strong></td><td>variable</td><td>sans objet</td></tr></table></div>
<p class="muted">*Tarifs relevés sur des annonces et comparateurs publics en 2026, à titre indicatif ; ils varient selon les prestataires.</p></div>
<div class="cols c3" style="margin-top:16px"><div class="card"><h3>🔒 Paiement sécurisé</h3><p>Réglé via Stripe. Nous ne voyons jamais votre carte.</p></div><div class="card"><h3>🧾 Entreprise identifiée</h3><p>Mentions légales, CGV et contact visibles. Remboursement si le résultat ne convient pas.</p></div><div class="card"><h3>🤖 Transparence IA</h3><p>Texte et voix créés avec une IA, relus par des garde-fous automatiques. Vous validez avant d'installer.</p></div></div></div></section>
<section><div class="wrap"><h2>Pour tous les métiers qui vivent du téléphone</h2><p class="links">{metiers}</p></div></section>
<section><div class="wrap"><h2>Questions fréquentes</h2><div class="card">{faq}</div>{buy()}</div></section></main>"""
    return layout(f"{N} — Message d'accueil téléphonique professionnel en 1 heure", "Messages d'accueil, répondeurs et messages d'attente pour TPE et artisans : texte rédigé pour votre métier, voix française naturelle, MP3 + WAV 8 kHz. Dès 19 €.", "", body,
                  extra=f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>')

def metier(m):
    body = f"""<main><section><div class="wrap"><h1>Message d'accueil et répondeur pour un {m['nom']}</h1>
<p class="lead">Deux textes courts, adaptables, qui rassurent l'appelant et donnent l'information essentielle. Remplacez les noms et horaires par les vôtres, ou faites-les enregistrer en 1 heure.</p>
<div class="card"><h2>Message d'accueil (pré-décroché)</h2><blockquote>{H.escape(m['accueil'])}</blockquote><h2>Répondeur hors horaires</h2><blockquote>{H.escape(m['horaires'])}</blockquote></div>
<h2 style="margin-top:22px">Recevez-les enregistrés, prêts à installer</h2><p>Nous adaptons ces textes à votre entreprise, les enregistrons en voix française naturelle et livrons MP3 + WAV 8 kHz par e-mail.</p>{buy()}
<p class="muted">Voir aussi : <a href="guide-message-accueil-telephonique.html">le guide du message d'accueil</a> · <a href="guide-message-repondeur-hors-horaires.html">le guide du répondeur</a>.</p></div></section></main>"""
    return layout(f"Message d'accueil et répondeur pour {m['nom']} : exemples | {N}", f"Exemples de message d'accueil et de répondeur pour {m['nom']}, à copier ou à faire enregistrer en voix française en 1 heure.", m["slug"] + ".html", body)

def guide(g):
    body = f"""<main><section><div class="wrap"><h1>{g['titre']}</h1><div class="card">{g['html']}</div><h2 style="margin-top:22px">Besoin d'un message prêt à l'emploi ?</h2>{buy()}</div></section></main>"""
    return layout(f"{g['titre']} | {N}", g["desc"], g["slug"] + ".html", body)

LEGAL = {
"cgv.html": ("Conditions générales de vente", f"""<h1>Conditions générales de vente</h1>
<p><strong>Objet.</strong> Vente de messages vocaux numériques (audio MP3/WAV et texte) : {P1} € le message, {P3} € le pack de 3 messages (TVA non applicable, art. 293 B du CGI : <em>à ajuster selon le statut réel</em>).</p>
<p><strong>Commande.</strong> Après paiement via Stripe, le client renseigne l'entreprise, la voix et les informations à citer. Les fichiers sont livrés par e-mail, en principe sous une heure ; ce délai est indicatif.</p>
<p><strong>Responsabilité du contenu.</strong> Le client relit et valide les textes (horaires, noms, mentions) avant tout usage. Textes rédigés avec l'aide d'une IA à partir de ses seules informations ; voix de synthèse.</p>
<p><strong>Droit de rétractation.</strong> Contenu numérique fourni immédiatement avec l'accord exprès du client, qui renonce à son droit de rétractation (art. L221-28 13° du Code de la consommation).</p>
<p><strong>Garantie commerciale.</strong> Une modification de texte offerte ; si le résultat ne convient pas ou n'est pas livré, écrivez à {brand.SUPPORT_EMAIL} : remboursement.</p>
<p><strong>Licence d'usage.</strong> Le client peut utiliser les enregistrements sur ses lignes téléphoniques et son site, sans limite de durée. Revente interdite.</p>
<p><strong>Médiation.</strong> Médiateur de la consommation : [À COMPLÉTER avant l'ouverture].</p>"""),
"mentions-legales.html": ("Mentions légales", f"""<h1>Mentions légales</h1><p>Éditeur : [NOM PRÉNOM], entrepreneur individuel, SIRET [À COMPLÉTER], [ADRESSE]. Contact : {brand.SUPPORT_EMAIL}. Hébergement : [À COMPLÉTER]. Paiement : Stripe Payments Europe Ltd.</p>"""),
"confidentialite.html": ("Politique de confidentialité", f"""<h1>Politique de confidentialité</h1>
<p>Données : e-mail, nom de l'entreprise et informations saisies pour les messages. Finalité : fabriquer et livrer la commande, assurer le support (exécution du contrat). Sous-traitants techniques : Stripe (paiement), Anthropic (rédaction), ElevenLabs (voix), service d'envoi d'e-mails. Les contenus de commande ne sont pas conservés dans nos fichiers au-delà de la livraison et du support ; les données de paiement sont conservées par Stripe selon les obligations comptables. Un unique e-mail de demande d'avis peut être envoyé après la livraison (vous pouvez répondre « STOP »). Droits d'accès, rectification, effacement, opposition : {brand.SUPPORT_EMAIL}. Réclamation possible auprès de la CNIL. Ne saisissez pas de données personnelles de tiers dans les informations à citer.</p>"""),
"merci.html": ("Merci !", "<h1>Merci ! 🎙️</h1><p>Vos messages sont en cours de création. Vous les recevrez par e-mail en moins d'une heure (vérifiez vos courriers indésirables). Besoin d'aide pour l'installation ? Répondez à l'e-mail reçu.</p>"),
}

def main():
    OUT.mkdir(exist_ok=True)
    (OUT / "style.css").write_text(CSS)
    cfg = OUT / "config.js"
    if not cfg.exists():
        cfg.write_text(f'window.LINK_SINGLE="";window.LINK_PACK="";window.CONTACT="{brand.SUPPORT_EMAIL}";// coller les liens affichés par engine.setup_stripe\n')
    (OUT / "index.html").write_text(home())
    for m in METIERS: (OUT / f"{m['slug']}.html").write_text(metier(m))
    for g in GUIDES: (OUT / f"{g['slug']}.html").write_text(guide(g))
    for f, (t, b) in LEGAL.items():
        (OUT / f).write_text(layout(f"{t} | {N}", t, f, f'<main><section><div class="wrap card">{b}</div></section></main>', sticky=False))
    urls = ["", *[m["slug"] + ".html" for m in METIERS], *[g["slug"] + ".html" for g in GUIDES], "cgv.html", "mentions-legales.html", "confidentialite.html"]
    (OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(f"<url><loc>{D}/{u}</loc></url>" for u in urls) + "</urlset>")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /merci.html\nSitemap: {D}/sitemap.xml\n")
    print(f"{len(urls)} pages ; audio : {sum(has_audio(s['key']) for s in SAMPLES)}/{len(SAMPLES)} exemples ; liens Stripe : {'OK' if 'LINK_PACK=\"h' in cfg.read_text() else 'à renseigner (site/config.js)'}")
main()
