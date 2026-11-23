import { db, settings } from './db.js';
import { route, siteUrl, tooMany } from './core.js';
import { html, raw, eur, fromCents, nl2br, isEmail, clampInt, esc } from './util.js';
import { layout, productCard, productImage, priceBlock, stockBadge, csrf, pageHead, breadcrumb, icon, todo } from './views.js';
import { cartInfo, parseImages } from './cart.js';
import { mailContact } from './mail.js';

/* ---------- Erreurs ---------- */
export function notFound(ctx) {
  ctx.html(layout(ctx, { title: 'Page introuvable', noindex: true, body: html`<section class="wrap narrow center section"><h1>Page introuvable</h1><p>Cette page n’existe pas ou a été déplacée.</p><p><a class="btn" href="/boutique">Retourner à la boutique</a></p></section>` }), 404);
}
export function errorPage(ctx) {
  ctx.html(layout(ctx, { title: 'Erreur', noindex: true, body: html`<section class="wrap narrow center section"><h1>Oups…</h1><p>Un problème est survenu de notre côté. Merci de réessayer dans un instant.</p><p><a class="btn" href="/">Accueil</a></p></section>` }), 500);
}
export function forbidden(ctx) {
  ctx.html(layout(ctx, { title: 'Session expirée', noindex: true, body: html`<section class="wrap narrow center section"><h1>Session expirée</h1><p>Pour votre sécurité, la page a expiré. Merci de recharger la page et de recommencer.</p><p><a class="btn" href="/">Accueil</a></p></section>` }), 403);
}

const PER_PAGE = 12;
const SORTS = { nouveautes: ['Notre sélection', 'created_at DESC'], 'prix-asc': ['Prix croissant', 'price_cents ASC'], 'prix-desc': ['Prix décroissant', 'price_cents DESC'] };

function pagination(ctx, total, page) {
  const pages = Math.ceil(total / PER_PAGE); if (pages <= 1) return '';
  const link = (n) => { const u = new URL(ctx.url); u.searchParams.set('page', n); return u.pathname + u.search; };
  return html`<nav class="pager" aria-label="Pagination">${Array.from({ length: pages }, (_, i) => i + 1).map((n) => n === page ? html`<span aria-current="page">${n}</span>` : html`<a href="${link(n)}">${n}</a>`)}</nav>`;
}

function chips(path) {
  const cats = db.prepare('SELECT slug,name FROM categories ORDER BY position,id').all();
  const items = [['Tout voir', '/boutique'], ...cats.map((c) => [c.name, `/categorie/${c.slug}`]), ['♥ Nos coups de cœur', '/coups-de-coeur']];
  return html`<nav class="chips" aria-label="Filtrer par catégorie">${items.map(([l, h]) => html`<a href="${h}" class="${h === path ? 'on' : ''}" ${h === path ? raw('aria-current="page"') : ''}>${l}</a>`)}</nav>`;
}

function listing(ctx, { where = '1=1', params = [], title, intro, crumbs, path }) {
  const sort = SORTS[ctx.query.tri] ? ctx.query.tri : 'nouveautes';
  const page = clampInt(ctx.query.page, 1, 999, 1);
  const base = `FROM products WHERE active=1 AND deleted=0 AND ${where}`;
  const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(...params).c;
  const items = db.prepare(`SELECT * ${base} ORDER BY (stock>0) DESC, ${SORTS[sort][1]} LIMIT ? OFFSET ?`).all(...params, PER_PAGE, (page - 1) * PER_PAGE);
  return html`${pageHead(title, intro)}
  <section class="wrap section-sm">
    ${breadcrumb(crumbs)}
    ${chips(path)}
    <div class="toolbar"><span class="muted">${total} produit${total > 1 ? 's' : ''}</span>
      <form method="get" action="${path}" class="sort"><label for="tri" class="sr">Trier</label>
        <select id="tri" name="tri" data-autosubmit>${Object.entries(SORTS).map(([k, [l]]) => html`<option value="${k}" ${k === sort ? raw('selected') : ''}>${l}</option>`)}</select>
        <noscript><button class="btn btn-sm">OK</button></noscript></form></div>
    ${items.length ? html`<div class="grid">${items.map((p) => productCard(ctx, p))}</div>${pagination(ctx, total, page)}`
      : html`<div class="empty"><p>Aucun produit pour le moment.</p><p class="muted">De nouvelles références arrivent bientôt.</p></div>`}
  </section>`;
}

