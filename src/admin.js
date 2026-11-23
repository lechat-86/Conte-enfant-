import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, tx, settings, saveSettings, SETTING_DEFAULTS, adjustStock, UPLOAD_DIR } from './db.js';
import { route, siteUrl } from './core.js';
import { html, raw, eur, fromCents, toCents, fmtDate, clampInt, slugify, nl2br } from './util.js';
import { icon, wordmark, productImage } from './views.js';
import { parseImages } from './cart.js';
import { STATUS, orderItems, cancelPending, expireStaleOrders } from './orders.js';
import { mailShipped } from './mail.js';
import { stripeApi, stripeEnabled } from './stripe.js';

/* ---------- Gabarit admin ---------- */
const NAV = [['/admin', 'Tableau de bord'], ['/admin/commandes', 'Commandes'], ['/admin/produits', 'Produits'], ['/admin/stocks', 'Stocks'], ['/admin/categories', 'Catégories'], ['/admin/clients', 'Clientes'], ['/admin/messages', 'Messages'], ['/admin/reglages', 'Réglages']];
function adminPage(ctx, active, title, body, status = 200) {
  const flash = ctx.session.flash; if (flash) { ctx.session.flash = null; ctx.touch(); }
  const toShip = db.prepare("SELECT COUNT(*) c FROM orders WHERE status='paid'").get().c;
  const unread = db.prepare('SELECT COUNT(*) c FROM messages WHERE handled=0').get().c;
  ctx.html(html`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Admin</title><meta name="robots" content="noindex,nofollow"><meta name="csrf" content="${ctx.session.csrf}"><link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/css/style.css"></head><body class="adm-body">
<div class="adm">
  <aside class="adm-side"><a class="adm-brand" href="/admin">${wordmark()}<small>Administration</small></a>
    <nav>${NAV.map(([href, label]) => html`<a href="${href}" class="${active === href ? 'on' : ''}">${label}${href === '/admin/commandes' && toShip ? html`<b class="dot">${toShip}</b>` : ''}${href === '/admin/messages' && unread ? html`<b class="dot">${unread}</b>` : ''}</a>`)}</nav>
    <a class="adm-view" href="/" target="_blank">Voir la boutique ↗</a>
    <form method="post" action="/compte/deconnexion"><input type="hidden" name="_csrf" value="${ctx.session.csrf}"><button class="link-btn">Déconnexion</button></form></aside>
  <main class="adm-main"><h1 class="adm-title">${title}</h1>${flash ? html`<div class="flash flash-${flash.type}" role="status">${flash.msg}</div>` : ''}${body}</main>
</div><script src="/js/admin.js" defer></script></body></html>`, status);
}
const A = (p, handler, method = 'GET', opts) => route(method, p, async (ctx) => {
  if (!ctx.user) return ctx.redirect('/compte/connexion?next=' + encodeURIComponent(ctx.path));
  if (ctx.user.role !== 'admin') return ctx.text('Accès réservé', 403);
  return handler(ctx);
}, opts);
const csrfIn = (ctx) => html`<input type="hidden" name="_csrf" value="${ctx.session.csrf}">`;
const pill = (s) => html`<span class="pill ${STATUS[s]?.[1]}">${STATUS[s]?.[0] || s}</span>`;
const inp = (label, name, v = '', extra = '', hint = '') => html`<label>${label}<input name="${name}" value="${v}" ${raw(extra)}>${hint ? html`<small class="muted">${hint}</small>` : ''}</label>`;
const confirmAttr = (msg) => raw(`data-confirm="${msg.replace(/"/g, '&quot;')}"`);

