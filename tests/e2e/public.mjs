// Tests de la DÉMO PUBLIQUE (site statique). Aucun serveur Node : le site construit par scripts/build-demo-public.mjs
// est servi par l'interception réseau de Playwright sur un faux domaine HTTPS (https://demo.readyfile.example),
// avec les en-têtes du fichier _headers (CSP comprise). On vérifie ainsi les liens HTTPS, la CSP et l'absence de localhost.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { buildDemoPublic } from '../../scripts/build-demo-public.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  ({ chromium } = createRequire(`${execSync('npm root -g').toString().trim()}/`)('playwright'));
}

const SITE = mkdtempSync(join(tmpdir(), 'readyfile-demo-public-'));
buildDemoPublic({ outDir: SITE });
const ORIGIN = 'https://demo.readyfile.example';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
// _headers (format Cloudflare Pages) : bloc « /* » → en-têtes appliqués à toutes les réponses
const HEADERS = Object.fromEntries(readFileSync(join(SITE, '_headers'), 'utf8').split('\n').filter((l) => /^\s+\S+:/.test(l)).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const browser = await chromium.launch();
const results = [];
const hits = new Set(); // chemins demandés au « serveur » statique

async function attach(ctx) {
  await ctx.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    let p = u.pathname === '/' ? '/index.html' : u.pathname;
    try {
      const body = readFileSync(join(SITE, p));
      hits.add(p);
      await route.fulfill({ status: 200, body, headers: { ...HEADERS, 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' } });
    } catch { await route.fulfill({ status: 404, body: 'Not found', headers: HEADERS }); }
  });
}

async function test(name, fn, { viewport = { width: 1360, height: 900 }, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, permissions: ['clipboard-read', 'clipboard-write'], locale: 'fr-FR', acceptDownloads: true });
  await attach(ctx);
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
  page.on('request', (r) => { if (!r.url().startsWith(ORIGIN) && !r.url().startsWith('data:')) external.push(r.url()); });
  const go = async (hash = '/') => { await page.goto(`${ORIGIN}/#${hash}`); await page.waitForSelector('#main'); };
  try {
    await fn({ page, go, ctx, errors });
    assert.deepEqual(errors, [], `erreurs JavaScript/console/CSP : ${errors.join(' | ')}`);
    assert.deepEqual(external, [], `requêtes externes interdites : ${external.join(', ')}`);
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`  ✗ ${name}\n      ${String(e.message).split('\n').slice(0, 6).join('\n      ')}`);
  } finally { await ctx.close(); }
}

const text = (page, sel) => page.locator(sel).first().innerText();
const noMissingKeys = async (page, where) => assert.ok(!(await page.innerText('body')).includes('⟦'), `clé de traduction manquante sur ${where}`);
const noOverflow = async (page, where) => {
  const px = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(px <= 1, `débordement horizontal de ${px}px sur ${where}`);
};
const waitState = (page, id, state) => page.waitForSelector(`[data-slot="${id}"][data-state="${state}"]`, { timeout: 8000 });
const KEY = 'readyfile-ai-demo';
const stateOf = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const ROUTES = ['/welcome', '/', '/clients', '/clients/CLI-003', '/dossiers', '/dossiers/DOS-007', '/followups', '/analysis', '/settings', '/portal/demo-dos-003'];
const setEn = (page) => page.locator('.seg-btn[lang="en"]').first().click();

console.log('\nREADYFILE AI — tests de la démo publique (site statique, domaine HTTPS simulé)\n');

