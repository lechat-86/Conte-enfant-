import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createGrowthServer, hostAllowed, SHARED } from '../../growth/server.js';
import { createServer as createMainServer } from '../../server.js';

function listen(server) { return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port))); }
function request(port, { path = '/', method = 'GET', host } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers: host ? { Host: host } : {} }, (res) => {
      let body = ''; res.on('data', (c) => (body += c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
}
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('GROWTH : serveur local avec en-têtes de sécurité et CSP sans connexion sortante', async () => {
  const s = createGrowthServer(); const port = await listen(s);
  try {
    const r = await request(port, { path: '/' });
    assert.equal(r.status, 200);
    assert.match(r.body, /READYFILE GROWTH/);
    const csp = r.headers['content-security-policy'];
    assert.match(csp, /connect-src 'none'/);
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /form-action 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(r.headers['x-robots-tag'], /noindex/);
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.match(r.body, /noindex/);
  } finally { s.close(); }
});

test('GROWTH : en-tête Host contrôlé (anti DNS rebinding) et méthodes limitées', async () => {
  const s = createGrowthServer(); const port = await listen(s);
  try {
    assert.equal((await request(port, { host: 'evil.example' })).status, 403);
    assert.equal((await request(port, { host: `evil.example:${port}` })).status, 403);
    assert.equal((await request(port, { host: `localhost:${port}` })).status, 200);
    assert.equal((await request(port, { method: 'POST' })).status, 405);
    assert.equal((await request(port, { method: 'DELETE' })).status, 405);
  } finally { s.close(); }
  assert.ok(hostAllowed('127.0.0.1:5174', 5174) && !hostAllowed('127.0.0.1:5175', 5174) && !hostAllowed(undefined, 5174));
});

test('GROWTH : seuls 4 fichiers du produit sont partagés (liste blanche), pas de traversée de répertoire', async () => {
  assert.equal(Object.keys(SHARED).length, 4);
  const s = createGrowthServer(); const port = await listen(s);
  try {
    for (const p of Object.keys(SHARED)) assert.equal((await request(port, { path: p })).status, 200, p);
    for (const p of ['/shared/js/data/store.js', '/shared/js/data/seed.js', '/shared/index.html', '/shared/../server.js', '/shared/js/core/i18n.js', '/shared/']) assert.equal((await request(port, { path: p })).status, 404, p);
    for (const p of ['/../server.js', '/..%2fserver.js', '/%2e%2e/package.json', '/../../package.json']) assert.notEqual((await request(port, { path: p })).status, 200, p);
    assert.equal((await request(port, { path: '/js/app.js' })).status, 200);
  } finally { s.close(); }
});

test('ISOLATION : le serveur de READYFILE AI ne sert rien de READYFILE GROWTH', async () => {
  const s = createMainServer(); const port = await listen(s);
  try {
    for (const p of ['/growth/', '/growth/public/index.html', '/growth/server.js', '/growth/public/js/app.js', '/../growth/public/index.html', '/shared/assets/styles.css', '/js/views/prospects.js', '/js/data/seed.js?growth']) {
      const r = await request(port, { path: p });
      assert.ok(r.status !== 200 || !/GROWTH/i.test(r.body), `${p} expose GROWTH`);
    }
    assert.equal((await request(port, { path: '/growth/public/index.html' })).status, 404);
  } finally { s.close(); }
});

test('ISOLATION : aucune trace de GROWTH dans le code et la documentation visibles par les clients de READYFILE AI', () => {
  for (const f of walk('public')) {
    const txt = readFileSync(f, 'utf8');
    assert.ok(!/growth|5174|readyfile-growth/i.test(txt), `${f} mentionne GROWTH`);
  }
});

test('ISOLATION : origines distinctes (ports différents) → stockage navigateur séparé', async () => {
  const { PORT } = await import('../../growth/server.js');
  assert.notEqual(PORT, 5173);
});

test('AUCUN ENVOI NI RÉSEAU : le code de GROWTH ne contient aucune API de communication externe', () => {
  const FORBIDDEN = [
    [/\bfetch\s*\(/, 'fetch'], [/XMLHttpRequest/, 'XMLHttpRequest'], [/WebSocket/, 'WebSocket'], [/EventSource/, 'EventSource'], [/sendBeacon/, 'sendBeacon'],
    [/mailto:/i, 'mailto'], [/\bwindow\.open\b/, 'window.open'], [/navigator\.share/, 'navigator.share'], [/\bimport\s*\(/, 'import dynamique'],
    [/<form[^>]*\saction=/i, 'form action'], [/\blocation\.(href|assign|replace)\s*=/, 'redirection'], [/<script[^>]+src="https?:/i, 'script externe'],
    [/<link[^>]+href="https?:/i, 'feuille externe'], [/\bsms:|tel:/i, 'sms/tel'], [/linkedin\.com\/(?:in|sales|messaging)/i, 'LinkedIn'], [/\bpuppeteer|playwright|cheerio|jsdom\b/i, 'scraper'],
    [/setInterval\s*\(/, 'minuteur récurrent (envoi différé possible)'],
  ];
  const files = [...walk('growth/public'), 'growth/server.js'].filter((f) => /\.(js|html|css)$/.test(f));
  assert.ok(files.length > 25);
  for (const f of files) {
    const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); // commentaires ignorés
    for (const [re, name] of FORBIDDEN) assert.ok(!re.test(src), `${f} contient « ${name} »`);
  }
});

test('AUCUNE URL EXTERNE en dur hors données de démonstration fictives (.example)', () => {
  for (const f of walk('growth/public').filter((p) => /\.(js|html|css)$/.test(p))) {
    const urls = readFileSync(f, 'utf8').match(/https?:\/\/[^\s'"`)<>]+/g) || [];
    for (const u of urls) assert.ok(/^https?:\/\/\$\{/.test(u) || /\.example\b|^https?:\/\/(www\.)?w3\.org\/2000\/svg|^https?:\/\/127\.0\.0\.1|^https?:\/\/…/.test(u) || /^https?:\/\/$/.test(u), `${f} : URL externe ${u}`);
  }
});

test('Les relances ne sont jamais déclenchées automatiquement : aucune action d\'envoi n\'existe dans le store', async () => {
  const { createStore, memoryStorage } = await import('../../growth/public/js/data/store.js');
  const store = createStore({ storage: memoryStorage() });
  const names = Object.keys(store);
  for (const n of names) assert.ok(!/^(send|email|mail|post|dispatch|schedule|autoFollow)/i.test(n), `méthode suspecte : ${n}`);
});

test('Le dépôt ne contient aucune capture/artefact accidentel et GROWTH est hors de public/', () => {
  assert.ok(!statSync('growth').isFile());
  assert.throws(() => statSync('public/growth'));
  const stray = readdirSync('.').filter((f) => /\.(png|jpg|log)$/i.test(f));
  assert.deepEqual(stray, []);
});
