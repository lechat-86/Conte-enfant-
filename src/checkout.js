import { db, tx, settings, adjustStock } from './db.js';
import { route, siteUrl, tooMany } from './core.js';
import { html, raw, eur, isEmail, randomToken, fmtDate } from './util.js';
import { layout, csrf, pageHead, icon, productImage } from './views.js';
import { cartInfo } from './cart.js';
import { stripeApi, stripeEnabled, verifyWebhook } from './stripe.js';
import { markPaid, cancelPending, expireStaleOrders, orderItems } from './orders.js';

const countriesOf = () => { const l = settings().shipping_countries.split(',').map((c) => c.trim()).filter(Boolean); return l.length ? l : ['France']; };

function summary(c) {
  return html`<aside class="summary"><h2>Votre commande</h2>
    ${c.lines.map((l) => html`<div class="mini"><div class="mini-img">${productImage(l.p)}<span class="mini-qty">${l.qty}</span></div><div class="mini-info">${l.p.name}<small class="muted">${l.p.size}</small></div><div>${eur(l.total)}</div></div>`)}
    <dl><dt>Sous-total</dt><dd>${eur(c.subtotal)}</dd><dt>Livraison</dt><dd>${c.shipping ? eur(c.shipping) : 'Offerte'}</dd></dl>
    <dl class="total"><dt>Total TTC</dt><dd>${eur(c.total)}</dd></dl>
    <p class="secure">${icon.lock} Paiement sécurisé par Stripe</p></aside>`;
}

function checkoutPage(ctx, c, v = {}) {
  const u = ctx.user || {};
  const val = (k) => v[k] ?? u[k] ?? '';
  const countries = countriesOf();
  const input = (label, name, extra = '') => html`<label>${label}<input name="${name}" value="${val(name)}" ${extra}></label>`;
  return layout(ctx, { title: 'Commande', noindex: true, body: html`${pageHead('Finaliser ma commande')}<section class="wrap section-sm">
    <form method="post" action="/commande" class="checkout">${csrf(ctx)}
      <div class="form">
        <h2>Coordonnées</h2>
        <label>E-mail <input type="email" name="email" required value="${v.email ?? u.email ?? ''}" autocomplete="email"></label>
        <h2>Adresse de livraison</h2>
        <div class="row2">${input('Prénom', 'first_name', 'required autocomplete="given-name"')}${input('Nom', 'last_name', 'required autocomplete="family-name"')}</div>
        ${input('Adresse', 'address1', 'required autocomplete="address-line1"')}${input('Complément d’adresse (facultatif)', 'address2', 'autocomplete="address-line2"')}
        <div class="row2">${input('Code postal', 'postal_code', 'required autocomplete="postal-code"')}${input('Ville', 'city', 'required autocomplete="address-level2"')}</div>
        <label>Pays <select name="country" required>${countries.map((x) => html`<option ${x === (v.country ?? u.country ?? 'France') ? 'selected' : ''}>${x}</option>`)}</select></label>
        ${input('Téléphone (utile pour le transporteur)', 'phone', 'type="tel" autocomplete="tel"')}
        <label class="check"><input type="checkbox" name="cgv" value="1" required> <span>J’ai lu et j’accepte les <a class="link" href="/cgv" target="_blank">conditions générales de vente</a> et la <a class="link" href="/retours" target="_blank">politique de retour</a>.</span></label>
        ${stripeEnabled() ? '' : html`<p class="notice">Le paiement en ligne n’est pas encore activé sur cette boutique.</p>`}
        <button class="btn btn-lg btn-block" ${stripeEnabled() ? '' : 'disabled'}>Payer ${eur(c.total)}</button>
        <p class="muted center">Vous serez redirigée vers la page de paiement sécurisée Stripe.</p>
      </div>
      ${summary(c)}
    </form></section>` });
}

route('GET', '/commande', (ctx) => {
  const c = cartInfo(ctx); c.notices.forEach((m) => ctx.flash('warn', m));
  if (!c.lines.length) return ctx.redirect('/panier');
  ctx.html(checkoutPage(ctx, c));
});