await test('Site statique : s’ouvre sans serveur Node, sur le domaine HTTPS, avec les en-têtes de sécurité (CSP) et sans indexation', async ({ page }) => {
  const resp = await page.goto(`${ORIGIN}/`);
  await page.waitForSelector('.landing');
  assert.match(page.url(), /^https:\/\/demo\.readyfile\.example\/#\/welcome$/);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.edition), 'public-demo');
  const h = resp.headers();
  assert.match(h['content-security-policy'], /default-src 'self'/);
  assert.match(h['content-security-policy'], /connect-src 'self'/);
  assert.doesNotMatch(h['content-security-policy'], /unsafe-eval|https?:/);
  assert.match(h['x-robots-tag'], /noindex/);
  assert.equal(h['x-frame-options'], 'DENY');
  assert.equal(h['x-content-type-options'], 'nosniff');
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
  assert.match(await page.title(), /READYFILE AI/);
  assert.ok(hits.has('/js/app.js') && hits.has('/assets/styles.css'));
  assert.equal(await page.evaluate(() => fetch('/robots.txt').then((r) => r.status)), 200);
  // le site livré ne contient que l'application : rien d'autre n'existe côté serveur
  for (const absent of ['growth', 'server.js', 'package.json', 'tests', 'docs', 'scripts', 'LIVRAISON-DEMO', '.git', '.env']) assert.ok(!existsSync(join(SITE, absent)), `${absent} ne doit pas être livré`);
});

await test('Toutes les pages (FR puis EN) : aucune erreur JS/CSP, aucune clé manquante, bandeau « simulé / aucun envoi » permanent', async ({ page, go }) => {
  for (const lang of ['fr', 'en']) {
    for (const r of ROUTES) {
      await go(r);
      if (lang === 'en' && (await page.locator('.seg-btn[lang="en"]').first().getAttribute('aria-pressed')) !== 'true') await setEn(page);
      assert.ok((await page.locator('h1').first().innerText()).length > 2, `h1 vide ${r}`);
      await noMissingKeys(page, `${r} (${lang})`);
      if (r !== '/welcome') {
        const strip = await text(page, '[data-testid="public-strip"]');
        assert.match(strip, lang === 'fr' ? /SIMULÉE.*aucune IA ni OCR réels.*aucun message n’est réellement envoyé/s : /SIMULATED.*no real AI or OCR.*no message is really sent/s, `${r} (${lang})`);
      } else {
        assert.match(await text(page, '.landing'), lang === 'fr' ? /Aucune IA ni OCR réels, aucun message envoyé, aucune donnée réelle/ : /No real AI or OCR, no message sent, no real data/);
      }
    }
  }
});

await test('Le bandeau reste visible et lisible sur mobile (390 px) — la pastille du haut y est masquée', async ({ page, go }) => {
  for (const r of ['/', '/dossiers/DOS-007', '/followups', '/portal/demo-dos-003']) {
    await go(r);
    assert.ok(await page.locator('[data-testid="public-strip"]').isVisible(), r);
    await noOverflow(page, `${r} @390`);
  }
}, { viewport: { width: 390, height: 844 }, mobile: true });

await test('Aucune fonction de collecte : pas de sélection de fichier, pas de restauration, pas de tarifs, aucune trace de l’outil de prospection', async ({ page, go }) => {
  for (const r of ROUTES) {
    await go(r);
    assert.equal(await page.locator('input[type="file"]').count(), 0, `sélecteur de fichier sur ${r}`);
  }
  await go('/settings');
  assert.ok(await page.locator('[data-testid="restore-disabled"]').isVisible());
  assert.equal(await page.locator('[data-action="backup-download"]').count(), 1, 'la sauvegarde/export des données fictives reste possible');
  assert.equal(await page.locator('button:has-text("Restaurer"), label:has-text("Restaurer")').count(), 0);
  await go('/portal/demo-dos-003');
  assert.ok((await page.locator('[data-action="portal-fake"]').count()) >= 1, 'dépôts simulés conservés');
  assert.match(await text(page, '.portal-main'), /aucun fichier réel n’est envoyé, lu ni stocké/);
  // pas de tarifs / calculateur
  await go('/');
  assert.equal(await page.locator('nav a[href="#/pricing"]').count(), 0);
  await go('/pricing');
  assert.match(await text(page, 'main'), /introuvable|not found/i);
  await go('/welcome');
  assert.equal(await page.locator('#l-pricing, [data-target="l-pricing"]').count(), 0);
  // aucune trace de l'outil interne dans ce qui est servi
  for (const p of [...hits]) {
    const body = readFileSync(join(SITE, p), 'utf8');
    assert.ok(!/growth|prospect|5174/i.test(body), `${p} mentionne l’outil de prospection`);
  }
});

await test('Défense en profondeur : même un sélecteur de fichier injecté ne peut ni restaurer ni déposer un vrai fichier', async ({ page, go }) => {
  await go('/settings');
  const before = JSON.stringify(await stateOf(page));
  const good = await page.evaluate(() => null);
  await page.evaluate(() => { for (const a of ['backup-file', 'portal-file']) { const i = document.createElement('input'); i.type = 'file'; i.id = `inj-${a}`; i.dataset.change = a; i.dataset.dossier = 'DOS-003'; i.dataset.slot = 'DOS-003-S3'; document.body.appendChild(i); } });
  const backup = JSON.stringify({ app: 'readyfile-ai', format: 'readyfile-ai-backup', formatVersion: 1, data: JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY)) });
  await page.setInputFiles('#inj-backup-file', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.setInputFiles('#inj-portal-file', { name: 'vrai-document.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 contenu confidentiel') });
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.modal').count(), 0);
  assert.equal(JSON.stringify(await stateOf(page)), before, 'aucune donnée modifiée, aucun fichier lu');
  assert.ok(!JSON.stringify(await stateOf(page)).includes('vrai-document'));
});