/* ---------- Accueil ---------- */
route('GET', '/', (ctx) => {
  const cats = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.active=1 AND p.deleted=0) n FROM categories c ORDER BY position,id`).all();
  const products = db.prepare('SELECT * FROM products WHERE active=1 AND deleted=0 ORDER BY (stock>0) DESC, created_at DESC LIMIT 8').all();
  const hearts = db.prepare('SELECT * FROM products WHERE active=1 AND deleted=0 AND featured=1 ORDER BY (stock>0) DESC, created_at DESC LIMIT 4').all();
  const s = settings();
  ctx.html(layout(ctx, { image: parseImages(products[0] || {})[0] || '', body: html`
  <section class="hero">
    <div class="hero-in wrap">
      <div class="hero-text">
        <p class="eyebrow">Beauté · Parfums · Maquillage</p>
        <h1>Révélez <em>votre éclat</em></h1>
        <p class="lead">Parfums, brumes, parfums de maison et maquillage, sélectionnés auprès de fournisseurs européens.</p>
        <p class="hero-cta"><a class="btn" href="/boutique">Découvrir la boutique</a><a class="btn btn-ghost" href="#categories">Nos univers</a></p>
      </div>
      <div class="hero-art" aria-hidden="true"><div class="arch arch-1"></div><div class="arch arch-2"></div><div class="orb"></div><span class="hero-mono">S<i>&amp;</i>G</span></div>
    </div>
  </section>
  <section class="reassure"><div class="wrap reassure-in">
    <div>${icon.lock}<b>Paiement sécurisé</b><span>Carte bancaire via Stripe</span></div>
    <div>${icon.box}<b>Préparé avec soin</b><span>Chaque commande est emballée à la main</span></div>
    <div>${icon.mail}<b>Suivi par e-mail</b><span>Confirmation et expédition</span></div>
    <div>${icon.heart}<b>Une sélection exigeante</b><span>Produits choisis auprès de fournisseurs européens</span></div>
  </div></section>
  <section class="section wrap" id="categories">
    <h2 class="section-title">Nos univers</h2>
    <div class="cat-grid">${cats.map((c, i) => html`<a class="cat cat-${i % 4}" href="/categorie/${c.slug}"><span class="cat-name">${c.name}</span><span class="cat-desc">${c.description}</span><span class="cat-go">Découvrir →</span></a>`)}</div>
  </section>
  ${hearts.length ? html`<section class="section wrap"><h2 class="section-title">Nos coups de cœur</h2><div class="grid">${hearts.map((p) => productCard(ctx, p))}</div><p class="center mt"><a class="btn btn-ghost" href="/coups-de-coeur">Tous nos coups de cœur</a></p></section>` : ''}
  <section class="section section-tint"><div class="wrap">
    <h2 class="section-title">La sélection</h2>
    ${products.length ? html`<div class="grid">${products.map((p) => productCard(ctx, p))}</div><p class="center mt"><a class="btn btn-ghost" href="/boutique">Voir toute la boutique</a></p>` : html`<p class="center muted">Les premiers produits arrivent très bientôt.</p>`}
  </div></section>
  <section class="section wrap narrow center">
    <p class="eyebrow">Notre univers</p>
    <h2 class="section-title">${s.shop_name}</h2>
    <p class="lead-dark">Une boutique de beauté féminine, douce et élégante : des parfums, des brumes, des parfums de maison et du maquillage pour sublimer votre quotidien. Chaque commande est préparée et expédiée avec soin.</p>
    <p><a class="link" href="/a-propos">En savoir plus</a></p>
  </section>` }));
});

/* ---------- Catalogue ---------- */
route('GET', '/coups-de-coeur', (ctx) => ctx.html(layout(ctx, { title: 'Nos coups de cœur', description: 'Nos produits coups de cœur.', body: listing(ctx, { where: 'featured=1', title: 'Nos coups de cœur', intro: 'Les produits que nous aimons particulièrement', crumbs: [['Boutique', '/boutique'], ['Nos coups de cœur']], path: '/coups-de-coeur' }) })));
route('GET', '/boutique', (ctx) => ctx.html(layout(ctx, { title: 'Boutique', description: 'Tous nos produits : parfums, brumes, parfums de maison et maquillage.', body: listing(ctx, { title: 'La boutique', intro: 'Tous nos produits', crumbs: [['Boutique']], path: '/boutique' }) })));
route('GET', '/categorie/:slug', (ctx) => {
  const c = db.prepare('SELECT * FROM categories WHERE slug=?').get(ctx.params.slug);
  if (!c) return;
  ctx.html(layout(ctx, { title: c.name, description: c.description, body: listing(ctx, { where: 'category_id=?', params: [c.id], title: c.name, intro: c.description, crumbs: [['Boutique', '/boutique'], [c.name]], path: `/categorie/${c.slug}` }) }));
});
route('GET', '/recherche', (ctx) => {
  const q = String(ctx.query.q || '').trim().slice(0, 60);
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const items = q ? db.prepare(`SELECT * FROM products WHERE active=1 AND deleted=0 AND (name LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\' OR short_desc LIKE ? ESCAPE '\\') ORDER BY (stock>0) DESC LIMIT 48`).all(like, like, like) : [];
  ctx.html(layout(ctx, { title: 'Recherche', noindex: true, body: html`${pageHead('Rechercher')}<section class="wrap section-sm">
    <form class="searchbar" method="get" action="/recherche"><input type="search" name="q" value="${q}" placeholder="Un produit, une marque…" aria-label="Rechercher" autofocus><button class="btn">Rechercher</button></form>
    ${q ? (items.length ? html`<p class="muted">${items.length} résultat${items.length > 1 ? 's' : ''} pour « ${q} »</p><div class="grid">${items.map((p) => productCard(ctx, p))}</div>` : html`<div class="empty"><p>Aucun résultat pour « ${q} ».</p></div>`) : ''}
  </section>` }));
});