route('POST', '/commande', async (ctx) => {
  const c = cartInfo(ctx); c.notices.forEach((m) => ctx.flash('warn', m));
  if (!c.lines.length) return ctx.redirect('/panier');
  const f = (k, n = 120) => ctx.form(k).slice(0, n);
  const v = { email: f('email', 160).toLowerCase(), first_name: f('first_name', 60), last_name: f('last_name', 60), phone: f('phone', 30), address1: f('address1'), address2: f('address2'), postal_code: f('postal_code', 12), city: f('city', 80), country: f('country', 60) };
  const fail = (msg, status = 400) => { ctx.flash('error', msg); return ctx.html(checkoutPage(ctx, c, v), status); };
  if (tooMany(ctx, 'checkout', 15)) return fail('Trop de tentatives. Réessayez dans quelques minutes.', 429);
  if (!isEmail(v.email) || !v.first_name || !v.last_name || !v.address1 || !v.postal_code || !v.city) return fail('Merci de compléter tous les champs obligatoires.');
  if (!countriesOf().includes(v.country)) return fail('Nous ne livrons pas dans ce pays.');
  if (ctx.body.cgv !== '1') return fail('Merci d’accepter les conditions générales de vente.');
  if (!stripeEnabled()) return fail('Le paiement en ligne n’est pas encore activé.', 503);

  expireStaleOrders();
  let order;
  try {
    order = tx(() => {
      const items = [];
      for (const l of c.lines) { // réservation atomique du stock
        const r = db.prepare('UPDATE products SET stock=stock-?, updated_at=? WHERE id=? AND stock>=? AND active=1 AND deleted=0').run(l.qty, Date.now(), l.p.id, l.qty);
        if (r.changes !== 1) throw Object.assign(new Error('stock'), { stock: l.p.name });
        items.push(l);
      }
      const token = randomToken(16);
      const r = db.prepare(`INSERT INTO orders(token,user_id,email,first_name,last_name,phone,address1,address2,postal_code,city,country,subtotal_cents,shipping_cents,total_cents,status,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?)`).run(token, ctx.user?.id ?? null, v.email, v.first_name, v.last_name, v.phone, v.address1, v.address2, v.postal_code, v.city, v.country, c.subtotal, c.shipping, c.total, Date.now());
      const id = Number(r.lastInsertRowid); const number = `SG-${String(id).padStart(5, '0')}`;
      db.prepare('UPDATE orders SET number=? WHERE id=?').run(number, id);
      for (const l of items) {
        db.prepare('INSERT INTO order_items(order_id,product_id,name,unit_cents,cost_cents,qty) VALUES(?,?,?,?,?,?)').run(id, l.p.id, `${l.p.brand ? l.p.brand + ' ' : ''}${l.p.name}${l.p.size ? ' ' + l.p.size : ''}`, l.p.price_cents, l.p.cost_cents, l.qty);
        const bal = db.prepare('SELECT stock FROM products WHERE id=?').get(l.p.id).stock;
        db.prepare('INSERT INTO stock_moves(product_id,delta,balance,reason,order_id,created_at) VALUES(?,?,?,?,?,?)').run(l.p.id, -l.qty, bal, `Commande ${number} (réservation)`, id, Date.now());
      }
      return { id, number, token };
    });
  } catch (e) {
    if (e.stock) return fail(`« ${e.stock} » n’est plus disponible en quantité suffisante. Votre panier a été mis à jour.`, 409);
    throw e;
  }

  try {
    const base = siteUrl(ctx); const items = orderItems(order.id);
    const session = await stripeApi('POST', '/v1/checkout/sessions', {
      mode: 'payment', locale: 'fr', client_reference_id: order.number, customer_email: v.email,
      success_url: `${base}/commande/confirmation?s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/commande/annulee?o=${order.number}&t=${order.token}`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      metadata: { order_number: order.number },
      payment_intent_data: { description: `Commande ${order.number}`, metadata: { order_number: order.number } },
      line_items: [
        ...items.map((i) => ({ quantity: i.qty, price_data: { currency: 'eur', unit_amount: i.unit_cents, product_data: { name: i.name } } })),
        ...(c.shipping ? [{ quantity: 1, price_data: { currency: 'eur', unit_amount: c.shipping, product_data: { name: 'Livraison' } } }] : []),
      ],
    });
    db.prepare('UPDATE orders SET stripe_session_id=? WHERE id=?').run(session.id, order.id);
    ctx.redirect(session.url);
  } catch (e) {
    console.error('Création de session Stripe impossible :', e.message);
    cancelPending(order.id, 'erreur de paiement');
    return fail('Le paiement n’a pas pu être lancé. Merci de réessayer dans un instant.', 502);
  }
});

