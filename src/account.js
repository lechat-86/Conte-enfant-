import { db } from './db.js';
import { route, login, logout, siteUrl, tooMany } from './core.js';
import { html, eur, fmtDate, isEmail, hashPassword, verifyPassword, randomToken, sha256 } from './util.js';
import { layout, csrf, pageHead } from './views.js';
import { STATUS, orderItems } from './orders.js';
import { mailReset } from './mail.js';
import { settings } from './db.js';

const safeNext = (n) => (typeof n === 'string' && /^\/(?!\/)[^\s\\]*$/.test(n) ? n : '');
const DUMMY = hashPassword('dummy-password');
const field = (label, name, v = '', extra = '') => html`<label>${label}<input name="${name}" value="${v}" ${extra}></label>`;
const statusPill = (s) => html`<span class="pill ${STATUS[s]?.[1]}">${STATUS[s]?.[0] || s}</span>`;

function authPage(ctx, { title, sub, form }) {
  return layout(ctx, { title, noindex: true, body: html`${pageHead(title, sub)}<section class="wrap narrow section-sm">${form}</section>` });
}
const loginForm = (ctx, next = '', email = '') => html`<form method="post" action="/compte/connexion" class="form">${csrf(ctx)}<input type="hidden" name="next" value="${next}">
  <label>E-mail <input type="email" name="email" required autocomplete="email" value="${email}"></label>
  <label>Mot de passe <input type="password" name="password" required autocomplete="current-password"></label>
  <button class="btn btn-lg">Me connecter</button>
  <p class="center"><a class="link" href="/compte/mot-de-passe-oublie">Mot de passe oublié ?</a></p>
  <p class="center muted">Pas encore de compte ? <a class="link" href="/compte/inscription">Créer mon compte</a></p></form>`;

route('GET', '/compte/connexion', (ctx) => {
  if (ctx.user) return ctx.redirect(ctx.user.role === 'admin' ? '/admin' : '/compte');
  ctx.html(authPage(ctx, { title: 'Connexion', sub: 'Retrouvez vos commandes et vos informations.', form: loginForm(ctx, safeNext(ctx.query.next)) }));
});
route('POST', '/compte/connexion', (ctx) => {
  const email = ctx.form('email').toLowerCase(); const next = safeNext(ctx.form('next'));
  if (tooMany(ctx, 'login', 10)) { ctx.flash('error', 'Trop de tentatives. Réessayez dans quelques minutes.'); return ctx.redirect('/compte/connexion'); }
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  const ok = verifyPassword(ctx.body.password || '', u ? u.password_hash : DUMMY) && u;
  if (!ok) { ctx.flash('error', 'E-mail ou mot de passe incorrect.'); return ctx.html(authPage(ctx, { title: 'Connexion', form: loginForm(ctx, next, email) }), 401); }
  login(ctx, u);
  ctx.redirect(next || (u.role === 'admin' ? '/admin' : '/compte'));
});
route('POST', '/compte/deconnexion', (ctx) => { logout(ctx); ctx.flash('ok', 'Vous êtes déconnectée.'); ctx.redirect('/'); });

const registerForm = (ctx, v = {}) => html`<form method="post" action="/compte/inscription" class="form">${csrf(ctx)}
  <div class="row2">${field('Prénom', 'first_name', v.first_name, 'required autocomplete="given-name"')}${field('Nom', 'last_name', v.last_name, 'required autocomplete="family-name"')}</div>
  <label>E-mail <input type="email" name="email" required autocomplete="email" value="${v.email || ''}"></label>
  <label>Mot de passe <small class="muted">(8 caractères minimum)</small><input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
  <button class="btn btn-lg">Créer mon compte</button>
  <p class="center muted">Déjà inscrite ? <a class="link" href="/compte/connexion">Se connecter</a></p></form>`;