await test('Démo guidée en 7 étapes : DOS-013 passe de 0 % à 50 % puis 100 %, avec dépôts simulés et messages jamais envoyés', async ({ page, go }) => {
  await go('/welcome');
  const step = async () => Number(await page.locator('[data-testid="tour"]').getAttribute('data-step'));
  await page.click('[data-action="tour-start"] >> nth=0');
  await page.waitForSelector('[data-testid="tour"]');
  assert.equal(await step(), 1);
  assert.match(await text(page, '[data-testid="tour"]'), /Données entièrement fictives/);
  await page.click('[data-action="tour-next"]');
  await page.waitForSelector('h1:has-text("Dossiers")');
  await page.click('[data-action="tour-do"]');
  await page.waitForSelector('.summary-bar');
  assert.equal((await text(page, 'h1')).match(/DOS-\d+/)[0], 'DOS-013');
  assert.match(await text(page, '[data-testid="public-strip"]'), /SIMULÉE/);
  await page.click('[data-action="tour-next"]');
  await page.click('[data-action="tour-do"]');
  const req = await page.inputValue('#msg-text');
  // le lien du portail est sur le domaine HTTPS de la démo
  assert.match(req, /https:\/\/demo\.readyfile\.example\/#\/portal\/demo-dos-013/);
  assert.ok(!/127\.0\.0\.1|localhost/.test(req));
  assert.ok(await page.locator('.modal button', { hasText: 'Envoyer' }).isDisabled(), 'envoi désactivé');
  await page.keyboard.press('Escape');
  await page.click('[data-action="tour-next"]');
  await page.waitForSelector('[data-testid="portal-docs"]');
  assert.match(await text(page, '.portal-hero'), /0%/);
  await page.click('[data-action="tour-do"]');
  await waitState(page, 'DOS-013-S1', 'valid');
  await waitState(page, 'DOS-013-S2', 'invalid');
  await waitState(page, 'DOS-013-S3', 'valid');
  await waitState(page, 'DOS-013-S4', 'invalid');
  assert.match(await text(page, '.portal-hero'), /50%/);
  await page.click('[data-action="tour-next"]');
  await page.waitForSelector('.summary-bar');
  assert.match(await text(page, 'tr[data-slot="DOS-013-S2"]'), /Incomplet/);
  assert.match(await text(page, 'tr[data-slot="DOS-013-S4"]'), /Illisible/);
  await page.click('[data-action="tour-next"]');
  await page.click('[data-action="tour-do"]');
  assert.match(await page.inputValue('#msg-text'), /illisible/);
  await page.keyboard.press('Escape');
  await page.click('[data-action="tour-next"]');
  await page.waitForSelector('[data-testid="portal-docs"]');
  await page.click('[data-action="tour-do"]');
  await waitState(page, 'DOS-013-S2', 'valid');
  await waitState(page, 'DOS-013-S4', 'valid');
  assert.match(await text(page, '.portal-hero'), /100%/);
  await page.click('[data-action="tour-next"]');
  await page.waitForSelector('.kpi-grid');
  assert.equal(await page.locator('[data-testid="tour"]').count(), 0);
});

await test('Liens du portail : domaine HTTPS de la démo (copie du lien, message préparé, menu), jamais localhost ni 127.0.0.1', async ({ page, go }) => {
  await go('/dossiers/DOS-003');
  await page.click('[data-action="copy-portal"]');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(copied, `${ORIGIN}/#/portal/demo-dos-003`);
  await page.click('button[data-action="open-assistant"]:not([data-slot])');
  const msg = await page.inputValue('#msg-text');
  assert.ok(msg.includes(`${ORIGIN}/#/portal/demo-dos-003`), msg);
  await page.keyboard.press('Escape');
  // aucun lien de la page ne pointe vers localhost / une IP
  for (const r of ROUTES) {
    await go(r);
    const bad = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.href).filter((h) => /localhost|127\.0\.0\.1|^http:/.test(h)));
    assert.deepEqual(bad, [], r);
  }
  // le lien copié fonctionne tel quel dans un autre « navigateur » (données de démonstration identiques au départ)
  const other = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await attach(other);
  const p2 = await other.newPage();
  await p2.goto(copied);
  await p2.waitForSelector('[data-testid="portal-docs"]');
  assert.match(await text(p2, 'h1'), /Déclaration de TVA/);
  await other.close();
});