/* ---------- Tableau de bord ---------- */
A('/admin', (ctx) => {
  expireStaleOrders();
  const s = settings();
  const q = (sql, ...a) => db.prepare(sql).get(...a);
  const since = Date.now() - 30 * 864e5;
  const rev = q("SELECT COALESCE(SUM(total_cents),0) t, COUNT(*) n FROM orders WHERE status IN ('paid','shipped','delivered') AND paid_at>=?", since);
  const revAll = q("SELECT COALESCE(SUM(total_cents),0) t, COUNT(*) n FROM orders WHERE status IN ('paid','shipped','delivered')");
  const margin = q("SELECT COALESCE(SUM((i.unit_cents-i.cost_cents)*i.qty),0) m FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status IN ('paid','shipped','delivered')").m;
  const toShip = db.prepare("SELECT * FROM orders WHERE status='paid' ORDER BY paid_at").all();
  const low = db.prepare('SELECT * FROM products WHERE deleted=0 AND stock<=low_stock ORDER BY stock').all();
  const stockValue = q('SELECT COALESCE(SUM(stock*cost_cents),0) v FROM products WHERE deleted=0 AND stock>0').v;
  const recent = db.prepare("SELECT * FROM orders WHERE status<>'pending' ORDER BY created_at DESC LIMIT 6").all();
  const checks = [
    ['Clé Stripe (paiement)', stripeEnabled(), '/admin/reglages#stripe'], ['Webhook Stripe', !!process.env.STRIPE_WEBHOOK_SECRET, '/admin/reglages#stripe'],
    ['E-mails (confirmations)', !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM), '/admin/reglages#stripe'],
    ['Logo', !!s.logo, '/admin/reglages'], ['E-mail de contact', !!s.contact_email, '/admin/reglages'],
    ['Raison sociale & SIRET', !!(s.company_name && s.siret), '/admin/reglages'], ['Adresse de l’entreprise', !!s.company_address, '/admin/reglages'],
    ['Directrice de la publication', !!s.publication_director, '/admin/reglages'], ['Hébergeur (mentions légales)', !!s.hosting_info, '/admin/reglages'],
    ['Médiateur de la consommation', !!s.mediator, '/admin/reglages'], ['Délais de préparation et de livraison', !!(s.prep_delay && s.delivery_delay), '/admin/reglages'],
    ['Adresse de retour', !!s.return_address, '/admin/reglages'],
  ];
  const todoN = checks.filter((c) => !c[1]).length;
  adminPage(ctx, '/admin', 'Tableau de bord', html`
  <div class="stats">
    <div class="stat"><span>À préparer</span><b>${toShip.length}</b><a href="/admin/commandes?statut=paid">voir</a></div>
    <div class="stat"><span>Ventes 30 jours</span><b>${eur(rev.t)}</b><small>${rev.n} commande(s)</small></div>
    <div class="stat"><span>Ventes totales</span><b>${eur(revAll.t)}</b><small>${revAll.n} commande(s)</small></div>
    <div class="stat"><span>Marge brute*</span><b>${eur(margin)}</b><small>prix de vente − prix d’achat</small></div>
    <div class="stat"><span>Valeur du stock</span><b>${eur(stockValue)}</b><small>au prix d’achat</small></div>
  </div>
  <p class="muted small">* Avant frais de paiement Stripe, frais d’envoi, emballages, impôts et cotisations.</p>
  ${toShip.length ? html`<h2>Commandes à préparer</h2><div class="table-wrap"><table class="table"><tbody>${toShip.map((o) => html`<tr><td><a class="link" href="/admin/commandes/${o.id}">${o.number}</a></td><td>${o.first_name} ${o.last_name}</td><td>${fmtDate(o.paid_at)}</td><td class="r">${eur(o.total_cents)}</td></tr>`)}</tbody></table></div>` : ''}
  ${low.length ? html`<h2>Stock à surveiller</h2><div class="table-wrap"><table class="table"><tbody>${low.map((p) => html`<tr><td><a class="link" href="/admin/produits/${p.id}">${p.name}</a></td><td>${p.stock <= 0 ? html`<b class="danger">Épuisé</b>` : html`Plus que <b>${p.stock}</b>`}</td><td class="r"><a class="link" href="/admin/stocks">Réapprovisionner</a></td></tr>`)}</tbody></table></div>` : ''}
  ${recent.length ? html`<h2>Dernières commandes</h2><div class="table-wrap"><table class="table"><tbody>${recent.map((o) => html`<tr><td><a class="link" href="/admin/commandes/${o.id}">${o.number}</a></td><td>${fmtDate(o.created_at)}</td><td>${pill(o.status)}</td><td class="r">${eur(o.total_cents)}</td></tr>`)}</tbody></table></div>` : ''}
  <h2>Avant l’ouverture ${todoN ? html`<span class="pill st-pending">${todoN} à compléter</span>` : html`<span class="pill st-paid">Tout est prêt ✓</span>`}</h2>
  <ul class="checks">${checks.map(([l, ok, href]) => html`<li class="${ok ? 'ok' : 'ko'}"><span>${ok ? '✓' : '○'}</span> ${ok ? l : html`<a href="${href}">${l}</a>`}</li>`)}</ul>`);
});

/* ---------- Produits ---------- */
const safeImgs = (v) => { try { return JSON.parse(v).filter((x) => /^\/uploads\/[a-z0-9._-]+$/i.test(x)).slice(0, 6); } catch { return []; } };
function uniqueSlug(name, ignoreId = 0) {
  const base = slugify(name); let s = base; let i = 2;
  while (db.prepare('SELECT 1 FROM products WHERE slug=? AND id<>?').get(s, ignoreId)) s = `${base}-${i++}`;
  return s;
}

