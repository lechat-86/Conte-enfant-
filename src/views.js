import { db, settings } from './db.js';
import { html, raw, esc, eur } from './util.js';
import { cartCount, parseImages } from './cart.js';
import { siteUrl } from './core.js';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_DIR } from './core.js';

const ver = (f) => { try { return Math.floor(fs.statSync(path.join(PUBLIC_DIR, f)).mtimeMs / 1000); } catch { return 1; } };

export const icon = {
  search: raw('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg>'),
  user: raw('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/></svg>'),
  bag: raw('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>'),
  menu: raw('<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'),
  lock: raw('<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'),
  box: raw('<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/></svg>'),
  heart: raw('<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>'),
  mail: raw('<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>'),
};

export const todo = (v) => (String(v || '').trim() ? v : raw('<span class="todo">à compléter</span>'));

export function wordmark() {
  const s = settings();
  if (s.logo) return html`<img class="logo-img" src="${s.logo}" alt="${s.shop_name}">`;
  return html`<span class="wm" aria-label="${s.shop_name}"><span class="wm-a">SHAÏ</span><span class="wm-amp">&amp;</span><span class="wm-b">GLOW</span></span>`;
}

export function productImage(p, cls = '') {
  const imgs = parseImages(p);
  if (imgs[0]) return html`<img class="${cls}" src="${imgs[0]}" alt="${p.name}${p.brand ? ' ' + p.brand : ''}" loading="lazy">`;
  return html`<div class="ph ${cls}" role="img" aria-label="${p.name}"><span>S<i>&amp;</i>G</span></div>`;
}

export function stockBadge(p) {
  if (p.stock <= 0) return html`<span class="badge badge-out">Épuisé</span>`;
  if (p.stock <= p.low_stock) return html`<span class="badge">Plus que ${p.stock}</span>`;
  return '';
}

export function priceBlock(p) {
  return html`<span class="price">${eur(p.price_cents)}</span>${p.compare_cents && p.compare_cents > p.price_cents ? html` <s class="price-old">${eur(p.compare_cents)}</s>` : ''}`;
}

export function productCard(ctx, p) {
  return html`<article class="card">
    <a class="card-img" href="/produit/${p.slug}">${productImage(p)}${stockBadge(p)}</a>
    <div class="card-body">
      ${p.brand ? html`<p class="card-brand">${p.brand}</p>` : ''}
      <h3 class="card-title"><a href="/produit/${p.slug}">${p.name}</a></h3>
      ${p.size ? html`<p class="card-size">${p.size}</p>` : ''}
      <p class="card-price">${priceBlock(p)}</p>
      ${p.stock > 0 ? html`<form method="post" action="/panier/ajouter"><input type="hidden" name="_csrf" value="${ctx.session.csrf}"><input type="hidden" name="product_id" value="${p.id}"><input type="hidden" name="back" value="${ctx.path}"><button class="btn btn-sm btn-block">Ajouter au panier</button></form>`
        : html`<a class="btn btn-sm btn-block btn-ghost" href="/produit/${p.slug}">Voir le produit</a>`}
    </div></article>`;
}

export const csrf = (ctx) => html`<input type="hidden" name="_csrf" value="${ctx.session.csrf}">`;

