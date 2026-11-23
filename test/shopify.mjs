// Test du MODE SHOPIFY contre un SIMULATEUR de la Storefront API (aucune boutique Shopify réelle n'est contactée).
// Les noms de champs suivent la Storefront API ; à valider ensuite sur une vraie boutique de développement.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startSimulator } from './shopify-simulator.mjs';
import assert from 'node:assert/strict';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-shop-'));
const SHOP = 3927, MOCK = 3928;
const sim = startSimulator(MOCK);


const child = spawn('node', ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: SHOP, DATA_DIR: tmp, ADMIN_EMAIL: 'o@test.fr', ADMIN_PASSWORD: 'motdepasse-test', SITE_URL: `http://localhost:${SHOP}`, SHOPIFY_STORE_DOMAIN: 'mock-shop.myshopify.com', SHOPIFY_STOREFRONT_TOKEN: 'tok_test', SHOPIFY_API_BASE: `http://localhost:${MOCK}`, SHOPIFY_CACHE_SECONDS: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => child.stdout.on('data', (d) => String(d).includes('prêt') && r()));
const jar = { cookie: '' };
const req = async (method, url, form) => {
  const r = await fetch(`http://localhost:${SHOP}${url}`, { method, redirect: 'manual', headers: { cookie: jar.cookie, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) }, body: form ? new URLSearchParams(form).toString() : undefined });
  const sc = r.headers.getSetCookie?.() || []; if (sc.length) jar.cookie = sc.map((c) => c.split(';')[0]).join('; ');
  return { status: r.status, text: await r.text(), loc: r.headers.get('location') };
};
const ok = (n) => console.log('  ✓', n); let failed = false;
try {
  const home = await req('GET', '/'); assert.equal(home.status, 200);
  assert.match(home.text, /Brume corps et cheveux Monoï Tiaré/); assert.match(home.text, /Nos coups de cœur/); ok('accueil alimenté par Shopify (même design)');
  assert.doesNotMatch(home.text, /\/compte\/connexion/); assert.match(home.text, /Paiement sécurisé par Shopify/); ok('aucun compte cliente proposé ; mention Shopify');
  const cat = async (s) => (await req('GET', `/categorie/${s}`)).text;
  assert.match(await cat('brumes'), /Monoï Tiaré/); assert.doesNotMatch(await cat('brumes'), /TEST maquillage/); assert.match(await cat('maquillage'), /TEST maquillage/); ok('catégories = collections Shopify');
  const hearts = (await req('GET', '/coups-de-coeur')).text; assert.match(hearts, /Monoï Tiaré/); assert.doesNotMatch(hearts, /TEST maquillage/); ok('coups de cœur = collection « coups-de-coeur »');
  assert.match((await req('GET', '/recherche?q=prady')).text, /Monoï Tiaré/); ok('recherche');
  const mk = (await req('GET', '/produit/produit-test-maquillage')).text; assert.match(mk, /<select name="product_id">/); assert.match(mk, /Corail \(épuisé\)/); ok('variantes (teintes) avec choix et rupture');
  assert.match((await req('GET', '/produit/produit-test-epuise')).text, /Actuellement épuisé/); ok('produit épuisé');
  assert.match((await req('GET', '/sitemap.xml')).text, /produit-test-maquillage/); ok('sitemap');

  const csrf = /name="_csrf" value="([^"]+)"/.exec((await req('GET', '/produit/produit-test-maquillage')).text)[1];
  await req('POST', '/panier/ajouter', { _csrf: csrf, product_id: 'gid://shopify/ProductVariant/22', qty: 2, back: '/panier' });
  await req('POST', '/panier/ajouter', { _csrf: csrf, product_id: 'gid://shopify/ProductVariant/11', qty: 1, go: 'cart' });
  let cart = (await req('GET', '/panier')).text; assert.match(cart, /Nude/); assert.match(cart, /Calculée au paiement/); assert.match(cart, /19,90/); assert.match(cart, /aria-label="Panier \(3\)"/); ok('panier Shopify : 2 × 7,50 + 4,90 = 19,90 €');
  const lineId = /name="product_id" value="(gid:\/\/shopify\/CartLine\/\d+)"/.exec(cart)[1];
  await req('POST', '/panier/modifier', { _csrf: csrf, product_id: lineId, qty: 3 });
  assert.match((await req('GET', '/panier')).text, /27,40/); ok('modification de quantité');
  await req('POST', '/panier/modifier', { _csrf: csrf, product_id: lineId, qty: 0 });
  assert.doesNotMatch((await req('GET', '/panier')).text, /Nude/); ok('retrait d’un article');
  const co = await req('GET', '/commande'); assert.equal(co.status, 302); assert.match(co.loc, /^https:\/\/mock-shop\.test\/cart\/c\//); ok('« Payer » → checkout Shopify (sans compte)');
  assert.equal((await req('POST', '/commande', { _csrf: csrf })).loc, '/commande'); ok('l’ancien tunnel Stripe n’est pas utilisé');

  const adm = jar.cookie; // admin toujours disponible
  sim.state.down = true; assert.equal((await req('GET', '/')).status, 200); assert.equal((await req('GET', '/panier')).status, 200); ok('Shopify indisponible : le site reste affiché (cache, message d’erreur)');
  console.log('\nTous les tests du mode Shopify passent ✔ (simulateur)');
} catch (e) { failed = true; console.error('\n✗ ÉCHEC :', e.message); console.error(e.stack.split('\n').slice(1, 4).join('\n')); }
child.kill(); sim.server.close(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(failed ? 1 : 0);