/* ---------- Fiche produit ---------- */
route('GET', '/produit/:slug', (ctx) => {
  const p = db.prepare('SELECT p.*, c.name cat_name, c.slug cat_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.slug=? AND p.active=1 AND p.deleted=0').get(ctx.params.slug);
  if (!p) return;
  const s = settings(); const imgs = parseImages(p);
  const related = p.category_id ? db.prepare('SELECT * FROM products WHERE category_id=? AND id<>? AND active=1 AND deleted=0 AND stock>0 ORDER BY created_at DESC LIMIT 4').all(p.category_id, p.id) : [];
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.name, brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined, description: p.short_desc || undefined, image: imgs.map((i) => siteUrl(ctx) + i), offers: { '@type': 'Offer', priceCurrency: 'EUR', price: (p.price_cents / 100).toFixed(2), availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: `${siteUrl(ctx)}/produit/${p.slug}` } }).replace(/</g, '\\u003c');
  ctx.html(layout(ctx, {
    title: `${p.name}${p.brand ? ' ' + p.brand : ''}`, description: p.short_desc, image: imgs[0] || '',
    extraHead: raw(`<script type="application/ld+json">${ld}</script>`),
    body: html`<section class="wrap section-sm">
      ${breadcrumb([['Boutique', '/boutique'], ...(p.cat_name ? [[p.cat_name, `/categorie/${p.cat_slug}`]] : []), [p.name]])}
      <div class="pdp">
        <div class="gallery">
          <div class="gallery-main" id="galleryMain">${productImage(p)}</div>
          ${imgs.length > 1 ? html`<div class="thumbs">${imgs.map((src, i) => html`<button type="button" class="thumb ${i === 0 ? 'on' : ''}" data-src="${src}" aria-label="Photo ${i + 1}"><img src="${src}" alt="" loading="lazy"></button>`)}</div>` : ''}
        </div>
        <div class="pdp-info">
          ${p.brand ? html`<p class="card-brand">${p.brand}</p>` : ''}
          <h1 class="pdp-title">${p.name}</h1>
          ${p.size ? html`<p class="muted">${p.size}</p>` : ''}
          <p class="pdp-price">${priceBlock(p)} <small class="muted">TTC</small></p>
          ${p.short_desc ? html`<p>${p.short_desc}</p>` : ''}
          <p class="stock ${p.stock > 0 ? 'ok' : 'ko'}">${p.stock <= 0 ? 'Actuellement épuisé' : p.stock <= p.low_stock ? `Plus que ${p.stock} en stock` : 'En stock'}</p>
          ${p.stock > 0 ? html`<form method="post" action="/panier/ajouter" class="buy">${csrf(ctx)}<input type="hidden" name="product_id" value="${p.id}"><input type="hidden" name="back" value="/produit/${p.slug}">
            <div class="qty" data-max="${p.stock}"><button type="button" data-d="-1" aria-label="Moins">−</button><input name="qty" value="1" inputmode="numeric" aria-label="Quantité"><button type="button" data-d="1" aria-label="Plus">+</button></div>
            <button class="btn btn-lg">Ajouter au panier</button></form>` : html`<p><a class="btn btn-ghost" href="/contact">Nous contacter pour être prévenue du retour en stock</a></p>`}
          <ul class="pdp-points"><li>${icon.lock}<span>Paiement sécurisé par carte</span></li><li>${icon.box}<span>Expédition soignée depuis la boutique</span></li></ul>
          <details open><summary>Description</summary><div class="details-body"><p>${nl2br(p.description || p.short_desc)}</p></div></details>
          <details><summary>Livraison &amp; retours</summary><div class="details-body"><p>Frais de livraison : ${eur(parseInt(s.shipping_flat_cents, 10) || 0)}${parseInt(s.free_shipping_cents, 10) ? `, offerts dès ${eur(parseInt(s.free_shipping_cents, 10))} d’achat` : ''}. <a href="/livraison">Détails de livraison</a> · <a href="/retours">Retours</a></p></div></details>
        </div>
      </div>
      ${related.length ? html`<h2 class="section-title mt">Vous aimerez aussi</h2><div class="grid">${related.map((r) => productCard(ctx, r))}</div>` : ''}
    </section>`,
  }));
});

