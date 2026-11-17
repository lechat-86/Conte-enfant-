// Tests de bout en bout (navigateur Chromium réel via Playwright, déjà installé dans cet environnement).
// Lance son propre serveur local. Chaque test utilise un contexte vierge (localStorage propre).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from '../../server.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  ({ chromium } = createRequire(`${execSync('npm root -g').toString().trim()}/`)('playwright'));
}

const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

const results = [];
async function test(name, fn, { viewport = { width: 1360, height: 900 }, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, permissions: ['clipboard-read', 'clipboard-write'], locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) external.push(r.url()); });
  const go = async (hash = '/') => { await page.goto(`${BASE}#${hash}`); await page.waitForSelector('#main'); };
  try {
    await fn({ page, go, errors });
    assert.deepEqual(errors, [], `erreurs JavaScript/console : ${errors.join(' | ')}`);
    assert.deepEqual(external, [], `requêtes externes interdites : ${external.join(', ')}`);
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e });
    console.log(`  ✗ ${name}\n      ${String(e.message).split('\n').slice(0, 6).join('\n      ')}`);
  } finally {
    await ctx.close();
  }
}

const text = (page, sel) => page.locator(sel).first().innerText();
const kpi = (page, label) => page.locator('a.kpi').filter({ has: page.locator('.kpi-label', { hasText: new RegExp(`^${label}$`) }) }).locator('.kpi-val').innerText();
const noMissingKeys = async (page, where) => assert.ok(!(await page.innerText('body')).includes('⟦'), `clé de traduction manquante sur ${where}`);
const noOverflow = async (page, where) => {
  const px = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(px <= 1, `débordement horizontal de ${px}px sur ${where}`);
};
const rows = (page, testid) => page.locator(`[data-testid="${testid}"] tbody tr`).count();
const slotState = (page, id) => page.locator(`tr[data-slot="${id}"], li[data-slot="${id}"]`).first().getAttribute('data-state');
const waitState = (page, id, state) => page.waitForSelector(`[data-slot="${id}"][data-state="${state}"]`, { timeout: 6000 });

console.log('\nREADYFILE AI — tests end-to-end\n');

const ROUTES = ['/', '/clients', '/clients/CLI-003', '/dossiers', '/dossiers/DOS-007', '/analysis', '/pricing', '/settings', '/portal/demo-dos-003'];

await test('Toutes les pages se chargent (FR puis EN) sans erreur JS ni clé manquante', async ({ page, go }) => {
  for (const lang of ['fr', 'en']) {
    for (const r of ROUTES) {
      await go(r);
      if (lang === 'en' && (await page.locator('.seg-btn[lang="en"]').first().getAttribute('aria-pressed')) !== 'true') await page.locator('.seg-btn[lang="en"]').first().click();
      assert.equal(await page.evaluate(() => document.documentElement.lang), lang === 'en' ? 'en' : 'fr');
      assert.ok((await page.locator('h1').first().innerText()).length > 2, `h1 vide sur ${r}`);
      await noMissingKeys(page, `${r} (${lang})`);
    }
  }
  await go('/inexistant');
  assert.match(await text(page, 'main'), /introuvable|not found/i);
});

await test('Tableau de bord : KPI cohérents avec les données de démonstration', async ({ page, go }) => {
  await go('/');
  assert.equal(await kpi(page, 'Dossiers'), '12');
  assert.equal(await kpi(page, 'Documents reçus'), '37');
  assert.equal(await kpi(page, 'Documents validés'), '30');
  assert.equal(await kpi(page, 'Documents incorrects'), '5');
  assert.equal(await kpi(page, 'Documents manquants'), '12');
  assert.equal(await kpi(page, 'Interventions requises'), '5');
  assert.match(await text(page, '.kpi-wide'), /61%/);
  assert.equal(await page.locator('.donut').count(), 1);
  assert.equal(await page.locator('.hbars li').count(), 4);
  assert.equal(await page.locator('.col').count(), 8);
  assert.equal(await page.locator('.timeline .tl-item').count(), 8);
  assert.equal(await page.locator('.attn-list li').count(), 5);
  assert.equal((await text(page, '[data-testid="bell-count"]')).trim(), '5');
  // Les cartes KPI mènent aux listes filtrées
  await page.locator('a.kpi', { hasText: 'Documents incorrects' }).click();
  await page.waitForSelector('[data-testid="dossiers-table"]');
  assert.equal(await rows(page, 'dossiers-table'), 3);
  assert.equal(await page.locator('select[data-change="dossier-status"]').inputValue(), 'to_fix');
});