A('/admin/produits', (ctx) => {
  const ps = db.prepare('SELECT p.*, c.name cat FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.deleted=0 ORDER BY p.created_at DESC').all();
  adminPage(ctx, '/admin/produits', 'Produits', html`<p><a class="btn" href="/admin/produits/nouveau">+ Ajouter un produit</a></p>
  ${ps.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th></th><th>Produit</th><th>Catégorie</th><th class="r">Prix</th><th class="r">Achat</th><th class="r">Marge</th><th class="r">Stock</th><th>État</th></tr></thead><tbody>
  ${ps.map((p) => html`<tr><td class="thumb-cell">${productImage(p)}</td><td><a class="link" href="/admin/produits/${p.id}"><b>${p.name}</b></a>${p.featured ? ' ♥' : ''}<br><small class="muted">${p.brand} ${p.size}</small></td><td>${p.cat || '—'}</td><td class="r">${eur(p.price_cents)}</td><td class="r">${eur(p.cost_cents)}</td><td class="r">${eur(p.price_cents - p.cost_cents)}</td>
   <td class="r">${p.stock <= 0 ? html`<b class="danger">0</b>` : p.stock <= p.low_stock ? html`<b class="warn">${p.stock}</b>` : p.stock}</td><td>${p.active ? html`<span class="pill st-paid">En ligne</span>` : html`<span class="pill st-pending">Masqué</span>`}</td></tr>`)}</tbody></table></div>`
    : html`<div class="empty"><p>Aucun produit.</p></div>`}`);
});

function productForm(ctx, p = {}) {
  const cats = db.prepare('SELECT * FROM categories ORDER BY position,id').all();
  const imgs = safeImgs(p.images || '[]');
  const isNew = !p.id;
  return html`<form method="post" action="/admin/produits/enregistrer" class="form admin-form">${csrfIn(ctx)}<input type="hidden" name="id" value="${p.id || ''}">
  <div class="panel"><h2>Informations</h2>
    ${inp('Nom du produit *', 'name', p.name, 'required maxlength="140"')}
    <div class="row2">${inp('Marque', 'brand', p.brand, 'maxlength="80"')}${inp('Contenance / format', 'size', p.size, 'maxlength="40" placeholder="ex : 250 ml"')}</div>
    <label>Catégorie <select name="category_id"><option value="">— Aucune —</option>${cats.map((c) => html`<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${c.name}</option>`)}</select></label>
    <label>Description courte <small class="muted">(affichée sous le prix et dans Google)</small><textarea name="short_desc" rows="2" maxlength="300">${p.short_desc}</textarea></label>
    <label>Description détaillée <small class="muted">(composition, conseils d’utilisation, précautions : copiez-les depuis l’emballage / la fiche fournisseur)</small><textarea name="description" rows="8" maxlength="5000">${p.description}</textarea></label></div>
  <div class="panel"><h2>Photos</h2>
    <input type="hidden" name="images" id="imagesField" value="${JSON.stringify(imgs)}">
    <div class="img-manager" id="imgManager"></div>
    <label class="file-btn">+ Ajouter une photo<input type="file" id="imgFile" accept="image/*" multiple hidden></label>
    <small class="muted">La première photo est l’image principale. Les photos sont réduites automatiquement. Ajoutez vos propres photos (ou celles autorisées par le fournisseur).</small></div>
  <div class="panel"><h2>Prix &amp; stock</h2>
    <div class="row3">${inp('Prix de vente TTC (€) *', 'price', p.price_cents != null ? fromCents(p.price_cents) : '', 'required inputmode="decimal"')}${inp('Ancien prix barré (€)', 'compare', p.compare_cents ? fromCents(p.compare_cents) : '', 'inputmode="decimal"', 'facultatif')}${inp('Prix d’achat HT (€)', 'cost', p.cost_cents != null ? fromCents(p.cost_cents) : '', 'inputmode="decimal"', 'jamais visible des clientes')}</div>
    <div class="row3">${inp('Stock disponible', 'stock', p.stock ?? 0, 'inputmode="numeric"')}${inp('Alerte stock bas à', 'low_stock', p.low_stock ?? 3, 'inputmode="numeric"')}${inp('Référence fournisseur', 'sku', p.sku, 'maxlength="60"')}</div>
    ${inp('Fournisseur', 'supplier', p.supplier, 'maxlength="100"')}
    <label class="check"><input type="checkbox" name="active" value="1" ${p.active === 0 ? '' : 'checked'}> <span>Produit visible dans la boutique</span></label>
    <label class="check"><input type="checkbox" name="featured" value="1" ${p.featured ? 'checked' : ''}> <span>♥ Afficher dans « Nos coups de cœur »</span></label></div>
  <p class="actions"><button class="btn btn-lg">${isNew ? 'Créer le produit' : 'Enregistrer'}</button> <a class="btn btn-ghost" href="/admin/produits">Annuler</a></p></form>
  ${!isNew ? html`<form method="post" action="/admin/produits/${p.id}/supprimer" class="mt" ${confirmAttr('Supprimer définitivement ce produit de la boutique ? (l’historique des commandes est conservé)')}>${csrfIn(ctx)}<button class="btn btn-danger btn-sm">Supprimer ce produit</button></form>` : ''}`;
}
A('/admin/produits/nouveau', (ctx) => adminPage(ctx, '/admin/produits', 'Nouveau produit', productForm(ctx)));
A('/admin/produits/:id', (ctx) => {
  const p = db.prepare('SELECT * FROM products WHERE id=? AND deleted=0').get(Number(ctx.params.id));
  if (!p) return;
  adminPage(ctx, '/admin/produits', 'Modifier le produit', html`<p><a class="link" href="/produit/${p.slug}" target="_blank">Voir la fiche en ligne ↗</a></p>${productForm(ctx, p)}`);
});
A('/admin/produits/enregistrer', (ctx) => {
  const f = (k, n = 200) => ctx.form(k).slice(0, n);
  const id = clampInt(ctx.body.id, 0, 1e9, 0);
  const name = f('name', 140); const price = toCents(ctx.body.price);
  if (!name || price <= 0) { ctx.flash('error', 'Le nom et un prix de vente supérieur à 0 sont obligatoires.'); return ctx.redirect(id ? `/admin/produits/${id}` : '/admin/produits/nouveau'); }
  const compare = toCents(ctx.body.compare); const stock = clampInt(ctx.body.stock, 0, 1e6, 0);
  const row = {
    name, brand: f('brand', 80), size: f('size', 40), sku: f('sku', 60), supplier: f('supplier', 100), short_desc: f('short_desc', 300), description: ctx.form('description').slice(0, 5000),
    category_id: clampInt(ctx.body.category_id, 1, 1e9, 0) || null, price_cents: price, compare_cents: compare > price ? compare : null, cost_cents: toCents(ctx.body.cost),
    featured: ctx.body.featured === '1' ? 1 : 0, low_stock: clampInt(ctx.body.low_stock, 0, 1000, 3), images: JSON.stringify(safeImgs(ctx.body.images || '[]')), active: ctx.body.active === '1' ? 1 : 0,
  };
  const now = Date.now();
  let pid = id;
  tx(() => {
    if (id) {
      const old = db.prepare('SELECT * FROM products WHERE id=? AND deleted=0').get(id); if (!old) throw new Error('introuvable');
      db.prepare(`UPDATE products SET name=?,brand=?,size=?,sku=?,supplier=?,short_desc=?,description=?,category_id=?,price_cents=?,compare_cents=?,cost_cents=?,low_stock=?,images=?,active=?,featured=?,updated_at=? WHERE id=?`)
        .run(row.name, row.brand, row.size, row.sku, row.supplier, row.short_desc, row.description, row.category_id, row.price_cents, row.compare_cents, row.cost_cents, row.low_stock, row.images, row.active, row.featured, now, id);
      if (stock !== old.stock) adjustStock(id, stock - old.stock, 'Correction manuelle (fiche produit)');
    } else {
      const r = db.prepare(`INSERT INTO products(slug,name,brand,size,sku,supplier,short_desc,description,category_id,price_cents,compare_cents,cost_cents,stock,low_stock,images,active,featured,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)`)
        .run(uniqueSlug(name), row.name, row.brand, row.size, row.sku, row.supplier, row.short_desc, row.description, row.category_id, row.price_cents, row.compare_cents, row.cost_cents, row.low_stock, row.images, row.active, row.featured, now, now);
      pid = Number(r.lastInsertRowid);
      if (stock) adjustStock(pid, stock, 'Stock initial');
    }
  });
  ctx.flash('ok', 'Produit enregistré.'); ctx.redirect('/admin/produits');
}, 'POST');
A('/admin/produits/:id/supprimer', (ctx) => {
  const id = Number(ctx.params.id);
  db.prepare("UPDATE products SET deleted=1, active=0, slug=slug||'-supprime-'||id, updated_at=? WHERE id=? AND deleted=0").run(Date.now(), id);
  ctx.flash('ok', 'Produit supprimé.'); ctx.redirect('/admin/produits');
}, 'POST');

/* ---------- Catégories ---------- */
A('/admin/categories', (ctx) => {
  const cats = db.prepare('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.deleted=0) n FROM categories c ORDER BY position,id').all();
  adminPage(ctx, '/admin/categories', 'Catégories', html`
  ${cats.map((c) => html`<form method="post" action="/admin/categories/enregistrer" class="panel cat-form">${csrfIn(ctx)}<input type="hidden" name="id" value="${c.id}">
    <div class="row3">${inp('Nom', 'name', c.name, 'required maxlength="60"')}${inp('Description', 'description', c.description, 'maxlength="200"')}${inp('Ordre', 'position', c.position, 'inputmode="numeric"')}</div>
    <p class="actions"><button class="btn btn-sm">Enregistrer</button> <span class="muted">${c.n} produit(s)</span>
    <button class="btn btn-sm btn-danger" formaction="/admin/categories/${c.id}/supprimer" data-confirm="Supprimer cette catégorie ? Les produits ne seront pas supprimés." formnovalidate>Supprimer</button></p></form>`)}
  <form method="post" action="/admin/categories/enregistrer" class="panel cat-form">${csrfIn(ctx)}<h2>Nouvelle catégorie</h2>
    <div class="row3">${inp('Nom', 'name', '', 'required maxlength="60"')}${inp('Description', 'description', '', 'maxlength="200"')}${inp('Ordre', 'position', cats.length, 'inputmode="numeric"')}</div><p class="actions"><button class="btn btn-sm">Ajouter</button></p></form>`);
});
A('/admin/categories/enregistrer', (ctx) => {
  const id = clampInt(ctx.body.id, 0, 1e9, 0); const name = ctx.form('name').slice(0, 60);
  if (!name) { ctx.flash('error', 'Le nom est obligatoire.'); return ctx.redirect('/admin/categories'); }
  const pos = clampInt(ctx.body.position, 0, 999, 0); const desc = ctx.form('description').slice(0, 200);
  if (id) db.prepare('UPDATE categories SET name=?, description=?, position=? WHERE id=?').run(name, desc, pos, id);
  else {
    let slug = slugify(name), i = 2; while (db.prepare('SELECT 1 FROM categories WHERE slug=?').get(slug)) slug = `${slugify(name)}-${i++}`;
    db.prepare('INSERT INTO categories(slug,name,description,position) VALUES(?,?,?,?)').run(slug, name, desc, pos);
  }
  ctx.flash('ok', 'Catégorie enregistrée.'); ctx.redirect('/admin/categories');
}, 'POST');
A('/admin/categories/:id/supprimer', (ctx) => { db.prepare('DELETE FROM categories WHERE id=?').run(Number(ctx.params.id)); ctx.flash('ok', 'Catégorie supprimée.'); ctx.redirect('/admin/categories'); }, 'POST');

/* ---------- Stocks ---------- */
A('/admin/stocks', (ctx) => {
  const ps = db.prepare('SELECT * FROM products WHERE deleted=0 ORDER BY name').all();
  const moves = db.prepare('SELECT m.*, p.name FROM stock_moves m JOIN products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT 40').all();
  adminPage(ctx, '/admin/stocks', 'Stocks', html`
  <p class="muted">Ajoutez la marchandise reçue (nombre positif) ou retirez les pièces cassées / perdues (nombre négatif). Les commandes mettent à jour le stock automatiquement.</p>
  <div class="table-wrap"><table class="table"><thead><tr><th>Produit</th><th class="r">Stock</th><th>Mouvement</th></tr></thead><tbody>
  ${ps.map((p) => html`<tr><td><b>${p.name}</b><br><small class="muted">${p.brand} ${p.size}</small></td><td class="r">${p.stock <= 0 ? html`<b class="danger">${p.stock}</b>` : p.stock <= p.low_stock ? html`<b class="warn">${p.stock}</b>` : p.stock}</td>
    <td><form method="post" action="/admin/stocks/ajuster" class="inline-form">${csrfIn(ctx)}<input type="hidden" name="product_id" value="${p.id}"><input name="delta" inputmode="numeric" placeholder="+12 ou -1" required size="8" aria-label="Quantité">
    <select name="reason" aria-label="Motif"><option>Réception fournisseur</option><option>Casse / perte</option><option>Inventaire (correction)</option><option>Retour cliente</option></select><button class="btn btn-sm">Valider</button></form></td></tr>`)}</tbody></table></div>
  <h2>Historique récent</h2><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Produit</th><th class="r">Mouvement</th><th class="r">Solde</th><th>Motif</th></tr></thead><tbody>
  ${moves.map((m) => html`<tr><td>${fmtDate(m.created_at)}</td><td>${m.name}</td><td class="r">${m.delta > 0 ? '+' : ''}${m.delta}</td><td class="r">${m.balance}</td><td>${m.reason}</td></tr>`)}</tbody></table></div>`);
});
A('/admin/stocks/ajuster', (ctx) => {
  const id = clampInt(ctx.body.product_id, 1, 1e9, 0); const delta = parseInt(String(ctx.body.delta).replace('+', ''), 10);
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 100000) { ctx.flash('error', 'Indiquez une quantité valide (ex : +12 ou -1).'); return ctx.redirect('/admin/stocks'); }
  const reason = ['Réception fournisseur', 'Casse / perte', 'Inventaire (correction)', 'Retour cliente'].includes(ctx.body.reason) ? ctx.body.reason : 'Ajustement';
  const bal = tx(() => { const p = db.prepare('SELECT stock FROM products WHERE id=? AND deleted=0').get(id); if (!p || p.stock + delta < 0) return null; return adjustStock(id, delta, reason); });
  ctx.flash(bal === null ? 'error' : 'ok', bal === null ? 'Impossible : le stock ne peut pas être négatif.' : `Stock mis à jour : ${bal} en stock.`);
  ctx.redirect('/admin/stocks');
}, 'POST');

/* ---------- Commandes ---------- */
A('/admin/commandes', (ctx) => {
  const st = STATUS[ctx.query.statut] ? ctx.query.statut : '';
  const os = db.prepare(`SELECT * FROM orders WHERE ${st ? 'status=?' : "status<>'pending'"} ORDER BY created_at DESC LIMIT 200`).all(...(st ? [st] : []));
  adminPage(ctx, '/admin/commandes', 'Commandes', html`
  <div class="filters"><a class="${!st ? 'on' : ''}" href="/admin/commandes">Toutes</a>${Object.entries(STATUS).map(([k, [l]]) => html`<a class="${st === k ? 'on' : ''}" href="/admin/commandes?statut=${k}">${l}</a>`)}</div>
  ${os.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Date</th><th>Cliente</th><th>Statut</th><th class="r">Total</th></tr></thead><tbody>${os.map((o) => html`<tr><td><a class="link" href="/admin/commandes/${o.id}"><b>${o.number}</b></a></td><td>${fmtDate(o.created_at)}</td><td>${o.first_name} ${o.last_name}</td><td>${pill(o.status)}</td><td class="r">${eur(o.total_cents)}</td></tr>`)}</tbody></table></div>` : html`<div class="empty"><p>Aucune commande.</p></div>`}`);
});
const getOrder = (ctx) => db.prepare('SELECT * FROM orders WHERE id=?').get(Number(ctx.params.id));
A('/admin/commandes/:id', (ctx) => {
  const o = getOrder(ctx); if (!o) return;
  const items = orderItems(o.id);
  const paid = ['paid', 'shipped', 'delivered'].includes(o.status);
  adminPage(ctx, '/admin/commandes', `Commande ${o.number}`, html`
  <p>${pill(o.status)} <span class="muted">passée le ${fmtDate(o.created_at)}${o.paid_at ? ` · payée le ${fmtDate(o.paid_at)}` : ''}${o.shipped_at ? ` · expédiée le ${fmtDate(o.shipped_at)}` : ''}</span></p>
  <div class="two">
    <div class="panel"><h2>Articles</h2><table class="table"><tbody>${items.map((i) => html`<tr><td>${i.qty} × ${i.name}</td><td class="r">${eur(i.unit_cents * i.qty)}</td></tr>`)}
      <tr><td>Livraison</td><td class="r">${eur(o.shipping_cents)}</td></tr><tr><th>Total payé</th><th class="r">${eur(o.total_cents)}</th></tr></tbody></table>
      <p class="muted small">Marge brute : ${eur(items.reduce((a, i) => a + (i.unit_cents - i.cost_cents) * i.qty, 0))}</p></div>
    <div class="panel"><h2>Livraison</h2><p><b>${o.first_name} ${o.last_name}</b><br>${o.address1}<br>${o.address2 ? html`${o.address2}<br>` : ''}${o.postal_code} ${o.city}<br>${o.country}</p>
      <p>${o.email}<br>${o.phone || 'Pas de téléphone'}</p><p><a class="btn btn-ghost btn-sm" href="/admin/commandes/${o.id}/imprimer" target="_blank">🖨 Bon de préparation / étiquette</a></p></div>
  </div>
  ${o.status === 'paid' ? html`<div class="panel"><h2>Marquer comme expédiée</h2><form method="post" action="/admin/commandes/${o.id}/expedier" class="form">${csrfIn(ctx)}
    <div class="row2">${inp('Transporteur', 'carrier', o.carrier || settings().carrier_name, 'maxlength="60" placeholder="ex : Colissimo, Mondial Relay…"')}${inp('Numéro de suivi', 'tracking', o.tracking, 'maxlength="80"')}</div>
    <button class="btn">Expédiée — prévenir la cliente par e-mail</button></form></div>` : ''}
  ${o.status === 'shipped' ? html`<form method="post" action="/admin/commandes/${o.id}/livree" class="panel">${csrfIn(ctx)}<p>Suivi : <b>${o.carrier} ${o.tracking}</b></p><button class="btn btn-ghost">Marquer comme livrée</button></form>` : ''}
  ${o.status === 'pending' ? html`<form method="post" action="/admin/commandes/${o.id}/annuler" class="panel" ${confirmAttr('Annuler cette commande non payée et remettre le stock ?')}>${csrfIn(ctx)}<p class="muted">Paiement non finalisé. Le stock est réservé 45 minutes puis libéré automatiquement.</p><button class="btn btn-danger btn-sm">Annuler et libérer le stock</button></form>` : ''}
  ${paid ? html`<form method="post" action="/admin/commandes/${o.id}/rembourser" class="panel" ${confirmAttr('Rembourser intégralement cette commande ' + eur(o.total_cents) + ' ?')}>${csrfIn(ctx)}<h2>Remboursement</h2>
    <label class="check"><input type="checkbox" name="restock" value="1"> <span>Remettre les articles en stock</span></label>
    ${stripeEnabled() && o.payment_intent ? html`<button class="btn btn-danger btn-sm">Rembourser ${eur(o.total_cents)} via Stripe</button>` : html`<p class="muted">Remboursement automatique indisponible (Stripe non configuré). Remboursez depuis le tableau de bord Stripe.</p>`}</form>` : ''}
  <form method="post" action="/admin/commandes/${o.id}/note" class="panel form">${csrfIn(ctx)}<label>Note interne<textarea name="note" rows="3" maxlength="1000">${o.admin_note}</textarea></label><button class="btn btn-sm btn-ghost">Enregistrer la note</button></form>`);
});
A('/admin/commandes/:id/expedier', (ctx) => {
  const o = getOrder(ctx); if (!o || o.status !== 'paid') return ctx.redirect('/admin/commandes');
  db.prepare("UPDATE orders SET status='shipped', shipped_at=?, carrier=?, tracking=? WHERE id=?").run(Date.now(), ctx.form('carrier').slice(0, 60), ctx.form('tracking').slice(0, 80), o.id);
  mailShipped(db.prepare('SELECT * FROM orders WHERE id=?').get(o.id), siteUrl(ctx));
  ctx.flash('ok', `Commande ${o.number} expédiée. La cliente est prévenue par e-mail.`); ctx.redirect(`/admin/commandes/${o.id}`);
}, 'POST');
A('/admin/commandes/:id/livree', (ctx) => { const o = getOrder(ctx); if (o?.status === 'shipped') db.prepare("UPDATE orders SET status='delivered' WHERE id=?").run(o.id); ctx.redirect(`/admin/commandes/${Number(ctx.params.id)}`); }, 'POST');
A('/admin/commandes/:id/annuler', (ctx) => { const o = getOrder(ctx); if (o) { cancelPending(o.id, 'annulée par l’admin'); ctx.flash('ok', 'Commande annulée.'); } ctx.redirect(`/admin/commandes/${Number(ctx.params.id)}`); }, 'POST');
A('/admin/commandes/:id/note', (ctx) => { db.prepare('UPDATE orders SET admin_note=? WHERE id=?').run(ctx.form('note').slice(0, 1000), Number(ctx.params.id)); ctx.flash('ok', 'Note enregistrée.'); ctx.redirect(`/admin/commandes/${Number(ctx.params.id)}`); }, 'POST');
A('/admin/commandes/:id/rembourser', async (ctx) => {
  const o = getOrder(ctx); const back = `/admin/commandes/${Number(ctx.params.id)}`;
  if (!o || !['paid', 'shipped', 'delivered'].includes(o.status) || !o.payment_intent) { ctx.flash('error', 'Remboursement impossible pour cette commande.'); return ctx.redirect(back); }
  try {
    await stripeApi('POST', '/v1/refunds', { payment_intent: o.payment_intent });
    tx(() => {
      db.prepare("UPDATE orders SET status='refunded' WHERE id=?").run(o.id);
      if (ctx.body.restock === '1') for (const i of orderItems(o.id)) if (i.product_id) adjustStock(i.product_id, i.qty, `Commande ${o.number} remboursée (remise en stock)`, o.id);
    });
    ctx.flash('ok', 'Remboursement effectué via Stripe.');
  } catch (e) { console.error(e.message); ctx.flash('error', 'Le remboursement a échoué : ' + e.message); }
  ctx.redirect(back);
}, 'POST');
A('/admin/commandes/:id/imprimer', (ctx) => {
  const o = getOrder(ctx); if (!o) return;
  ctx.html(html`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${o.number}</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/css/style.css"></head><body class="slip">
  <div class="slip-page"><header><b class="slip-brand">${settings().shop_name}</b><span>Bon de préparation — ${o.number}</span></header>
  <section class="slip-addr"><small>Destinataire</small><p><b>${o.first_name} ${o.last_name}</b><br>${o.address1}<br>${o.address2 ? html`${o.address2}<br>` : ''}${o.postal_code} ${o.city}<br>${o.country}${o.phone ? html`<br>Tél : ${o.phone}` : ''}</p></section>
  <table class="table"><thead><tr><th>Quantité</th><th>Article</th></tr></thead><tbody>${orderItems(o.id).map((i) => html`<tr><td>${i.qty}</td><td>${i.name}</td></tr>`)}</tbody></table>
  <p class="muted small">Commande du ${fmtDate(o.created_at)} — Merci pour votre confiance ✨</p>
  <p class="noprint"><button data-print class="btn">Imprimer</button></p></div><script src="/js/admin.js" defer></script></body></html>`);
});