/* ---------- Panier ---------- */
route('POST', '/panier/ajouter', (ctx) => {
  const id = clampInt(ctx.body.product_id, 1, 1e9, 0); const qty = clampInt(ctx.body.qty, 1, 99, 1);
  const p = db.prepare('SELECT * FROM products WHERE id=? AND active=1 AND deleted=0').get(id);
  const back = /^\/[a-z0-9\-/_]*$/i.test(ctx.body.back || '') ? ctx.body.back : '/boutique';
  if (!p || p.stock <= 0) { ctx.flash('error', 'Ce produit n’est plus disponible.'); return ctx.redirect(back); }
  const cur = parseInt(ctx.session.cart[id], 10) || 0;
  const next = Math.min(p.stock, cur + qty);
  ctx.session.cart[id] = next; ctx.touch();
  ctx.flash(next < cur + qty ? 'warn' : 'ok', next < cur + qty ? `Stock limité : ${p.stock} disponible(s) pour « ${p.name} ».` : `« ${p.name} » ajouté au panier.`);
  ctx.redirect(ctx.body.go === 'cart' ? '/panier' : back);
});
route('POST', '/panier/modifier', (ctx) => {
  const id = clampInt(ctx.body.product_id, 1, 1e9, 0); const qty = clampInt(ctx.body.qty, 0, 99, 0);
  if (qty <= 0) delete ctx.session.cart[id]; else ctx.session.cart[id] = qty;
  ctx.touch(); ctx.redirect('/panier');
});
route('GET', '/panier', (ctx) => {
  const c = cartInfo(ctx); const s = settings();
  c.notices.forEach((m) => ctx.flash('warn', m));
  const free = parseInt(s.free_shipping_cents, 10) || 0;
  ctx.html(layout(ctx, { title: 'Panier', noindex: true, body: html`${pageHead('Mon panier')}<section class="wrap section-sm">
    ${c.lines.length ? html`<div class="cart">
      <div class="cart-lines">${c.lines.map((l) => html`<div class="line">
        <a class="line-img" href="/produit/${l.p.slug}">${productImage(l.p)}</a>
        <div class="line-info"><a class="line-title" href="/produit/${l.p.slug}">${l.p.name}</a><span class="muted">${l.p.brand} ${l.p.size ? '· ' + l.p.size : ''}</span><span>${eur(l.p.price_cents)}</span>
          <form method="post" action="/panier/modifier" class="line-form">${csrf(ctx)}<input type="hidden" name="product_id" value="${l.p.id}">
            <div class="qty" data-max="${l.p.stock}"><button type="button" data-d="-1" aria-label="Moins">−</button><input name="qty" value="${l.qty}" inputmode="numeric" aria-label="Quantité"><button type="button" data-d="1" aria-label="Plus">+</button></div>
            <button class="link-btn">Mettre à jour</button><button class="link-btn danger" name="qty" value="0">Retirer</button></form></div>
        <div class="line-total">${eur(l.total)}</div></div>`)}</div>
      <aside class="summary"><h2>Récapitulatif</h2>
        <dl><dt>Sous-total</dt><dd>${eur(c.subtotal)}</dd><dt>Livraison</dt><dd>${c.shipping ? eur(c.shipping) : 'Offerte'}</dd></dl>
        ${free && c.subtotal < free ? html`<p class="hint">Plus que ${eur(free - c.subtotal)} pour la livraison offerte ✨</p>` : ''}
        <dl class="total"><dt>Total TTC</dt><dd>${eur(c.total)}</dd></dl>
        <a class="btn btn-block btn-lg" href="/commande">Passer la commande</a>
        <p class="secure">${icon.lock} Paiement sécurisé par Stripe</p>
        <p class="center"><a class="link" href="/boutique">Continuer mes achats</a></p></aside></div>`
      : html`<div class="empty"><p>Votre panier est vide.</p><p><a class="btn" href="/boutique">Découvrir la boutique</a></p></div>`}
  </section>` }));
});