await test('Isolation des données entre navigateurs : un dépôt fait dans l’un n’apparaît pas dans l’autre', async ({ page, go }) => {
  await go('/portal/demo-dos-002');
  const before = await stateOf(page);
  const slot = before.dossiers.find((d) => d.id === 'DOS-002').slots.find((s) => !s.doc);
  await page.click(`[data-slot="${slot.id}"] [data-action="portal-fake"]`);
  await waitState(page, slot.id, 'valid');
  const mine = await stateOf(page);
  assert.ok(mine.dossiers.find((d) => d.id === 'DOS-002').slots.find((s) => s.id === slot.id).doc, 'mon dépôt est enregistré chez moi');
  // un second navigateur (contexte vierge) repart des données de démonstration d'origine
  const other = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await attach(other);
  const p2 = await other.newPage();
  await p2.goto(`${ORIGIN}/#/portal/demo-dos-002`);
  await p2.waitForSelector('[data-testid="portal-docs"]');
  const theirs = await stateOf(p2);
  assert.equal(theirs.dossiers.find((d) => d.id === 'DOS-002').slots.find((s) => s.id === slot.id).doc, null, 'rien n’est partagé');
  assert.equal((await p2.evaluate(() => Object.keys(localStorage))).join(), KEY);
  // un dossier créé par la démo guidée (DOS-013) n'existe que dans mon navigateur
  await go('/welcome');
  await page.click('[data-action="tour-start"] >> nth=0');
  await page.click('[data-action="tour-next"]');
  await page.click('[data-action="tour-do"]');
  await page.waitForSelector('.summary-bar');
  await p2.goto(`${ORIGIN}/#/portal/demo-dos-013`);
  await p2.reload();
  await p2.waitForSelector('#main');
  assert.match(await text(p2, 'main'), /invalide|introuvable|not found|invalid/i);
  await other.close();
});

