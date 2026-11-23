import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { buildDemoPublic, headersFile, publicIndexHtml } from '../../scripts/build-demo-public.mjs';
import { SECURITY_HEADERS } from '../../server.js';
import { isPublicDemo } from '../../public/js/core/edition.js';
import { buildSeed } from '../../public/js/data/seed.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'rf-demo-'));
const walk = (d, base = d) => readdirSync(d).sort().flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f), base) : [join(d, f).slice(base.length + 1)]));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

const out = tmp();
const files = buildDemoPublic({ outDir: out });
test.after(() => rmSync(out, { recursive: true, force: true }));

test('livraison : uniquement les fichiers nécessaires (liste blanche)', () => {
  const top = new Set(files.map((f) => f.split('/')[0]));
  assert.deepEqual([...top].sort(), ['_headers', 'assets', 'index.html', 'js', 'robots.txt']);
  for (const f of files) assert.ok(['.html', '.js', '.css', '.svg', '.txt', ''].includes(extname(f)), `type inattendu : ${f}`);
  assert.ok(files.includes('index.html') && files.includes('js/app.js') && files.includes('assets/styles.css'));
});

test('livraison : ni outil de prospection, ni tests, docs, scripts, serveur, sauvegardes, secrets', () => {
  const banned = /(^|\/)(growth|tests?|docs|scripts|node_modules|LIVRAISON-DEMO|\.git|\.env[^/]*|server\.js|package(-lock)?\.json|README[^/]*|.*\.(md|json|zip|csv|log|bak|pem|key))$/i;
  for (const f of files) assert.ok(!banned.test(f), `fichier interdit livré : ${f}`);
  assert.ok(!files.some((f) => /sauvegarde|backup.*\.json|prospect/i.test(f.replace('js/domain/backup.js', ''))), 'aucune sauvegarde / prospect');
});

test('livraison : aucune donnée personnelle réelle, adresse locale ou secret dans le contenu des fichiers', () => {
  for (const f of files) {
    const txt = readFileSync(join(out, f), 'utf8');
    assert.ok(!/growth|prospect|5174|readyfile-growth/i.test(txt), `${f} : trace de l’outil de prospection`);
    assert.ok(!/localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|\bfile:\/\//i.test(txt), `${f} : adresse locale`);
    assert.ok(!/(api[_-]?key\s*[:=]|(secret|passwd|password|client_secret)\s*[:=]|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,})/i.test(txt), `${f} : secret possible`);
    for (const m of txt.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g)) {
      assert.match(m[0], /\.example$/, `${f} : adresse e-mail non fictive : ${m[0]}`);
    }
  }
});

test('données de démonstration : 100 % fictives (e-mails en .example, aucune URL externe)', () => {
  const seed = buildSeed(new Date('2026-11-22T10:00:00Z'));
  for (const c of seed.clients) assert.match(c.email, /@[a-z0-9-]+\.example$/, c.id);
  const all = JSON.stringify(seed);
  assert.ok(!/https?:\/\//.test(all));
  for (const f of files.filter((x) => x.endsWith('.js') || x.endsWith('.html') || x.endsWith('.css'))) {
    const urls = [...readFileSync(join(out, f), 'utf8').matchAll(/https?:\/\/[^\s'"`)<>]+/g)].map((m) => m[0]);
    for (const u of urls) assert.ok(/^https?:\/\/(www\.)?w3\.org\/2000\/svg|^https?:\/\/\$\{/.test(u) || u === 'http://' || u === 'https://', `${f} : URL externe ${u}`);
  }
});

test('édition publique : attribut, non-indexation et en-têtes identiques aux règles du serveur local', () => {
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /<html lang="fr" data-edition="public-demo">/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<script type="module" src="js\/app\.js"><\/script>/);
  assert.throws(() => publicIndexHtml('<html></html>'), /introuvable/);
  const h = headersFile();
  assert.ok(h.includes(SECURITY_HEADERS['Content-Security-Policy']));
  assert.match(h, /X-Robots-Tag: noindex/);
  assert.match(h, /X-Frame-Options: DENY/);
  assert.doesNotMatch(h, /unsafe-eval|https?:/);
  assert.equal(readFileSync(join(out, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
});

test('edition.js : désactivée par défaut (serveur local, tests), activée seulement par data-edition="public-demo"', () => {
  assert.equal(isPublicDemo(), false);
  const prev = globalThis.document;
  try {
    globalThis.document = { documentElement: { dataset: { edition: 'public-demo' } } };
    assert.equal(isPublicDemo(), true);
    globalThis.document = { documentElement: { dataset: { edition: 'autre' } } };
    assert.equal(isPublicDemo(), false);
  } finally { if (prev === undefined) delete globalThis.document; else globalThis.document = prev; }
});

test('le site livré = public/ (aucune divergence) + 3 fichiers de configuration ; build reproductible', () => {
  for (const f of files.filter((x) => x.startsWith('js/') || x.startsWith('assets/'))) assert.equal(sha(join(out, f)), sha(join('public', f)), f);
  const out2 = tmp();
  try {
    buildDemoPublic({ outDir: out2 });
    for (const f of files) assert.equal(sha(join(out2, f)), sha(join(out, f)), `build non reproductible : ${f}`);
  } finally { rmSync(out2, { recursive: true, force: true }); }
});

test('DEMO-PUBLIC/ et le ZIP livrés sont à jour avec le code source (sinon : npm run build:demo)', () => {
  assert.ok(existsSync('DEMO-PUBLIC/index.html'), 'DEMO-PUBLIC absent : lancer npm run build:demo');
  assert.deepEqual(walk('DEMO-PUBLIC'), files, 'liste de fichiers de DEMO-PUBLIC différente du build');
  for (const f of files) assert.equal(sha(join('DEMO-PUBLIC', f)), sha(join(out, f)), `DEMO-PUBLIC/${f} périmé : lancer npm run build:demo`);
  const zip = 'LIVRAISON-DEMO/readyfile-demo-public.zip';
  assert.ok(existsSync(zip), 'ZIP absent');
  const listed = execFileSync('unzip', ['-Z1', zip]).toString().trim().split('\n').sort();
  assert.deepEqual(listed, [...files].sort(), 'le ZIP doit contenir exactement DEMO-PUBLIC, à la racine');
  assert.ok(listed.includes('index.html'), 'index.html à la racine du ZIP');
  execFileSync('unzip', ['-tq', zip]); // intégrité
  const x = tmp();
  try {
    execFileSync('unzip', ['-q', zip, '-d', x]);
    for (const f of files) assert.equal(sha(join(x, f)), sha(join(out, f)), `ZIP/${f} périmé`);
  } finally { rmSync(x, { recursive: true, force: true }); }
});