/* ---------- Contact ---------- */
route('GET', '/contact', (ctx) => ctx.html(layout(ctx, { title: 'Contact', description: 'Une question ? Écrivez-nous.', body: contactPage(ctx) })));
function contactPage(ctx, v = {}) {
  const s = settings();
  return html`${pageHead('Nous contacter', 'Une question sur une commande ou un produit ? Écrivez-nous.')}
  <section class="wrap narrow section-sm">
    ${s.contact_email ? html`<p class="center">Vous pouvez aussi nous écrire à <a class="link" href="mailto:${s.contact_email}">${s.contact_email}</a>.</p>` : ''}
    <form method="post" action="/contact" class="form">${csrf(ctx)}
      <div class="hp" aria-hidden="true"><label>Ne pas remplir <input name="website" tabindex="-1" autocomplete="off"></label></div>
      <label>Votre nom <input name="name" required maxlength="80" value="${v.name || ctx.user?.first_name || ''}" autocomplete="name"></label>
      <label>Votre e-mail <input type="email" name="email" required maxlength="160" value="${v.email || ctx.user?.email || ''}" autocomplete="email"></label>
      <label>Sujet <input name="subject" maxlength="120" value="${v.subject || ''}"></label>
      <label>Message <textarea name="body" rows="6" required maxlength="3000">${v.body || ''}</textarea></label>
      <button class="btn btn-lg">Envoyer</button>
    </form></section>`;
}
route('POST', '/contact', async (ctx) => {
  if (ctx.body.website) return ctx.redirect('/contact'); // anti-spam (champ piège)
  if (tooMany(ctx, 'contact', 5)) { ctx.flash('error', 'Trop de messages envoyés. Réessayez plus tard.'); return ctx.redirect('/contact'); }
  const m = { name: ctx.form('name').slice(0, 80), email: ctx.form('email').slice(0, 160), subject: ctx.form('subject').slice(0, 120), body: ctx.form('body').slice(0, 3000) };
  if (!m.name || !isEmail(m.email) || !m.body) { ctx.flash('error', 'Merci de remplir votre nom, un e-mail valide et votre message.'); return ctx.html(layout(ctx, { title: 'Contact', body: contactPage(ctx, m) }), 400); }
  db.prepare('INSERT INTO messages(name,email,subject,body,created_at) VALUES(?,?,?,?,?)').run(m.name, m.email, m.subject, m.body, Date.now());
  mailContact(m);
  ctx.flash('ok', 'Merci ! Votre message a bien été envoyé. Nous vous répondons dès que possible.');
  ctx.redirect('/contact');
});