route('GET', '/commande/annulee', (ctx) => {
  const o = db.prepare("SELECT * FROM orders WHERE number=? AND token=? AND status='pending'").get(String(ctx.query.o || ''), String(ctx.query.t || ''));
  if (o) cancelPending(o.id, 'abandon par la cliente');
  ctx.flash('warn', 'Paiement annulé : votre panier est conservé.'); ctx.redirect('/panier');
});

route('GET', '/commande/confirmation', async (ctx) => {
  const sid = String(ctx.query.s || '');
  let o = sid && db.prepare('SELECT * FROM orders WHERE stripe_session_id=?').get(sid);
  if (!o) return;
  if (o.status === 'pending' || o.status === 'cancelled') {
    try {
      const s = await stripeApi('GET', `/v1/checkout/sessions/${encodeURIComponent(sid)}`);
      if (s.payment_status === 'paid') o = markPaid(o.id, typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id, siteUrl(ctx)) || db.prepare('SELECT * FROM orders WHERE id=?').get(o.id);
    } catch (e) { console.error('Vérification Stripe :', e.message); }
  }
  const paid = ['paid', 'shipped', 'delivered'].includes(o.status);
  if (paid && ctx.session.cart && Object.keys(ctx.session.cart).length) { ctx.session.cart = {}; ctx.touch(); }
  ctx.html(layout(ctx, { title: 'Confirmation', noindex: true, body: html`<section class="wrap narrow center section">
    ${paid ? html`<p class="eyebrow">Merci ${o.first_name}</p><h1>Commande confirmée ✨</h1>
      <p class="lead-dark">Votre commande <b>${o.number}</b> est bien enregistrée. Un e-mail de confirmation est envoyé à <b>${o.email}</b>.</p>
      <div class="table-wrap left"><table class="table"><tbody>${orderItems(o.id).map((i) => html`<tr><td>${i.qty} × ${i.name}</td><td class="r">${eur(i.unit_cents * i.qty)}</td></tr>`)}
        <tr><td>Livraison</td><td class="r">${o.shipping_cents ? eur(o.shipping_cents) : 'Offerte'}</td></tr><tr><th>Total</th><th class="r">${eur(o.total_cents)}</th></tr></tbody></table></div>
      <p class="muted">Nous préparons votre colis avec soin. Vous recevrez un e-mail à l’expédition.</p>`
      : html`<h1>Paiement en cours de vérification</h1><p class="lead-dark">Nous n’avons pas encore reçu la confirmation de votre paiement pour la commande <b>${o.number}</b>. Cela peut prendre quelques instants : un e-mail vous sera envoyé dès validation.</p><p class="muted">Si vous ne recevez rien, <a class="link" href="/contact">contactez-nous</a> en indiquant ce numéro.</p>`}
    <p><a class="btn" href="/boutique">Continuer mes achats</a></p></section>` }));
});

route('POST', '/stripe/webhook', (ctx) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return ctx.text('webhook non configuré', 503);
  if (!verifyWebhook(ctx.rawBody, ctx.req.headers['stripe-signature'], secret)) return ctx.text('signature invalide', 400);
  let ev; try { ev = JSON.parse(ctx.rawBody.toString('utf8')); } catch { return ctx.text('json invalide', 400); }
  const obj = ev.data?.object || {};
  const byNumber = (n) => n && db.prepare('SELECT * FROM orders WHERE number=?').get(String(n));
  switch (ev.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const o = byNumber(obj.client_reference_id || obj.metadata?.order_number);
      if (o && obj.payment_status === 'paid') markPaid(o.id, typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id, siteUrl(ctx));
      break;
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      const o = byNumber(obj.client_reference_id || obj.metadata?.order_number);
      if (o) cancelPending(o.id, 'paiement expiré ou refusé');
      break;
    }
    case 'charge.refunded': {
      if (obj.refunded && obj.payment_intent) db.prepare("UPDATE orders SET status='refunded' WHERE payment_intent=? AND status IN ('paid','shipped','delivered')").run(obj.payment_intent);
      break;
    }
  }
  ctx.json({ received: true });
}, { noCsrf: true, limit: 1024 * 1024 });