/* ---------- Clientes & messages ---------- */
A('/admin/clients', (ctx) => {
  const us = db.prepare("SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id AND o.status IN ('paid','shipped','delivered')) n, (SELECT COALESCE(SUM(total_cents),0) FROM orders o WHERE o.user_id=u.id AND o.status IN ('paid','shipped','delivered')) t FROM users u WHERE role='customer' ORDER BY created_at DESC LIMIT 300").all();
  const guests = db.prepare("SELECT email, first_name, last_name, COUNT(*) n, SUM(total_cents) t FROM orders WHERE user_id IS NULL AND status IN ('paid','shipped','delivered') GROUP BY email ORDER BY MAX(created_at) DESC LIMIT 300").all();
  adminPage(ctx, '/admin/clients', 'Clientes', html`<h2>Comptes clientes (${us.length})</h2>${us.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Nom</th><th>E-mail</th><th>Inscrite le</th><th class="r">Commandes</th><th class="r">Total</th></tr></thead><tbody>${us.map((u) => html`<tr><td>${u.first_name} ${u.last_name}</td><td>${u.email}</td><td>${fmtDate(u.created_at)}</td><td class="r">${u.n}</td><td class="r">${eur(u.t)}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">Aucun compte pour l’instant.</p>`}
  <h2>Commandes sans compte (invitées)</h2>${guests.length ? html`<div class="table-wrap"><table class="table"><tbody>${guests.map((g) => html`<tr><td>${g.first_name} ${g.last_name}</td><td>${g.email}</td><td class="r">${g.n}</td><td class="r">${eur(g.t)}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">Aucune.</p>`}
  <p class="muted small">Ces coordonnées servent uniquement à traiter les commandes : n’utilisez pas ces e-mails pour de la prospection sans consentement.</p>`);
});
A('/admin/messages', (ctx) => {
  const ms = db.prepare('SELECT * FROM messages ORDER BY handled, created_at DESC LIMIT 100').all();
  adminPage(ctx, '/admin/messages', 'Messages', ms.length ? html`${ms.map((m) => html`<div class="panel ${m.handled ? 'done' : ''}"><p><b>${m.name}</b> · <a class="link" href="mailto:${m.email}?subject=Re: ${m.subject || 'Votre message'}">${m.email}</a> · <small class="muted">${fmtDate(m.created_at)}</small></p>
    ${m.subject ? html`<p><b>${m.subject}</b></p>` : ''}<p>${nl2br(m.body)}</p>
    <form method="post" action="/admin/messages/${m.id}/traite">${csrfIn(ctx)}<button class="btn btn-sm btn-ghost">${m.handled ? 'Marquer non traité' : 'Marquer comme traité'}</button></form></div>`)}` : html`<div class="empty"><p>Aucun message.</p></div>`);
});
A('/admin/messages/:id/traite', (ctx) => { db.prepare('UPDATE messages SET handled=1-handled WHERE id=?').run(Number(ctx.params.id)); ctx.redirect('/admin/messages'); }, 'POST');

/* ---------- Réglages ---------- */
A('/admin/reglages', (ctx) => {
  const s = settings();
  const t = (label, k, extra = '', hint = '') => inp(label, k, s[k], extra, hint);
  adminPage(ctx, '/admin/reglages', 'Réglages', html`<form method="post" action="/admin/reglages" class="form admin-form">${csrfIn(ctx)}
  <div class="panel"><h2>Boutique</h2>${t('Nom de la boutique', 'shop_name', 'required maxlength="60"')}
    <label>Logo <small class="muted">(PNG, JPG, WebP ou SVG — idéalement fond transparent)</small></label>
    <div class="logo-up"><input type="hidden" name="logo" id="logoField" value="${s.logo}"><div id="logoPreview">${s.logo ? html`<img src="${s.logo}" alt="Logo" height="60">` : html`<span class="muted">Aucun logo : le nom de la boutique est affiché en texte.</span>`}</div>
    <label class="file-btn">Choisir mon logo<input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label> <button type="button" class="link-btn" id="logoClear">Retirer</button></div>
    ${t('Bandeau d’annonce (haut du site)', 'announcement', 'maxlength="140"', 'laissez vide pour le masquer')}
    <div class="row2">${t('E-mail de contact *', 'contact_email', 'type="email"', 'reçoit aussi les alertes de nouvelles commandes')}${t('Téléphone (facultatif)', 'phone')}</div>
    <div class="row2">${t('Lien Instagram', 'instagram', 'placeholder="https://instagram.com/…"')}${t('Lien TikTok', 'tiktok', 'placeholder="https://tiktok.com/@…"')}</div></div>
  <div class="panel"><h2>Livraison</h2>
    <div class="row3"><label>Frais de livraison (€)<input name="shipping_flat" value="${fromCents(parseInt(s.shipping_flat_cents, 10) || 0)}" inputmode="decimal"></label>
    <label>Livraison offerte dès (€)<input name="free_shipping" value="${fromCents(parseInt(s.free_shipping_cents, 10) || 0)}" inputmode="decimal"><small class="muted">0 = jamais offerte</small></label>
    ${t('Transporteur habituel', 'carrier_name', 'placeholder="ex : Colissimo"')}</div>
    ${t('Pays livrés (séparés par des virgules)', 'shipping_countries', 'placeholder="France, Belgique"')}
    <div class="row2">${t('Délai de préparation', 'prep_delay', 'placeholder="ex : 1 à 2 jours ouvrés"')}${t('Délai de livraison', 'delivery_delay', 'placeholder="ex : 2 à 4 jours ouvrés"')}</div>
    <div class="row2">${t('Délai de retour (jours)', 'return_days', 'inputmode="numeric"', 'minimum légal : 14')}${t('Adresse de retour', 'return_address')}</div></div>
  <div class="panel"><h2>Informations légales <small class="muted">(pages Mentions légales &amp; CGV)</small></h2>
    <div class="row2">${t('Nom / raison sociale', 'company_name')}${t('Forme juridique', 'legal_form', 'placeholder="ex : Micro-entreprise"')}</div>
    <div class="row2">${t('SIRET', 'siret')}${t('Directrice de la publication', 'publication_director')}</div>
    ${t('Adresse de l’entreprise', 'company_address')}
    <label>Régime de TVA <select name="vat_mode"><option value="franchise" ${s.vat_mode === 'franchise' ? 'selected' : ''}>Franchise en base (TVA non applicable, art. 293 B du CGI)</option><option value="tva" ${s.vat_mode === 'tva' ? 'selected' : ''}>Assujettie à la TVA</option></select></label>
    ${t('N° de TVA intracommunautaire (si assujettie)', 'vat_number')}
    ${t('Hébergeur du site', 'hosting_info', 'placeholder="ex : Render Services, Inc., 525 Brannan Street, San Francisco, CA 94107, USA"')}
    ${t('Médiateur de la consommation', 'mediator', '', 'obligatoire pour la vente aux consommateurs : nom + coordonnées du médiateur auquel vous adhérez')}</div>
  <p class="actions"><button class="btn btn-lg">Enregistrer</button></p></form>
  <div class="panel" id="stripe"><h2>Paiement &amp; e-mails</h2><p class="muted">Ces éléments se règlent chez votre hébergeur (variables d’environnement), pas ici — voir le guide GUIDE.md.</p>
  <ul class="checks"><li class="${stripeEnabled() ? 'ok' : 'ko'}"><span>${stripeEnabled() ? '✓' : '○'}</span> Clé secrète Stripe (STRIPE_SECRET_KEY) ${stripeEnabled() ? (process.env.STRIPE_SECRET_KEY.startsWith('sk_test') ? '— mode TEST' : '— mode réel') : ''}</li>
  <li class="${process.env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'ko'}"><span>${process.env.STRIPE_WEBHOOK_SECRET ? '✓' : '○'}</span> Secret du webhook (STRIPE_WEBHOOK_SECRET)</li>
  <li class="${process.env.RESEND_API_KEY && process.env.MAIL_FROM ? 'ok' : 'ko'}"><span>${process.env.RESEND_API_KEY && process.env.MAIL_FROM ? '✓' : '○'}</span> E-mails (RESEND_API_KEY + MAIL_FROM)</li></ul>
  <p>URL du webhook à déclarer dans Stripe : <code>${siteUrl(ctx)}/stripe/webhook</code></p></div>`);
});
A('/admin/reglages', (ctx) => {
  const g = (k, n = 300) => ctx.form(k).slice(0, n);
  const out = {};
  for (const k of Object.keys(SETTING_DEFAULTS)) if (ctx.body[k] !== undefined) out[k] = g(k);
  out.shop_name = out.shop_name || 'SHAÏ & GLOW';
  out.shipping_flat_cents = String(toCents(ctx.body.shipping_flat)); out.free_shipping_cents = String(toCents(ctx.body.free_shipping));
  out.return_days = String(clampInt(ctx.body.return_days, 14, 365, 14));
  if (out.logo && !/^\/uploads\/[a-z0-9._-]+$/i.test(out.logo)) out.logo = '';
  for (const k of ['instagram', 'tiktok']) if (out[k] && !/^https?:\/\//i.test(out[k])) out[k] = '';
  saveSettings(out);
  ctx.flash('ok', 'Réglages enregistrés.'); ctx.redirect('/admin/reglages');
}, 'POST');

/* ---------- Envoi d'images (le navigateur réduit la photo avant l'envoi) ---------- */
const SIGS = [['jpg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff], ['png', (b) => b.subarray(0, 4).toString('hex') === '89504e47'], ['webp', (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP']];
A('/admin/upload', (ctx) => {
  const m = /^data:([a-z/+.-]+);base64,(.+)$/s.exec(String(ctx.body.data || ''));
  if (!m) return ctx.json({ error: 'Fichier invalide' }, 400);
  const buf = Buffer.from(m[2], 'base64'); let ext = SIGS.find(([, t]) => t(buf))?.[0];
  if (!ext && ctx.body.kind === 'logo' && /^\s*(<\?xml|<svg)/i.test(buf.subarray(0, 200).toString('utf8')) && !/<script|onload=|javascript:/i.test(buf.toString('utf8'))) ext = 'svg';
  if (!ext || buf.length > 6 * 1024 * 1024) return ctx.json({ error: 'Format non pris en charge (JPG, PNG, WebP' + (ctx.body.kind === 'logo' ? ', SVG' : '') + ').' }, 400);
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  ctx.json({ url: `/uploads/${name}` });
}, 'POST', { limit: 9 * 1024 * 1024 });