/* ---------- Pages d'information ---------- */
const info = (path, title, desc, render) => route('GET', path, (ctx) => ctx.html(layout(ctx, { title, description: desc, body: html`${pageHead(title)}<section class="wrap narrow prose section-sm">${render(settings(), ctx)}</section>` })));
const N = (v, suffix = '') => (String(v || '').trim() ? html`${v}${suffix}` : todo(''));

info('/a-propos', 'Notre univers', 'Découvrez SHAÏ & GLOW, boutique de beauté féminine et élégante.', (s) => html`
  <p class="lead-dark">${s.shop_name} est une boutique en ligne de beauté : parfums, brumes, parfums de maison et maquillage.</p>
  <p>Nous sélectionnons nos produits auprès de fournisseurs européens et préparons chaque commande nous-mêmes, avec soin, avant de l’expédier.</p>
  <p>Notre idée : une beauté simple, douce et accessible, pour se faire plaisir au quotidien.</p>
  <p><a class="btn" href="/boutique">Découvrir la boutique</a></p>`);

info('/livraison', 'Livraison', 'Modes, délais et frais de livraison.', (s) => html`
  <h2>Frais de livraison</h2>
  <p>Livraison : <b>${eur(parseInt(s.shipping_flat_cents, 10) || 0)}</b>${parseInt(s.free_shipping_cents, 10) ? html` — <b>offerte dès ${eur(parseInt(s.free_shipping_cents, 10))}</b> d’achat` : ''}. Les frais sont affichés avant le paiement.</p>
  <h2>Pays livrés</h2><p>${N(s.shipping_countries)}</p>
  <h2>Délais</h2>
  <p>Préparation de la commande : ${N(s.prep_delay)}.<br>Livraison : ${N(s.delivery_delay)}${s.carrier_name ? html` via ${s.carrier_name}` : ''}.</p>
  <p>Vous recevez un e-mail à l’expédition, avec le numéro de suivi lorsque le transporteur en fournit un. Les délais de livraison sont donnés à titre indicatif.</p>`);

info('/retours', 'Retours & remboursements', 'Droit de rétractation et procédure de retour.', (s) => html`
  <h2>Droit de rétractation</h2>
  <p>Vous disposez de <b>${s.return_days || 14} jours</b> à compter de la réception de votre commande pour vous rétracter, sans avoir à justifier de motif.</p>
  <p><b>Exception pour raisons d’hygiène :</b> les produits cosmétiques <b>descellés</b> ou ouverts après livraison ne peuvent pas être repris (article L.221-28 du Code de la consommation). Les produits non ouverts, dans leur emballage d’origine, peuvent être retournés.</p>
  <h2>Comment faire ?</h2>
  <ol><li>Écrivez-nous via la <a href="/contact">page contact</a> en indiquant votre numéro de commande.</li><li>Renvoyez le produit non ouvert à : ${N(s.return_address)}.</li><li>Après réception et contrôle, nous vous remboursons par le moyen de paiement utilisé, dans un délai maximum de 14 jours.</li></ol>
  <p>Les frais de retour sont à la charge de la cliente, sauf produit défectueux ou erreur de notre part.</p>
  <h2>Produit endommagé ou erreur</h2><p>Contactez-nous rapidement avec une photo : nous trouverons une solution (échange ou remboursement).</p>`);