await test('Navigation : tous les liens internes de chaque page mènent à une page valide', async ({ page, go }) => {
  const seen = new Set();
  const todo = ['/welcome', '/'];
  while (todo.length) {
    const r = todo.shift();
    if (seen.has(r)) continue;
    seen.add(r);
    await go(r);
    assert.ok((await page.locator('h1').first().innerText()).length > 2, `h1 vide sur ${r}`);
    assert.doesNotMatch(await text(page, 'main'), /introuvable|not found/i, `lien cassé : ${r}`);
    for (const href of await page.locator('a[href^="#/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href').slice(1).split('?')[0]))) if (!seen.has(href)) todo.push(href);
    if (seen.size > 60) break;
  }
  for (const must of ['/clients', '/dossiers', '/followups', '/analysis', '/settings', '/dossiers/DOS-007', '/portal/demo-dos-003']) assert.ok(seen.has(must), `page jamais atteinte par un lien : ${must}`);
  assert.ok(!seen.has('/pricing'));
});

await test('Calculs : tableau de bord, liste des dossiers et relances cohérents avec les données', async ({ page, go }) => {
  await go('/');
  const st = await stateOf(page);
  const kpi = async (label) => Number(await page.locator('a.kpi').filter({ has: page.locator('.kpi-label', { hasText: new RegExp(`^${label}$`) }) }).locator('.kpi-val').innerText());
  assert.equal(await kpi('Dossiers'), st.dossiers.length);
  await go('/dossiers');
  assert.equal(await page.locator('[data-testid="dossiers-table"] tbody tr').count(), st.dossiers.length);
  await go('/followups');
  const needing = st.dossiers.filter((d) => d.slots.some((s) => !s.doc || s.doc.status === 'invalid')).length;
  assert.equal(await page.locator('[data-testid="followups-table"] tbody tr').count(), needing);
  assert.match(await text(page, '[data-testid="followups-count"]'), new RegExp(`^${needing} résultat`));
  // mise à jour croisée : valider un dossier le retire des relances
  await go('/portal/demo-dos-002');
  for (const s of st.dossiers.find((d) => d.id === 'DOS-002').slots.filter((x) => !x.doc)) {
    await page.click(`[data-slot="${s.id}"] [data-action="portal-fake"]`);
    await waitState(page, s.id, 'valid');
  }
  await go('/followups');
  assert.equal(await page.locator('[data-testid="followups-table"] tbody tr').count(), needing - 1);
});

await test('Analyse documentaire : étiquetée « simulation » partout (laboratoire, résultats, assistant)', async ({ page, go }) => {
  await go('/analysis');
  assert.match(await text(page, 'main'), /SIMULÉE|simulation|Simulation/);
  assert.match(await text(page, 'main'), /pas d'une lecture réelle du document|pas d’une lecture réelle/);
  await go('/dossiers/DOS-007');
  assert.match(await page.locator('.sim-tag').first().textContent(), /Résultat simulé/);
  await page.click('button[data-action="open-assistant"]:not([data-slot])');
  assert.match(await text(page, '.modal'), /aucun envoi|n’envoie|not sent|Aucun/i);
  assert.ok(await page.locator('.modal button', { hasText: 'Envoyer' }).isDisabled());
});

await test('Mobile 390 px : navigation (menu), pages principales et portail sans débordement', async ({ page, go }) => {
  for (const r of ROUTES) { await go(r); await noOverflow(page, `${r} @390`); }
  await go('/');
  await page.click('[data-action="drawer-open"]');
  await page.click('nav a[href="#/followups"]');
  await page.waitForSelector('[data-testid="followups-table"]');
  assert.match(await text(page, 'h1'), /Relances/);
}, { viewport: { width: 390, height: 844 }, mobile: true });

await test('Tablette 820 px : aucun débordement', async ({ page, go }) => {
  for (const r of ROUTES) { await go(r); await noOverflow(page, `${r} @820`); }
}, { viewport: { width: 820, height: 1180 } });

await browser.close();
rmSync(SITE, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
console.log(`\nRésultat : ${results.length - failed.length}/${results.length} tests de la démo publique réussis${failed.length ? ` — ${failed.length} échec(s)` : ''}\n`);
process.exit(failed.length ? 1 : 0);
