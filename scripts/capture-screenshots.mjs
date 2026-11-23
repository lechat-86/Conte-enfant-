// Captures de la VRAIE interface (démo publique construite) pour le futur PDF commercial.
// Chromium en mode capture de page : aucune barre de navigateur. Nécessite Playwright (déjà installé dans l'environnement).
//   node scripts/capture-screenshots.mjs [dossier-de-sortie]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoPublic, headersFile } from './build-demo-public.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(`${execSync('npm root -g').toString().trim()}/`)('playwright')); }

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || join(ROOT, 'LIVRAISON-DEMO', 'captures'));
mkdirSync(OUT, { recursive: true });
const SITE = mkdtempSync(join(tmpdir(), 'readyfile-shots-'));
buildDemoPublic({ outDir: SITE });
const ORIGIN = 'https://demo.readyfile.example';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const HEADERS = Object.fromEntries(headersFile().split('\n').filter((l) => /^\s+\S+:/.test(l)).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const browser = await chromium.launch();
const done = [];

async function session({ width, height, mobile, lang }, fn) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 3 : 2, isMobile: mobile, hasTouch: mobile, locale: lang === 'en' ? 'en-GB' : 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname === '/' ? '/index.html' : u.pathname;
    try { await route.fulfill({ status: 200, body: readFileSync(join(SITE, p)), headers: { ...HEADERS, 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' } }); }
    catch { await route.fulfill({ status: 404, body: '' }); }
  });
  const page = await ctx.newPage();
  const go = async (hash) => { await page.goto(`${ORIGIN}/#${hash}`); await page.waitForSelector('#main'); if (lang === 'en') { const b = page.locator('.seg-btn[lang="en"]').first(); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click(); } await page.waitForTimeout(900); };
  const shot = async (name) => { await page.waitForFunction(() => !document.querySelector('#toast-root')?.children.length, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(300); await page.screenshot({ path: join(OUT, `${name}.png`) }); done.push(name); };
  try { await fn({ page, go, shot }); } finally { await ctx.close(); }
}

// ── Ordinateur, français ────────────────────────────────────────────────
await session({ width: 1440, height: 900, mobile: false, lang: 'fr' }, async ({ page, go, shot }) => {
  await go('/welcome'); await shot('01-presentation-fr');
  await go('/'); await shot('02-tableau-de-bord-fr');
  await go('/dossiers'); await shot('03-dossiers-fr');
  await go('/dossiers/DOS-007'); await shot('04-dossier-anomalies-fr');
  await go('/dossiers/DOS-004');
  await page.click('button[data-action="open-assistant"]:not([data-slot])'); await page.waitForTimeout(600); await shot('05-message-de-relance-fr');
  await page.keyboard.press('Escape');
  await go('/followups');
  await page.click('tr[data-dossier="DOS-008"] button[data-action="open-assistant"]'); await page.waitForSelector('.modal #msg-text');
  await page.check('[data-change="msg-reviewed"]'); await page.click('[data-action="msg-approve"]'); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await shot('06-relances-fr');
  await go('/portal/demo-dos-003'); await shot('07-portail-client-fr');
  await go('/analysis'); await shot('08-analyse-documentaire-simulee-fr');
  // démo guidée : dossier DOS-013 à 50 % puis 100 %
  await go('/welcome');
  await page.click('[data-action="tour-start"] >> nth=0'); await page.waitForSelector('[data-testid="tour"]');
  await page.click('[data-action="tour-next"]'); await page.click('[data-action="tour-do"]'); await page.waitForSelector('.summary-bar');
  await page.click('[data-action="tour-next"]'); await page.click('[data-action="tour-do"]'); await page.keyboard.press('Escape');
  await page.click('[data-action="tour-next"]'); await page.waitForSelector('[data-testid="portal-docs"]'); await page.click('[data-action="tour-do"]');
  await page.waitForSelector('[data-slot="DOS-013-S4"][data-state="invalid"]'); await page.waitForTimeout(500);
  await shot('09-demo-guidee-50-pourcent-fr');
  for (let i = 0; i < 3; i++) await page.click('[data-action="tour-next"]'); // étapes 5, 6, 7
  await page.waitForSelector('[data-testid="portal-docs"]');
  await page.click('[data-action="tour-do"]'); await page.waitForSelector('[data-slot="DOS-013-S4"][data-state="valid"]'); await page.waitForSelector('[data-slot="DOS-013-S2"][data-state="valid"]'); await page.waitForTimeout(500);
  await shot('10-demo-guidee-100-pourcent-fr');
});

// ── Mobile, français ───────────────────────────────────────────────────
await session({ width: 390, height: 844, mobile: true, lang: 'fr' }, async ({ go, shot }) => {
  await go('/'); await shot('11-mobile-tableau-de-bord-fr');
  await go('/followups'); await shot('12-mobile-relances-fr');
  await go('/portal/demo-dos-003'); await shot('13-mobile-portail-client-fr');
});

// ── Ordinateur, anglais ────────────────────────────────────────────────
await session({ width: 1440, height: 900, mobile: false, lang: 'en' }, async ({ go, shot }) => {
  await go('/'); await shot('14-dashboard-en');
  await go('/followups'); await shot('15-follow-ups-en');
  await go('/portal/demo-dos-003'); await shot('16-client-portal-en');
});

await browser.close();
rmSync(SITE, { recursive: true, force: true });
console.log(`${done.length} captures → ${OUT}`);
