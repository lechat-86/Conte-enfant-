// Test de bout en bout : démarre un faux Stripe + la boutique sur une base temporaire.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-'));
const SHOP = 3917, STRIPE = 3918, SECRET = 'whsec_test';
const sessions = {};
const stripe = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
      const p = new URLSearchParams(b); const id = 'cs_test_' + crypto.randomBytes(6).toString('hex');
      sessions[id] = { id, url: `http://stripe.test/pay/${id}`, payment_status: 'unpaid', client_reference_id: p.get('client_reference_id'), params: p };
      return res.end(JSON.stringify(sessions[id]));
    }
    if (req.method === 'GET' && req.url.startsWith('/v1/checkout/sessions/')) return res.end(JSON.stringify(sessions[req.url.split('/').pop()] || {}));
    if (req.method === 'POST' && req.url === '/v1/refunds') return res.end('{"id":"re_1"}');
    res.statusCode = 404; res.end('{}');
  });
}).listen(STRIPE);

const child = spawn('node', ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: SHOP, DATA_DIR: tmp, ADMIN_EMAIL: 'owner@test.fr', ADMIN_PASSWORD: 'motdepasse-test', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_API_BASE: `http://localhost:${STRIPE}`, SITE_URL: `http://localhost:${SHOP}` }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => child.stdout.on('data', (d) => String(d).includes('prêt') && r()));

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, form, headers = {}) {
    const r = await fetch(`http://localhost:${SHOP}${url}`, { method, redirect: 'manual', headers: { cookie: this.cookie, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...headers }, body: form ? new URLSearchParams(form).toString() : undefined });
    const sc = r.headers.getSetCookie?.() || []; if (sc.length) this.cookie = sc.map((c) => c.split(';')[0]).join('; ');
    const text = await r.text(); return { status: r.status, text, loc: r.headers.get('location'), headers: r.headers };
  }
  async csrf(url = '/boutique') { const r = await this.req('GET', url); return /name="_csrf" value="([^"]+)"/.exec(r.text)?.[1] || /name="csrf" content="([^"]+)"/.exec(r.text)?.[1]; }
}
const ok = (n) => console.log('  ✓', n);
let failed = false;
try {
  const c = new Client();
  for (const u of ['/', '/boutique', '/coups-de-coeur', '/categorie/parfums', '/categorie/brumes', '/categorie/parfums-de-maison', '/categorie/maquillage', '/recherche?q=prady', '/panier', '/contact', '/cgv', '/mentions-legales', '/livraison', '/retours', '/faq', '/confidentialite', '/a-propos', '/sitemap.xml', '/robots.txt', '/compte/connexion', '/css/style.css', '/favicon.svg'])
    assert.equal((await c.req('GET', u)).status, 200, u);
  ok('pages publiques (200)');
  assert.match((await c.req('GET', '/')).text, /Nos coups de cœur/); assert.match((await c.req('GET', '/coups-de-coeur')).text, /Monoï Tiaré/); assert.doesNotMatch((await c.req('GET', '/')).text, /Nouveaut|Créations/); ok('rubrique Nos coups de cœur (sans Nouveautés ni Créations)');
  const home = (await c.req('GET', '/')).text;
  for (const n of ['Parfums', 'Brumes', 'Parfums de maison', 'Maquillage']) assert.match(home, new RegExp('class="cat-name">' + n + '<'));
  assert.doesNotMatch(home, /Soins (visage|corps)/); assert.equal((await c.req('GET', '/categorie/soins-visage')).status, 404); ok('4 catégories officielles, plus de Soins visage / corps');
  assert.equal((await c.req('GET', '/page-inconnue')).status, 404); ok('404');
  assert.equal((await c.req('GET', '/admin')).status, 303); ok('admin protégé');
  assert.equal((await c.req('GET', '/uploads/../shop.db')).status, 404); assert.equal((await c.req('GET', '/..%2fsrc/db.js')).status, 404); ok('pas de traversée de dossier');
  const prod = await c.req('GET', '/produit/brume-corps-et-cheveux-prady-monoi-tiare-250-ml');
  assert.equal(prod.status, 200); assert.match(prod.text, /4,90/); ok('fiche produit (4,90 €)');

  // POST sans CSRF refusé
  assert.equal((await c.req('POST', '/panier/ajouter', { product_id: 1, qty: 1 })).status, 403); ok('CSRF refusé');
  // Panier
  let t = await c.csrf('/produit/brume-corps-et-cheveux-prady-monoi-tiare-250-ml');
  await c.req('POST', '/panier/ajouter', { _csrf: t, product_id: 1, qty: 3, back: '/panier', go: 'cart' });
  let cart = await c.req('GET', '/panier'); assert.match(cart.text, /14,70/); assert.match(cart.text, /Livraison/); ok('panier : 3 × 4,90 = 14,70 €');
  await c.req('POST', '/panier/ajouter', { _csrf: t, product_id: 1, qty: 50 });
  cart = await c.req('GET', '/panier'); assert.match(cart.text, /value="12"/); ok('quantité limitée au stock (12)');
  await c.req('POST', '/panier/modifier', { _csrf: t, product_id: 1, qty: 2 });

  // Commande + paiement
  t = await c.csrf('/commande');
  const bad = await c.req('POST', '/commande', { _csrf: t, email: 'x' }); assert.equal(bad.status, 400); ok('validation du formulaire');
  const co = await c.req('POST', '/commande', { _csrf: t, email: 'cliente@test.fr', first_name: 'Jeanne', last_name: 'Test', address1: '1 rue des Lilas', postal_code: '75001', city: 'Paris', country: 'France', cgv: '1' });
  assert.equal(co.status, 303); assert.match(co.loc, /stripe\.test\/pay\/cs_test_/); ok('redirection vers le paiement Stripe');
  const sid = co.loc.split('/').pop(); const sp = sessions[sid].params;
  assert.equal(sp.get('line_items[0][price_data][unit_amount]'), '490'); assert.equal(sp.get('line_items[0][quantity]'), '2'); assert.equal(sp.get('line_items[1][price_data][unit_amount]'), '490'); ok('montants envoyés à Stripe corrects (prix serveur)');

  const admin = new Client(); const lt = await admin.csrf('/compte/connexion');
  const lg = await admin.req('POST', '/compte/connexion', { _csrf: lt, email: 'owner@test.fr', password: 'motdepasse-test' }); assert.equal(lg.loc, '/admin'); ok('connexion admin');
  let stocks = await admin.req('GET', '/admin/stocks'); assert.match(stocks.text, /<b class="warn">10<\/b>|>10</); ok('stock réservé : 12 → 10');

  // Webhook : signature invalide puis valide
  const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: sid, client_reference_id: sessions[sid].client_reference_id, payment_status: 'paid', payment_intent: 'pi_123' } } });
  const sign = (ts) => `t=${ts},v1=${crypto.createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex')}`;
  const wb = (sig) => fetch(`http://localhost:${SHOP}/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': sig, 'content-type': 'application/json' }, body });
  assert.equal((await wb('t=1,v1=abc')).status, 400); assert.equal((await wb(sign(Math.floor(Date.now() / 1000) - 4000))).status, 400); ok('webhook : signature invalide refusée');
  assert.equal((await wb(sign(Math.floor(Date.now() / 1000)))).status, 200); assert.equal((await wb(sign(Math.floor(Date.now() / 1000)))).status, 200); ok('webhook : paiement validé (idempotent)');
  const orders = await admin.req('GET', '/admin/commandes?statut=paid'); assert.match(orders.text, /SG-00001/);
  const dash = await admin.req('GET', '/admin'); assert.match(dash.text, /À préparer/); ok('commande visible dans l’admin');

  sessions[sid].payment_status = 'paid';
  const conf = await c.req('GET', `/commande/confirmation?s=${sid}`); assert.match(conf.text, /Commande confirmée/); ok('page de confirmation');
  assert.doesNotMatch((await c.req('GET', '/panier')).text, /class="line"/); ok('panier vidé après paiement');

  // Expédition
  const dt = await admin.csrf('/admin/commandes/1');
  const sh = await admin.req('POST', '/admin/commandes/1/expedier', { _csrf: dt, carrier: 'Colissimo', tracking: 'AB123' }); assert.equal(sh.status, 303);
  assert.match((await admin.req('GET', '/admin/commandes/1')).text, /Expédiée/); ok('expédition + suivi');
  assert.equal((await admin.req('GET', '/admin/commandes/1/imprimer')).status, 200); ok('bon de préparation');

  // Produits & stocks
  const np = await admin.req('POST', '/admin/produits/enregistrer', { _csrf: dt, name: 'Gloss Test', brand: 'Marque', category_id: 4, price: '7,50', cost: '2,10', stock: 5, low_stock: 2, active: '1', images: '[]' }); assert.equal(np.status, 303);
  assert.match((await c.req('GET', '/categorie/maquillage')).text, /Gloss Test/); ok('ajout d’un produit visible en boutique');
  await admin.req('POST', '/admin/stocks/ajuster', { _csrf: dt, product_id: 2, delta: '+10', reason: 'Réception fournisseur' });
  assert.match((await admin.req('GET', '/admin/stocks')).text, />15</); ok('ajustement de stock');
  await admin.req('POST', '/admin/produits/2/supprimer', { _csrf: dt });
  assert.doesNotMatch((await c.req('GET', '/categorie/maquillage')).text, /Gloss Test/); ok('suppression de produit');
  const up = await admin.req('POST', '/admin/upload', null, { 'content-type': 'application/json', 'x-csrf-token': dt }); assert.equal(up.status, 400);
  const ups = await fetch(`http://localhost:${SHOP}/admin/upload`, { method: 'POST', headers: { cookie: admin.cookie, 'content-type': 'application/json', 'x-csrf-token': dt }, body: JSON.stringify({ kind: 'product', data: 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64') }) });
  const uj = await ups.json(); assert.match(uj.url, /^\/uploads\/.+\.jpg$/); assert.equal((await c.req('GET', uj.url)).status, 200); ok('envoi de photo');
  const bad2 = await fetch(`http://localhost:${SHOP}/admin/upload`, { method: 'POST', headers: { cookie: admin.cookie, 'content-type': 'application/json', 'x-csrf-token': dt }, body: JSON.stringify({ kind: 'product', data: 'data:text/html;base64,' + Buffer.from('<script>1</script>').toString('base64') }) }); assert.equal(bad2.status, 400); ok('fichier non image refusé');

  // Compte client
  const cu = new Client(); const rt = await cu.csrf('/compte/inscription');
  const reg = await cu.req('POST', '/compte/inscription', { _csrf: rt, first_name: 'Léa', last_name: 'Martin', email: 'lea@test.fr', password: 'azertyuiop' }); assert.equal(reg.loc, '/compte');
  assert.match((await cu.req('GET', '/compte')).text, /Bonjour Léa/); assert.equal((await cu.req('GET', '/admin')).status, 403); ok('compte client (et pas d’accès admin)');
  console.log('\nTous les tests passent ✔');
} catch (e) { failed = true; console.error('\n✗ ÉCHEC :', e.message); console.error(e.stack.split('\n').slice(1, 4).join('\n')); }
child.kill(); stripe.close(); fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