route('GET', '/compte/inscription', (ctx) => ctx.user ? ctx.redirect('/compte') : ctx.html(authPage(ctx, { title: 'Créer mon compte', form: registerForm(ctx) })));
route('POST', '/compte/inscription', (ctx) => {
  const v = { first_name: ctx.form('first_name').slice(0, 60), last_name: ctx.form('last_name').slice(0, 60), email: ctx.form('email').toLowerCase() };
  const pw = String(ctx.body.password || '');
  const err = tooMany(ctx, 'register', 8) ? 'Trop de tentatives. Réessayez plus tard.' : !v.first_name || !v.last_name ? 'Merci d’indiquer votre prénom et votre nom.' : !isEmail(v.email) ? 'E-mail invalide.' : pw.length < 8 || pw.length > 200 ? 'Le mot de passe doit contenir au moins 8 caractères.' : db.prepare('SELECT 1 FROM users WHERE email=?').get(v.email) ? 'Un compte existe déjà avec cet e-mail. Connectez-vous.' : '';
  if (err) { ctx.flash('error', err); return ctx.html(authPage(ctx, { title: 'Créer mon compte', form: registerForm(ctx, v) }), 400); }
  const r = db.prepare("INSERT INTO users(email,password_hash,role,first_name,last_name,created_at) VALUES(?,?, 'customer', ?,?,?)").run(v.email, hashPassword(pw), v.first_name, v.last_name, Date.now());
  login(ctx, db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid));
  ctx.flash('ok', 'Bienvenue ! Votre compte a été créé.'); ctx.redirect('/compte');
});