info('/faq', 'Questions fréquentes', 'Réponses aux questions les plus courantes.', (s) => html`
  <details open><summary>Comment payer ma commande ?</summary><div class="details-body"><p>Par carte bancaire, via la page de paiement sécurisée Stripe. Nous ne voyons ni ne conservons vos données bancaires.</p></div></details>
  <details><summary>Quand vais-je recevoir ma commande ?</summary><div class="details-body"><p>Consultez notre page <a href="/livraison">Livraison</a>. Vous êtes prévenue par e-mail à l’expédition.</p></div></details>
  <details><summary>Puis-je retourner un produit ?</summary><div class="details-body"><p>Oui, dans les conditions décrites sur la page <a href="/retours">Retours</a> (produits non ouverts).</p></div></details>
  <details><summary>Où trouver la composition d’un produit ?</summary><div class="details-body"><p>Sur l’emballage du produit. Une question sur un ingrédient ou une allergie ? <a href="/contact">Écrivez-nous</a> avant de commander.</p></div></details>
  <details><summary>Dois-je créer un compte pour commander ?</summary><div class="details-body"><p>Non, vous pouvez commander en invitée. Un compte permet de retrouver vos commandes et d’enregistrer votre adresse.</p></div></details>`);

info('/mentions-legales', 'Mentions légales', 'Informations légales.', (s) => html`
  <h2>Éditeur du site</h2>
  <p>Nom commercial : <b>${s.shop_name}</b><br>Raison sociale / exploitant : ${N(s.company_name)}<br>Forme juridique : ${N(s.legal_form)}<br>SIRET : ${N(s.siret)}<br>Adresse : ${N(s.company_address)}<br>E-mail : ${N(s.contact_email)}${s.phone ? html`<br>Téléphone : ${s.phone}` : ''}<br>Directrice de la publication : ${N(s.publication_director)}</p>
  <p>${s.vat_mode === 'franchise' ? 'TVA non applicable, article 293 B du CGI.' : html`N° de TVA intracommunautaire : ${N(s.vat_number)}`}</p>
  <h2>Hébergement</h2><p>${N(s.hosting_info)}</p>
  <h2>Propriété intellectuelle</h2><p>Les textes, images et le logo présents sur ce site sont la propriété de ${s.shop_name} ou utilisés avec autorisation. Toute reproduction sans accord est interdite.</p>
  <h2>Médiation de la consommation</h2><p>${N(s.mediator)}</p>`);

info('/confidentialite', 'Politique de confidentialité', 'Protection de vos données personnelles.', (s) => html`
  <p>Responsable du traitement : ${N(s.company_name || s.shop_name)} — contact : ${N(s.contact_email)}.</p>
  <h2>Données collectées</h2><p>Lors d’une commande ou de la création d’un compte : nom, prénom, e-mail, téléphone, adresse de livraison, historique de commandes. Via le formulaire de contact : nom, e-mail et message.</p>
  <h2>Finalités</h2><p>Traiter et livrer vos commandes, gérer votre compte, répondre à vos demandes, respecter nos obligations légales (comptabilité, facturation).</p>
  <h2>Paiement</h2><p>Le paiement est géré par Stripe. Vos données de carte bancaire sont saisies sur la page sécurisée de Stripe et ne sont jamais enregistrées sur ce site.</p>
  <h2>Destinataires</h2><p>Vos données sont uniquement accessibles à ${s.shop_name} et à ses prestataires techniques nécessaires au service (paiement, envoi d’e-mails, hébergement, transporteur).</p>
  <h2>Durée de conservation</h2><p>Les données de commande sont conservées pendant la durée légale (10 ans pour les pièces comptables). Les données de compte sont conservées tant que le compte existe.</p>
  <h2>Vos droits</h2><p>Accès, rectification, effacement, opposition, limitation, portabilité : écrivez-nous à ${N(s.contact_email)}. Vous pouvez également saisir la CNIL (cnil.fr).</p>
  <h2>Cookies</h2><p>Ce site utilise uniquement un cookie technique indispensable (panier et connexion). Aucun cookie publicitaire ou de mesure d’audience n’est déposé.</p>`);