export function layout(ctx, { title, description = '', body, noindex = false, image = '', extraHead = '' }) {
  const s = settings();
  const cats = db.prepare('SELECT slug,name FROM categories ORDER BY position,id').all();
  const flash = ctx.session.flash; if (flash) { ctx.session.flash = null; ctx.touch(); }
  const base = siteUrl(ctx);
  const fullTitle = title ? `${title} — ${s.shop_name}` : `${s.shop_name} — Parfums, brumes & maquillage`;
  const desc = description || 'Boutique en ligne : parfums, brumes, parfums de maison et maquillage.';
  const n = cartCount(ctx);
  const nav = html`<a href="/boutique">Boutique</a>${cats.map((c) => html`<a href="/categorie/${c.slug}">${c.name}</a>`)}<a href="/coups-de-coeur">Nos coups de cœur</a><a href="/a-propos">Notre univers</a><a href="/contact">Contact</a>`;
  return html`<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title><meta name="description" content="${desc}">
${noindex ? html`<meta name="robots" content="noindex,nofollow">` : html`<link rel="canonical" href="${base}${ctx.path === '/' ? '' : ctx.path}">`}
<meta property="og:type" content="website"><meta property="og:title" content="${fullTitle}"><meta property="og:description" content="${desc}"><meta property="og:locale" content="fr_FR">
${image ? html`<meta property="og:image" content="${base}${image}">` : ''}
<meta name="theme-color" content="#f6e3e0"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/cormorant-garamond-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/style.css?v=${ver('css/style.css')}">
${extraHead}
</head><body>
<a class="skip" href="#main">Aller au contenu</a>
${s.announcement ? html`<div class="announce">${s.announcement}</div>` : ''}
<header class="header">
  <div class="header-in">
    <button class="icon-btn menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false" aria-controls="mainNav">${icon.menu}</button>
    <a class="brand" href="/" aria-label="${s.shop_name} — accueil">${wordmark()}</a>
    <nav class="nav" id="mainNav" aria-label="Navigation principale">${nav}</nav>
    <div class="header-actions">
      <a class="icon-btn" href="/recherche" aria-label="Rechercher">${icon.search}</a>
      <a class="icon-btn" href="${ctx.user ? '/compte' : '/compte/connexion'}" aria-label="Mon compte">${icon.user}</a>
      <a class="icon-btn cart-btn" href="/panier" aria-label="Panier (${n})">${icon.bag}${n ? html`<span class="cart-count">${n}</span>` : ''}</a>
    </div>
  </div>
</header>
<main id="main">
${flash ? html`<div class="flash flash-${flash.type}" role="status">${flash.msg}</div>` : ''}
${body}
</main>
<footer class="footer">
  <div class="footer-in">
    <div class="footer-brand"><div class="brand">${wordmark()}</div>
      <p>Parfums, brumes, parfums de maison et maquillage.</p>
      ${s.instagram || s.tiktok ? html`<p class="social">${s.instagram ? html`<a href="${s.instagram}" rel="noopener" target="_blank">Instagram</a>` : ''}${s.tiktok ? html`<a href="${s.tiktok}" rel="noopener" target="_blank">TikTok</a>` : ''}</p>` : ''}
    </div>
    <div><h4>Boutique</h4><ul>${cats.map((c) => html`<li><a href="/categorie/${c.slug}">${c.name}</a></li>`)}<li><a href="/coups-de-coeur">Nos coups de cœur</a></li></ul></div>
    <div><h4>Aide</h4><ul><li><a href="/livraison">Livraison</a></li><li><a href="/retours">Retours &amp; remboursements</a></li><li><a href="/faq">Questions fréquentes</a></li><li><a href="/contact">Nous contacter</a></li><li><a href="/compte">Mon compte</a></li></ul></div>
    <div><h4>Informations</h4><ul><li><a href="/a-propos">Notre univers</a></li><li><a href="/cgv">Conditions générales de vente</a></li><li><a href="/mentions-legales">Mentions légales</a></li><li><a href="/confidentialite">Confidentialité</a></li></ul></div>
  </div>
  <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${s.shop_name}</span><span>Paiement sécurisé par Stripe</span></div>
</footer>
<script src="/js/app.js?v=${ver('js/app.js')}" defer></script>
</body></html>`;
}

export function pageHead(title, sub = '') {
  return html`<section class="page-head"><div class="wrap"><h1>${title}</h1>${sub ? html`<p>${sub}</p>` : ''}</div></section>`;
}
export const breadcrumb = (items) => html`<nav class="crumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a>${items.map(([label, href]) => html` <span>/</span> ${href ? html`<a href="${href}">${label}</a>` : html`<span aria-current="page">${label}</span>`}`)}</nav>`;
export { esc };