/* Mot de passe oublié */
route('GET', '/compte/mot-de-passe-oublie', (ctx) => ctx.html(authPage(ctx, { title: 'Mot de passe oublié', sub: 'Nous vous envoyons un lien de réinitialisation.', form: html`<form method="post" class="form">${csrf(ctx)}<label>E-mail <input type="email" name="email" required></label><button class="btn btn-lg">Envoyer le lien</button></form>` })));
route('POST', '/compte/mot-de-passe-oublie', (ctx) => {
  if (!tooMany(ctx, 'reset', 5)) {
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(ctx.form('email').toLowerCase());
    if (u) {
      const t = randomToken(32);
      db.prepare('UPDATE users SET reset_token=?, reset_expires=? WHERE id=?').run(sha256(t), Date.now() + 3600e3, u.id);
      const link = `${siteUrl(ctx)}/compte/reinitialiser?token=${t}`;
      mailReset(u, link);
      if (!process.env.RESEND_API_KEY) console.log(`[réinitialisation mot de passe] ${u.email} → ${link}`);
    }
  }
  ctx.flash('ok', 'Si un compte existe avec cet e-mail, un lien de réinitialisation vient d’être envoyé.'); ctx.redirect('/compte/connexion');
});
const resetUser = (t) => t && db.prepare('SELECT * FROM users WHERE reset_token=? AND reset_expires>?').get(sha256(String(t)), Date.now());
route('GET', '/compte/reinitialiser', (ctx) => {
  if (!resetUser(ctx.query.token)) { ctx.flash('error', 'Ce lien est invalide ou expiré.'); return ctx.redirect('/compte/mot-de-passe-oublie'); }
  ctx.html(authPage(ctx, { title: 'Nouveau mot de passe', form: html`<form method="post" class="form">${csrf(ctx)}<input type="hidden" name="token" value="${ctx.query.token}"><label>Nouveau mot de passe<input type="password" name="password" minlength="8" required autocomplete="new-password"></label><button class="btn btn-lg">Enregistrer</button></form>` }));
});
route('POST', '/compte/reinitialiser', (ctx) => {
  const u = resetUser(ctx.body.token); const pw = String(ctx.body.password || '');
  if (!u || pw.length < 8) { ctx.flash('error', 'Lien invalide ou mot de passe trop court (8 caractères minimum).'); return ctx.redirect('/compte/mot-de-passe-oublie'); }
  db.prepare('UPDATE users SET password_hash=?, reset_token=NULL, reset_expires=NULL WHERE id=?').run(hashPassword(pw), u.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
  ctx.flash('ok', 'Mot de passe modifié. Vous pouvez vous connecter.'); ctx.redirect('/compte/connexion');
});

/* Espace client */
const needUser = (ctx) => { if (ctx.user) return true; ctx.redirect('/compte/connexion?next=' + encodeURIComponent(ctx.path)); return false; };
route('GET', '/compte', (ctx) => {
  if (!needUser(ctx)) return; const u = ctx.user; const s = settings();
  const orders = db.prepare("SELECT * FROM orders WHERE user_id=? AND status<>'pending' ORDER BY created_at DESC").all(u.id);
  const countries = s.shipping_countries.split(',').map((c) => c.trim()).filter(Boolean);
  ctx.html(layout(ctx, { title: 'Mon compte', noindex: true, body: html`${pageHead('Mon compte', `Bonjour ${u.first_name || u.email}`)}
  <section class="wrap section-sm account">
    <div><h2>Mes commandes</h2>
      ${orders.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Date</th><th>Statut</th><th class="r">Total</th></tr></thead><tbody>
        ${orders.map((o) => html`<tr><td><a class="link" href="/compte/commande/${o.number}">${o.number}</a></td><td>${fmtDate(o.created_at)}</td><td>${statusPill(o.status)}</td><td class="r">${eur(o.total_cents)}</td></tr>`)}</tbody></table></div>`
        : html`<p class="muted">Vous n’avez pas encore passé de commande.</p><p><a class="btn" href="/boutique">Découvrir la boutique</a></p>`}</div>
    <div><h2>Mes informations</h2>
      <form method="post" action="/compte/profil" class="form">${csrf(ctx)}
        <div class="row2">${field('Prénom', 'first_name', u.first_name)}${field('Nom', 'last_name', u.last_name)}</div>
        ${field('Téléphone', 'phone', u.phone, 'autocomplete="tel"')}${field('Adresse', 'address1', u.address1, 'autocomplete="address-line1"')}${field('Complément', 'address2', u.address2)}
        <div class="row2">${field('Code postal', 'postal_code', u.postal_code, 'autocomplete="postal-code"')}${field('Ville', 'city', u.city, 'autocomplete="address-level2"')}</div>
        <label>Pays <select name="country">${(countries.length ? countries : ['France']).map((c) => html`<option ${c === u.country ? 'selected' : ''}>${c}</option>`)}</select></label>
        <p class="muted">E-mail : ${u.email}</p><button class="btn">Enregistrer</button></form>
      <h2 class="mt">Changer de mot de passe</h2>
      <form method="post" action="/compte/mot-de-passe" class="form">${csrf(ctx)}
        <label>Mot de passe actuel<input type="password" name="current" required autocomplete="current-password"></label>
        <label>Nouveau mot de passe<input type="password" name="password" minlength="8" required autocomplete="new-password"></label><button class="btn btn-ghost">Modifier</button></form>
      <form method="post" action="/compte/deconnexion" class="mt">${csrf(ctx)}<button class="btn btn-ghost">Me déconnecter</button></form></div>
  </section>` }));
});
route('POST', '/compte/profil', (ctx) => {
  if (!needUser(ctx)) return;
  const f = (k, n = 120) => ctx.form(k).slice(0, n);
  db.prepare('UPDATE users SET first_name=?,last_name=?,phone=?,address1=?,address2=?,postal_code=?,city=?,country=? WHERE id=?')
    .run(f('first_name', 60), f('last_name', 60), f('phone', 30), f('address1'), f('address2'), f('postal_code', 12), f('city', 80), f('country', 60) || 'France', ctx.user.id);
  ctx.flash('ok', 'Vos informations ont été enregistrées.'); ctx.redirect('/compte');
});
route('POST', '/compte/mot-de-passe', (ctx) => {
  if (!needUser(ctx)) return;
  const pw = String(ctx.body.password || '');
  if (!verifyPassword(ctx.body.current || '', ctx.user.password_hash)) ctx.flash('error', 'Mot de passe actuel incorrect.');
  else if (pw.length < 8) ctx.flash('error', 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
  else { db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(pw), ctx.user.id); ctx.flash('ok', 'Mot de passe modifié.'); }
  ctx.redirect('/compte');
});
route('GET', '/compte/commande/:number', (ctx) => {
  if (!needUser(ctx)) return;
  const o = db.prepare('SELECT * FROM orders WHERE number=? AND user_id=?').get(ctx.params.number, ctx.user.id);
  if (!o) return;
  ctx.html(layout(ctx, { title: `Commande ${o.number}`, noindex: true, body: html`${pageHead(`Commande ${o.number}`, fmtDate(o.created_at))}<section class="wrap narrow section-sm">
    <p>${statusPill(o.status)}</p>
    ${o.tracking ? html`<p>Suivi : <b>${o.carrier} ${o.tracking}</b></p>` : ''}
    <div class="table-wrap"><table class="table"><tbody>${orderItems(o.id).map((i) => html`<tr><td>${i.qty} × ${i.name}</td><td class="r">${eur(i.unit_cents * i.qty)}</td></tr>`)}
      <tr><td>Livraison</td><td class="r">${o.shipping_cents ? eur(o.shipping_cents) : 'Offerte'}</td></tr><tr><th>Total</th><th class="r">${eur(o.total_cents)}</th></tr></tbody></table></div>
    <p class="muted">Livraison : ${o.first_name} ${o.last_name}, ${o.address1}${o.address2 ? ', ' + o.address2 : ''}, ${o.postal_code} ${o.city}, ${o.country}</p>
    <p><a class="link" href="/compte">← Retour à mon compte</a></p></section>` }));
});