info('/cgv', 'Conditions générales de vente', 'Conditions générales de vente de la boutique.', (s) => html`
  <h2>1. Vendeur</h2><p>${N(s.company_name || s.shop_name)} — SIRET ${N(s.siret)} — ${N(s.company_address)} — ${N(s.contact_email)}.</p>
  <h2>2. Produits et prix</h2><p>Les produits sont décrits avec la plus grande exactitude possible. Les prix sont indiqués en euros, toutes taxes comprises${s.vat_mode === 'franchise' ? ' (TVA non applicable, art. 293 B du CGI)' : ''}, hors frais de livraison. Les prix peuvent être modifiés à tout moment, le prix applicable est celui affiché lors de la validation de la commande. Les offres sont valables dans la limite des stocks disponibles.</p>
  <h2>3. Commande</h2><p>La commande est confirmée après paiement. Un e-mail de confirmation est envoyé. Nous nous réservons le droit d’annuler et de rembourser une commande en cas de rupture de stock ou d’erreur manifeste de prix.</p>
  <h2>4. Paiement</h2><p>Le paiement s’effectue en ligne par carte bancaire (ou autres moyens proposés sur la page de paiement) via Stripe, de manière sécurisée.</p>
  <h2>5. Livraison</h2><p>Frais : ${eur(parseInt(s.shipping_flat_cents, 10) || 0)}${parseInt(s.free_shipping_cents, 10) ? `, offerts dès ${eur(parseInt(s.free_shipping_cents, 10))}` : ''}. Pays desservis : ${N(s.shipping_countries)}. Délai de préparation : ${N(s.prep_delay)}. Délai de livraison : ${N(s.delivery_delay)}. Les délais sont indicatifs ; en cas de retard de plus de 30 jours, vous pouvez annuler la commande.</p>
  <h2>6. Droit de rétractation</h2><p>Vous disposez de 14 jours après réception pour vous rétracter (voir la page <a href="/retours">Retours</a>). Conformément à l’article L.221-28 du Code de la consommation, ce droit ne s’applique pas aux produits scellés ne pouvant être renvoyés pour des raisons d’hygiène ou de protection de la santé et qui ont été descellés après la livraison.</p>
  <h2>7. Garanties légales</h2><p>Le vendeur reste tenu de la garantie légale de conformité (articles L.217-3 et suivants du Code de la consommation) et de la garantie des vices cachés (articles 1641 et suivants du Code civil).</p>
  <h2>8. Données personnelles</h2><p>Voir notre <a href="/confidentialite">politique de confidentialité</a>.</p>
  <h2>9. Médiation et litiges</h2><p>${N(s.mediator)} Les présentes conditions sont soumises au droit français.</p>`);

/* ---------- SEO ---------- */
route('GET', '/robots.txt', (ctx) => ctx.text(`User-agent: *\nDisallow: /admin\nDisallow: /compte\nDisallow: /panier\nDisallow: /commande\nSitemap: ${siteUrl(ctx)}/sitemap.xml\n`));
route('GET', '/sitemap.xml', (ctx) => {
  const u = siteUrl(ctx);
  const urls = ['/', '/boutique', '/coups-de-coeur', '/a-propos', '/livraison', '/retours', '/faq', '/contact', '/cgv', '/mentions-legales', '/confidentialite',
    ...db.prepare('SELECT slug FROM categories').all().map((c) => `/categorie/${c.slug}`),
    ...db.prepare('SELECT slug FROM products WHERE active=1 AND deleted=0').all().map((p) => `/produit/${p.slug}`)];
  ctx.text(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((x) => `<url><loc>${esc(u + x)}</loc></url>`).join('')}</urlset>`, 200, 'application/xml; charset=utf-8');
});