await test('Changement de langue FR/EN sans rechargement', async ({ page, go }) => {
  await go('/');
  await page.evaluate(() => { window.__marker = 'still-here'; });
  assert.equal(await text(page, 'h1'), 'Tableau de bord');
  await page.locator('.topbar .seg-btn[lang="en"]').click();
  assert.equal(await text(page, 'h1'), 'Dashboard');
  assert.match(await text(page, '.sidebar'), /Files/);
  assert.match(await text(page, '.sidebar'), /Plans & pricing/);
  assert.match(await text(page, 'main'), /Documents received/);
  assert.equal(await page.evaluate(() => window.__marker), 'still-here', 'la page a été rechargée');
  await page.locator('.sidebar a', { hasText: 'Clients' }).click();
  await page.waitForSelector('[data-testid="clients-table"]');
  assert.match(await text(page, 'main'), /Add a client/);
  await page.locator('.topbar .seg-btn[lang="fr"]').click();
  assert.match(await text(page, 'main'), /Ajouter un client/);
  assert.equal(await page.evaluate(() => window.__marker), 'still-here');
  // La préférence de langue est mémorisée
  await page.locator('.topbar .seg-btn[lang="en"]').click();
  await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
});

await test('Statuts, tableaux et dates traduits en anglais', async ({ page, go }) => {
  await go('/dossiers');
  await page.locator('.topbar .seg-btn[lang="en"]').click();
  const t = (await text(page, '[data-testid="dossiers-table"]'));
  const tl = t.toLowerCase();
  for (const w of ['Complete', 'Pending', 'To fix', 'Being analysed', 'Completion', 'Template', 'Monthly bookkeeping']) assert.ok(tl.includes(w.toLowerCase()), `manque « ${w} »`);
  assert.ok(!/Complet\b|En attente|À corriger/.test(t), 'texte français résiduel');
  await go('/dossiers/DOS-007');
  const d = await text(page, 'main');
  for (const w of ['Expected and received documents', 'Wrong type', 'Incomplete', 'Missing', 'File history']) assert.ok(d.toLowerCase().includes(w.toLowerCase()), `manque « ${w} »`);
});

await test('Clients : recherche, filtres, états vides', async ({ page, go }) => {
  await go('/clients');
  assert.equal(await rows(page, 'clients-table'), 8);
  await page.fill('#client-q', 'nordic');
  assert.equal(await rows(page, 'clients-table'), 1);
  assert.match(await text(page, '[data-testid="clients-table"]'), /Nordic Craft/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'client-q', 'le focus de la recherche est conservé');
  await page.fill('#client-q', '');
  await page.selectOption('select[data-change="client-country"]', 'FR');
  assert.equal(await rows(page, 'clients-table'), 3);
  await page.selectOption('select[data-change="client-country"]', 'all');
  await page.selectOption('select[data-change="client-health"]', 'issues');
  assert.equal(await rows(page, 'clients-table'), 3); // CLI-003, 004, 007
  await page.selectOption('select[data-change="client-health"]', 'ok');
  assert.ok((await rows(page, 'clients-table')) >= 1);
  await page.selectOption('select[data-change="client-health"]', 'all');
  await page.fill('#client-q', 'zzzzzz');
  assert.match(await text(page, '.empty'), /Aucun client ne correspond/);
});

await test('Clients : formulaire d’ajout (validation, succès, échappement XSS)', async ({ page, go }) => {
  await go('/clients');
  await page.click('[data-action="new-client"]');
  assert.ok(await page.locator('.modal').isVisible());
  await page.click('.modal button[type="submit"]');
  assert.equal(await page.locator('.modal .err').count(), 3); // société, contact, email
  await page.fill('#f-company', 'Société Test');
  await page.fill('#f-contact', 'Ada Test');
  await page.fill('#f-email', 'pas-un-email');
  await page.click('.modal button[type="submit"]');
  assert.match(await text(page, '.modal .err'), /Adresse email invalide/);
  assert.equal(await page.inputValue('#f-company'), 'Société Test', 'les valeurs saisies sont conservées après erreur');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.modal').count(), 0, 'Échap ferme la modale');
  // Ajout avec une charge XSS dans le nom
  await page.click('[data-action="new-client"]');
  await page.fill('#f-company', '<img src=x onerror="window.__xss=1">Evil');
  await page.fill('#f-contact', 'Ada Test');
  await page.fill('#f-email', 'ada@evil.example');
  await page.selectOption('#f-language', 'en');
  await page.click('.modal button[type="submit"]');
  await page.waitForSelector('h1 .avatar');
  assert.match(page.url(), /#\/clients\/CLI-009$/);
  assert.match(await text(page, 'h1'), /<img src=x/);
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'XSS exécuté !');
  assert.equal(await page.locator('main img').count(), 0);
  assert.match(await text(page, 'main'), /Aucun dossier pour l'instant/);
  await go('/clients');
  assert.equal(await rows(page, 'clients-table'), 9);
  await page.reload(); // persistance locale
  assert.equal(await rows(page, 'clients-table'), 9);
});

await test('Fiche client : dossiers, documents manquants, historique, nouveau dossier', async ({ page, go }) => {
  await go('/clients/CLI-004');
  assert.match(await text(page, 'h1'), /Atelier Verdier/);
  assert.equal(await rows(page, 'client-dossiers'), 1);
  const missing = await text(page, '.plain-list');
  assert.match(missing, /Tableau d'amortissement/); // manquant
  assert.match(missing, /Période incorrecte/);
  assert.match(missing, /Doublon/);
  assert.ok((await page.locator('.timeline .tl-item').count()) >= 5);
  await page.click('[data-action="new-dossier-for"]');
  assert.equal(await page.inputValue('#d-client'), 'CLI-004', 'client présélectionné');
  await page.keyboard.press('Escape');
  await go('/clients/CLI-999');
  assert.match(await text(page, '.empty'), /introuvable|n'existe pas/i);
});

await test('Dossiers : filtres, recherche, création de dossier fictif', async ({ page, go }) => {
  await go('/dossiers');
  assert.equal(await rows(page, 'dossiers-table'), 12);
  for (const [status, n] of [['complete', 4], ['pending', 3], ['to_fix', 3], ['analyzing', 2], ['attention', 5]]) {
    await page.selectOption('select[data-change="dossier-status"]', status);
    assert.equal(await rows(page, 'dossiers-table'), n, `statut ${status}`);
  }
  await page.selectOption('select[data-change="dossier-status"]', 'all');
  await page.selectOption('select[data-change="dossier-template"]', 'onboarding');
  assert.equal(await rows(page, 'dossiers-table'), 3);
  await page.selectOption('select[data-change="dossier-template"]', 'all');
  await page.fill('#dossier-q', 'berlin');
  assert.equal(await rows(page, 'dossiers-table'), 1);
  await page.fill('#dossier-q', '');
  // Création
  await page.click('[data-action="new-dossier-list"]');
  await page.click('.modal button[type="submit"]');
  assert.match(await text(page, '.modal .err'), /obligatoire/);
  await page.selectOption('#d-client', 'CLI-006');
  await page.selectOption('#d-template', 'vat_quarter');
  await page.fill('#d-period', '2026-09');
  await page.click('.modal button[type="submit"]');
  await page.waitForSelector('.summary-bar');
  assert.match(page.url(), /#\/dossiers\/DOS-013$/);
  assert.match(await text(page, 'h1'), /DOS-013/);
  assert.equal(await page.locator('[data-testid="slots-table"] tbody tr').count(), 4);
  assert.match(await text(page, '.summary-bar'), /En attente/);
  assert.match(await text(page, '.summary-bar'), /0%/);
  await go('/dossiers');
  assert.equal(await rows(page, 'dossiers-table'), 13);
});

await test('Détail dossier : dépôt simulé de chaque scénario et statut qui évolue', async ({ page, go }) => {
  await go('/dossiers/DOS-002');
  assert.equal(await slotState(page, 'DOS-002-S3'), 'missing');
  await page.selectOption('select[data-slot="DOS-002-S3"]', 'unreadable');
  await page.click('button[data-action="sim-deposit"][data-slot="DOS-002-S3"]');
  await waitState(page, 'DOS-002-S3', 'analyzing');
  assert.match(await text(page, '.summary-bar'), /En cours d'analyse/);
  await waitState(page, 'DOS-002-S3', 'invalid');
  assert.match(await text(page, 'tr[data-slot="DOS-002-S3"]'), /Illisible/);
  assert.match(await text(page, '.summary-bar'), /À corriger/);
  assert.match(await text(page, '.timeline'), /Analyse simulée : Factures d'achat illisible/);
  // Nouveau dépôt correct
  await page.selectOption('select[data-slot="DOS-002-S3"]', 'ok');
  await page.click('button[data-action="sim-deposit"][data-slot="DOS-002-S3"]');
  await waitState(page, 'DOS-002-S3', 'valid');
  assert.match(await text(page, 'tr[data-slot="DOS-002-S3"]'), /dépôt n°2/);
  await page.selectOption('select[data-slot="DOS-002-S4"]', 'duplicate');
  await page.click('button[data-action="sim-deposit"][data-slot="DOS-002-S4"]');
  await waitState(page, 'DOS-002-S4', 'invalid');
  assert.match(await text(page, 'tr[data-slot="DOS-002-S4"]'), /Doublon/);
  await page.selectOption('select[data-slot="DOS-002-S4"]', 'ok');
  await page.click('button[data-action="sim-deposit"][data-slot="DOS-002-S4"]');
  await waitState(page, 'DOS-002-S4', 'valid');
  assert.match(await text(page, '.summary-bar'), /Complet/);
  assert.match(await text(page, '.summary-bar'), /100%/);
  // Le tableau de bord reflète les modifications
  await go('/');
  assert.equal(await kpi(page, 'Documents manquants'), '10');
  assert.equal(await kpi(page, 'Documents validés'), '32');
});

await test('Analyse « en cours » : lancement manuel de l’analyse simulée', async ({ page, go }) => {
  await go('/dossiers/DOS-011');
  assert.equal(await slotState(page, 'DOS-011-S2'), 'analyzing');
  await page.click('button[data-action="run-analysis"][data-slot="DOS-011-S2"]');
  await waitState(page, 'DOS-011-S2', 'invalid');
  assert.match(await text(page, 'tr[data-slot="DOS-011-S2"]'), /Incomplet/);
  assert.match(await text(page, 'tr[data-slot="DOS-011-S2"]'), /Seulement 1 page/);
});

await test('Laboratoire : les 6 scénarios déterministes + synthèse', async ({ page, go }) => {
  await go('/analysis');
  assert.match(await text(page, '.note-sim'), /simulation|SIMULÉ/i);
  const expect = { ok: ['valid', 'none'], unreadable: ['invalid', 'unreadable'], wrong_type: ['invalid', 'wrong_type'], duplicate: ['invalid', 'duplicate'], wrong_period: ['invalid', 'wrong_period'], incomplete: ['invalid', 'incomplete'] };
  for (const [sc, [verdict, issue]] of Object.entries(expect)) {
    await page.locator(`input[name="scenario"][value="${sc}"]`).check();
    await page.click('[data-action="lab-run"]');
    await page.waitForSelector('[data-testid="lab-result"]');
    const r = page.locator('[data-testid="lab-result"]');
    assert.equal(await r.getAttribute('data-verdict'), verdict, sc);
    assert.equal(await r.getAttribute('data-issue'), issue, sc);
    assert.match(await text(page, '[data-testid="lab-result"]'), /Simulation/);
  }
  // Mode automatique : le nom de fichier choisit le scénario
  await page.locator('input[name="scenario"][value="auto"]').check();
  await page.fill('#lab-file', 'releve_flou.pdf');
  await page.click('[data-action="lab-run"]');
  await page.waitForSelector('[data-testid="lab-result"][data-issue="unreadable"]');
  await page.click('[data-action="lab-all"]');
  assert.equal(await rows(page, 'lab-all-table'), 6);
  // Sans période : le scénario « période incorrecte » est désactivé
  await page.selectOption('#lab-type', 'id_document');
  assert.ok(await page.locator('input[name="scenario"][value="wrong_period"]').isDisabled());
  // Message depuis le résultat
  await page.locator('input[name="scenario"][value="incomplete"]').check();
  await page.click('[data-action="lab-run"]');
  await page.click('[data-action="lab-message"]');
  assert.match(await page.inputValue('#msg-text'), /semble incomplet/);
});

await test('Assistant : langue par défaut du client, bascule FR/EN, édition, copie, validation humaine', async ({ page, go }) => {
  await go('/dossiers/DOS-007');
  await page.click('button[data-action="open-assistant"]:not([data-slot])');
  let msg = await page.locator('#msg-text').inputValue();
  assert.match(msg, /^Hello Jonas Weber,/, 'anglais par défaut pour un client anglophone');
  assert.match(msg, /• /);
  await page.click('button[data-action="msg-lang"][data-lang="fr"]');
  msg = await page.locator('#msg-text').inputValue();
  assert.match(msg, /^Bonjour Jonas Weber,/);
  assert.match(msg, /Document manquant : Déclaration de TVA|Document manquant/);
  // Décocher tout sauf « incomplet » → message à un seul point (exemple de la mission)
  for (const box of await page.locator('[data-change="msg-item"]').all()) await box.uncheck();
  await page.locator('[data-change="msg-item"]').nth(0).check();
  msg = await page.locator('#msg-text').inputValue();
  assert.match(msg, /Cependant, celui-ci semble incomplet\. Pourriez-vous nous transmettre une nouvelle version comportant toutes les pages \? Merci\./);
  // Édition manuelle
  await page.fill('#msg-text', msg + '\nP.-S. modifié à la main.');
  assert.match(await text(page, '.modal'), /Modifié/);
  // Validation humaine obligatoire
  assert.ok(await page.locator('[data-action="msg-approve"]').isDisabled(), 'approbation impossible sans relecture');
  assert.ok(await page.locator('.modal button', { hasText: 'Envoyer' }).isDisabled(), "l'envoi doit rester désactivé");
  await page.check('[data-change="msg-reviewed"]');
  assert.ok(await page.locator('[data-action="msg-approve"]').isEnabled());
  // Copie dans le presse-papiers
  await page.click('[data-action="msg-copy"]');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /P\.-S\. modifié à la main/);
  await page.click('[data-action="msg-approve"]');
  assert.match(await text(page, '.modal'), /validé par un humain — non envoyé/);
  await page.keyboard.press('Escape');
  assert.match(await text(page, '.timeline'), /validé par un humain — non envoyé/);
  // Régénérer remplace le texte
  await page.click('button[data-action="open-assistant"][data-slot="DOS-007-S4"]');
  assert.match(await page.locator('#msg-text').inputValue(), /Hello|Bonjour/);
  await page.click('[data-action="msg-generate"]');
  assert.ok(!(await text(page, '.modal')).includes('Modifié'));
});

await test('Portail client : documents, raisons de refus, dépôt fictif et progression', async ({ page, go }) => {
  await go('/portal/demo-dos-003');
  assert.match(await text(page, 'h1'), /Déclaration de TVA/);
  assert.match(await text(page, '.portal-hero'), /75%/);
  assert.equal(await page.locator('[data-testid="portal-docs"] li').count(), 4);
  assert.equal(await slotState(page, 'DOS-003-S3'), 'invalid');
  assert.match(await text(page, '[data-slot="DOS-003-S3"] .p-reason'), /flou ou trop sombre/);
  assert.match(await text(page, '[data-slot="DOS-003-S3"] .p-reason'), /rescanner/);
  // isolation : aucun autre client visible
  const body = await page.innerText('body');
  for (const other of ['Boulangerie Pain', 'Berlin Tech', 'Olivar Foods', 'Studio Lumen']) assert.ok(!body.includes(other), `fuite de données : ${other}`);
  assert.equal(await page.locator('a[href="#/clients"]').count(), 0);
  // Dépôt fictif avec scénario « incomplet »
  await page.selectOption('#portal-scenario', 'incomplete');
  await page.click('[data-slot="DOS-003-S3"] [data-action="portal-fake"]');
  await waitState(page, 'DOS-003-S3', 'analyzing');
  await waitState(page, 'DOS-003-S3', 'invalid');
  assert.match(await text(page, '[data-slot="DOS-003-S3"] .p-reason'), /Il manque des pages/);
  // Dépôt correct → dossier complet
  await page.selectOption('#portal-scenario', 'ok');
  await page.click('[data-slot="DOS-003-S3"] [data-action="portal-fake"]');
  await waitState(page, 'DOS-003-S3', 'valid');
  assert.match(await text(page, '.portal-hero'), /100%/);
  assert.match(await text(page, '.portal-hero'), /Complet/);
  assert.match(await text(page, '.portal-hero'), /tout est validé/);
  // côté cabinet : statut mis à jour
  await go('/dossiers/DOS-003');
  assert.match(await text(page, '.summary-bar'), /Complet/);
});

await test('Période annuelle : « 2025 » (et non « septembre 2025 ») dans portail et fiche dossier', async ({ page, go }) => {
  await go('/portal/demo-dos-004');
  const reason = await text(page, '[data-slot="DOS-004-S2"] .p-reason');
  assert.match(reason, /couvre 2025,/);
  assert.ok(!/septembre|octobre|novembre/.test(reason), reason);
  await go('/dossiers/DOS-004');
  assert.match(await text(page, 'tr[data-slot="DOS-004-S2"]'), /Période détectée : 2025,/);
});

await test('Portail : dépôt d’un « vrai » fichier (nom lu seulement), formats et taille refusés, EN', async ({ page, go }) => {
  await go('/portal/demo-dos-002');
  assert.equal(await slotState(page, 'DOS-002-S3'), 'missing');
  await page.setInputFiles('[data-slot="DOS-002-S3"] input[type="file"]', { name: 'factures_achats_flou.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-fake') });
  await waitState(page, 'DOS-002-S3', 'analyzing');
  await waitState(page, 'DOS-002-S3', 'invalid');
  assert.match(await text(page, '[data-slot="DOS-002-S3"]'), /factures_achats_flou\.pdf/);
  assert.match(await text(page, '[data-slot="DOS-002-S3"] .p-reason'), /flou/);
  await page.setInputFiles('[data-slot="DOS-002-S4"] input[type="file"]', { name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') });
  assert.match(await text(page, '#toast-root'), /Format non accepté/);
  assert.equal(await slotState(page, 'DOS-002-S4'), 'missing');
  await page.setInputFiles('[data-slot="DOS-002-S4"] input[type="file"]', { name: 'gros.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(11 * 1024 * 1024) });
  assert.match(await text(page, '#toast-root'), /trop volumineux/);
  assert.equal(await slotState(page, 'DOS-002-S4'), 'missing');
  await page.locator('.portal-top .seg-btn[lang="en"]').click();
  assert.match(await text(page, '[data-slot="DOS-002-S3"] .p-reason'), /blurry|dark/);
  assert.match(await text(page, '.portal-hero'), /Hello Hugo/);
  await noMissingKeys(page, 'portail EN');
});

await test('Portail : lien invalide et retour à l’espace cabinet', async ({ page, go }) => {
  await go('/portal/jeton-inexistant');
  assert.match(await text(page, '.portal-card'), /Lien invalide/);
  await go('/portal/DOS-003'); // un identifiant n'est pas un jeton
  assert.match(await text(page, '.portal-card'), /Lien invalide/);
  await page.click('.portal-top a.btn');
  assert.match(page.url(), /#\/dossiers$/);
});

await test('Tarifs : 49/99/199 € + dollars indicatifs + calculateur', async ({ page, go }) => {
  await go('/pricing');
  const plans = page.locator('.plan');
  assert.equal(await plans.count(), 3);
  const t = await text(page, '.plans');
  for (const w of ['STARTER', 'PRO', 'BUSINESS', '49', '99', '199', '53', '107', '215']) assert.ok(t.includes(w), `manque ${w}`);
  assert.match(await text(page, '.note-warn'), /Hypothèses commerciales/);
  assert.match(await text(page, '.plan-hl'), /PRO/);
  assert.match(await text(page, '[data-testid="mrr"]'), /10\s?140/);
  await page.fill('#mix-pro', '100');
  await page.fill('#mix-starter', '0');
  await page.fill('#mix-business', '0');
  assert.match(await text(page, '[data-testid="mrr"]'), /9\s?900/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mix-business', 'le focus reste dans le champ');
  await page.click('.plan-hl button');
  assert.match(await text(page, '#toast-root'), /Aucun paiement/);
  await page.locator('.topbar .seg-btn[lang="en"]').click();
  assert.match(await text(page, '.plan-hl'), /€99/);
  assert.match(await text(page, '.plan-hl'), /\$107/);
});

await test('Paramètres : validation, enregistrement, réinitialisation de la démo', async ({ page, go }) => {
  await go('/clients');
  await page.click('[data-action="new-client"]');
  await page.fill('#f-company', 'Temp SA'); await page.fill('#f-contact', 'Tmp Tmp'); await page.fill('#f-email', 'a@b.example');
  await page.click('.modal button[type="submit"]');
  await page.waitForSelector('h1 .avatar');
  await go('/settings');
  assert.ok((await page.locator('tbody tr').count()) === 8, 'feuille de route sécurité : 8 exigences');
  assert.match(await text(page, 'main'), /Non implémenté/);
  await page.fill('#s-ret', '10');
  await page.click('form[data-form="settings"] button[type="submit"]');
  assert.match(await text(page, '.err'), /entre 30 et 3650/);
  assert.equal(await page.inputValue('#s-ret'), '10');
  await page.fill('#s-ret', '730');
  await page.click('form[data-form="settings"] button[type="submit"]');
  assert.match(await text(page, '#toast-root'), /enregistrés/);
  assert.equal(await page.inputValue('#s-ret'), '730');
  await page.click('[data-action="reset-demo"]');
  await page.click('[data-action="reset-confirm"]');
  await go('/clients');
  assert.equal(await rows(page, 'clients-table'), 8);
});

await test('Navigation clavier : focus visible, modale piégée, Échap', async ({ page, go }) => {
  await go('/clients');
  await page.focus('[data-action="new-client"]');
  await page.keyboard.press('Enter');
  assert.ok(await page.locator('.modal').isVisible());
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => !!document.activeElement.closest('.modal')), 'le focus sort de la modale');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'new-client', 'focus restitué au déclencheur');
});

await test('Mobile (390 px) : menu tiroir, navigation, tableaux empilés, sans débordement', async ({ page, go }) => {
  await go('/');
  assert.ok(await page.locator('.menu-btn').isVisible());
  assert.ok(!(await page.locator('.sidebar').isVisible()), 'menu replié par défaut');
  await page.click('.menu-btn');
  assert.ok(await page.locator('.sidebar').isVisible());
  await page.locator('.sidebar a', { hasText: 'Clients' }).click();
  await page.waitForSelector('[data-testid="clients-table"]');
  await page.waitForSelector('.sidebar', { state: 'hidden', timeout: 2000 }).catch(() => { throw new Error('le tiroir reste ouvert après navigation'); });
  assert.equal(await page.locator('[data-testid="clients-table"] thead').isHidden(), true);
  assert.ok((await page.locator('[data-testid="clients-table"] td[data-label]').first().evaluate((el) => getComputedStyle(el, '::before').content)).length > 2);
  for (const r of ROUTES) { await go(r); await noOverflow(page, `${r} @390`); }
  await go('/');
  await page.click('.menu-btn');
  await page.click('.scrim', { position: { x: 360, y: 400 } });
  await page.waitForSelector('.sidebar', { state: 'hidden', timeout: 2000 }).catch(() => { throw new Error('le voile ne ferme pas le tiroir'); });
  await page.locator('.topbar .seg-btn[lang="en"]').click();
  assert.equal(await text(page, 'h1'), 'Dashboard');
}, { viewport: { width: 390, height: 844 }, mobile: true });

await test('Tablette (820 px) : pas de débordement sur toutes les pages', async ({ page, go }) => {
  for (const r of ROUTES) { await go(r); await noOverflow(page, `${r} @820`); }
}, { viewport: { width: 820, height: 1180 } });

await test('Aucune requête externe, CSP stricte, stockage local uniquement', async ({ page, go }) => {
  const resp = await page.goto(`${BASE}`);
  const csp = resp.headers()['content-security-policy'];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  await go('/');
  assert.ok(await page.evaluate(() => !!localStorage.getItem('readyfile-ai-demo')));
});

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\nRésultat : ${results.length - failed.length}/${results.length} tests end-to-end réussis${failed.length ? ` — ${failed.length} échec(s)` : ''}\n`);
process.exit(failed.length ? 1 : 0);
