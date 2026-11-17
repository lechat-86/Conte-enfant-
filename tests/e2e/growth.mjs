// Tests de bout en bout de READYFILE GROWTH (Chromium réel). Serveurs locaux dédiés, contexte vierge par test.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createGrowthServer } from '../../growth/server.js';
import { createServer as createMainServer } from '../../server.js';
import { buildSeed } from '../../growth/public/js/data/seed.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(`${execSync('npm root -g').toString().trim()}/`)('playwright')); }

const gs = createGrowthServer(); await new Promise((r) => gs.listen(0, '127.0.0.1', r));
const ms = createMainServer(); await new Promise((r) => ms.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${gs.address().port}/`;
const MAIN = `http://127.0.0.1:${ms.address().port}/`;
const browser = await chromium.launch();
const results = [];

async function test(name, fn, { viewport = { width: 1360, height: 900 }, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, permissions: ['clipboard-read', 'clipboard-write'], locale: 'fr-FR', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; const external = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:') && !(r.url().startsWith(MAIN) && ctx.__allowMain)) external.push(r.url()); });
  const go = async (hash = '/') => { await page.goto(`${BASE}#${hash}`); await page.waitForSelector('#main'); };
  try {
    await fn({ page, go, ctx, errors });
    assert.deepEqual(errors, [], `erreurs JS/console : ${errors.join(' | ')}`);
    assert.deepEqual(external, [], `requêtes externes interdites : ${external.join(', ')}`);
    results.push({ name, ok: true }); console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false }); console.log(`  ✗ ${name}\n      ${String(e.message).split('\n').slice(0, 6).join('\n      ')}`);
  } finally { await ctx.close(); }
}

const text = (page, sel) => page.locator(sel).first().innerText();
const kpi = (page, id) => page.locator(`[data-testid="${id}"] .kpi-val`).innerText();
const rows = (page, id) => page.locator(`[data-testid="${id}"] tbody tr`).count();
const noMissing = async (page, where) => assert.ok(!(await page.innerText('body')).includes('⟦'), `clé manquante : ${where}`);
const noOverflow = async (page, where) => { const px = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(px <= 1, `débordement ${px}px : ${where}`); };
const toast = (page) => text(page, '#toast-root');
const clearDemo = async (page) => { await page.goto(`${BASE}#/settings`); await page.click('[data-action="clear-demo"]'); await page.click('[data-action="clear-demo-ok"]'); await page.waitForSelector('[data-testid="demo-banner"]', { state: 'detached' }); };
const readDownload = async (dl) => (await readFile(await dl.path(), 'utf8'));
const ROUTES = ['/', '/prospects', '/prospects/P-001', '/prospects/P-001/edit', '/prospects/new', '/reminders', '/templates', '/interviews', '/interviews/new', '/interviews/I-001', '/analysis', '/settings'];
const addProspect = async (page, v) => {
  await page.goto(`${BASE}#/prospects/new`);
  await page.fill('#f-firm', v.firm); if (v.country) await page.selectOption('#f-country', v.country);
  await page.fill('#f-sourceUrl', v.source || 'https://annuaire.example/test');
  if (v.status) await page.selectOption('#f-status', v.status);
  if (v.contact) await page.fill('#f-contactName', v.contact);
  if (v.next) { await page.fill('#f-nextAction', v.next); await page.fill('#f-nextActionDate', v.date); }
  await page.click('form[data-form="prospect"] button[type="submit"]');
  await page.waitForSelector('[data-testid="next-action"]');
};

console.log('\nREADYFILE GROWTH — tests end-to-end\n');

await test('Toutes les pages (FR puis EN) : sans erreur JS, sans clé manquante, sans requête externe', async ({ page, go }) => {
  for (const lang of ['fr', 'en']) for (const r of ROUTES) {
    await go(r);
    if (lang === 'en' && (await page.locator('.topbar .seg-btn[lang="en"]').getAttribute('aria-pressed')) !== 'true') await page.locator('.topbar .seg-btn[lang="en"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.lang), lang);
    assert.ok((await page.locator('h1').first().innerText()).length > 2, r);
    await noMissing(page, `${r} ${lang}`);
  }
  await go('/inconnue'); assert.match(await text(page, 'main'), /Introuvable|Not found/);
  await go('/prospects/P-404'); assert.match(await text(page, 'main'), /existe pas|does not exist/);
});

await test('Tableau de bord : les 9 indicateurs demandés, cohérents avec les données fictives', async ({ page, go }) => {
  await go('/');
  assert.match(await text(page, '[data-testid="demo-banner"]'), /FICTIVES/);
  const expected = { 'kpi-total': '8', 'kpi-french': '5', 'kpi-english': '3', 'kpi-to-contact': '1', 'kpi-messages': '6', 'kpi-replies': '5', 'kpi-demos': '2', 'kpi-intents': '1', 'kpi-paying': '0' };
  for (const [id, v] of Object.entries(expected)) assert.equal(await kpi(page, id), v, id);
  assert.match(await text(page, '[data-testid="kpi-intents"]'), /dont 1 sérieuse/);
  assert.match(await text(page, '.note-sim'), /n’envoie rien/);
  assert.equal(await page.locator('[data-testid="funnel"] li').count(), 6);
  assert.equal(await page.locator('[data-testid="weekly"] polyline').count(), 4);
  assert.equal(await page.locator('[data-testid="goals"] li').count(), 6);
  assert.match(await text(page, '[data-testid="goals"]'), /7 \/ 15/);
  assert.equal(await text(page, '[data-testid="rem-today"]'), '2');
  assert.equal(await text(page, '[data-testid="rem-overdue"]'), '2');
  assert.match(await text(page, '[data-testid="nav-rem"]'), /^\d+$/);
  // les cartes mènent aux listes filtrées
  await page.click('[data-testid="kpi-to-contact"]'); await page.waitForSelector('[data-testid="prospects-table"]');
  assert.equal(await rows(page, 'prospects-table'), 1);
  await go('/'); await page.click('[data-testid="kpi-english"]'); await page.waitForSelector('[data-testid="prospects-table"]');
  assert.equal(await rows(page, 'prospects-table'), 3);
});

await test('Objectifs : préconfigurés 15/10/5/5/3/1, modifiables, atteints vs restants', async ({ page, go }) => {
  await go('/');
  const goal = (k) => text(page, `[data-goal="${k}"]`);
  assert.match(await goal('studied'), /7 \/ 15[\s\S]*Reste 8/);
  assert.match(await goal('fr'), /5 \/ 10/); assert.match(await goal('en'), /2 \/ 5/); assert.match(await goal('demos'), /2 \/ 5/);
  assert.match(await goal('seriousIntents'), /1 \/ 3/); assert.match(await goal('paying'), /0 \/ 1/);
  await page.click('[data-action="goals-edit"]');
  await page.fill('#g-paying', '-1'); await page.click('.modal button[type="submit"]');
  assert.match(await text(page, '.modal .err'), /Entier entre 0 et 1000/);
  await page.fill('#g-paying', '0'); await page.fill('#g-demos', '2'); await page.fill('#g-studied', '20');
  await page.click('.modal button[type="submit"]');
  assert.equal(await page.locator('.modal').count(), 0);
  assert.equal(await page.locator('[data-goal="paying"]').getAttribute('data-done'), 'true');
  assert.equal(await page.locator('[data-goal="demos"]').getAttribute('data-done'), 'true');
  assert.match(await goal('paying'), /Objectif atteint/);
  assert.match(await goal('studied'), /7 \/ 20[\s\S]*Reste 13/);
  await page.reload(); assert.match(await text(page, '[data-goal="studied"]'), /7 \/ 20/); // persistance
});

await test('« Démarrer avec mes données » : la démo disparaît, tout repart à zéro, rien n\'est inventé', async ({ page, go }) => {
  await clearDemo(page);
  await go('/');
  for (const id of ['kpi-total', 'kpi-french', 'kpi-english', 'kpi-to-contact', 'kpi-messages', 'kpi-replies', 'kpi-demos', 'kpi-intents', 'kpi-paying']) assert.equal(await kpi(page, id), '0', id);
  assert.match(await text(page, '[data-testid="goals"]'), /0 \/ 15/);
  assert.equal(await page.locator('[data-testid="demo-banner"]').count(), 0);
  await go('/prospects'); assert.match(await text(page, '.empty'), /Aucun prospect/);
  await go('/analysis'); assert.match(await text(page, '.empty'), /Pas encore d’entretien/);
  await go('/reminders'); assert.equal(await page.locator('[data-count="0"]').count(), 5);
});

await test('Prospect : création (validation, légitimité de la source), fiche, modification, XSS', async ({ page, go }) => {
  await clearDemo(page);
  await go('/prospects/new');
  await page.click('form[data-form="prospect"] button[type="submit"]');
  const errs = await page.locator('.field .err').allInnerTexts();
  assert.ok(errs.length >= 2 && errs.some((e) => /source/i.test(e)), errs.join('|'));
  await page.fill('#f-firm', '<img src=x onerror="window.__xss=1">Cabinet Test');
  await page.fill('#f-sourceUrl', 'javascript:alert(1)');
  await page.click('form[data-form="prospect"] button[type="submit"]');
  assert.match(await text(page, '#f-sourceUrl-err'), /URL invalide/);
  await page.fill('#f-sourceUrl', 'https://annuaire.example/cabinet-test');
  await page.fill('#f-contactEmail', 'jean@cabinet-test.example');
  await page.click('form[data-form="prospect"] button[type="submit"]');
  assert.match(await text(page, '.has-error'), /professionnelle et obtenue légitimement/);
  await page.check('input[name="emailLegit"]');
  await page.fill('#f-contactName', 'Jean Test'); await page.fill('#f-city', 'Lyon'); await page.fill('#f-budgetMonthly', '99');
  await page.check('input[name="problems"][value="missing_documents"]'); await page.check('input[name="problems"][value="chasing_time"]');
  await page.fill('#f-nextAction', 'Envoyer le premier message'); await page.fill('#f-nextActionDate', '2030-01-15');
  await page.selectOption('#f-status', 'to_contact');
  await page.click('form[data-form="prospect"] button[type="submit"]');
  await page.waitForSelector('[data-testid="next-action"]');
  assert.match(page.url(), /#\/prospects\/P-001$/);
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'XSS exécuté');
  assert.match(await text(page, 'h1'), /<img src=x/);
  assert.match(await text(page, 'main'), /jean@cabinet-test\.example/);
  assert.match(await text(page, 'main'), /Pièces manquantes/);
  assert.match(await text(page, 'main'), /99\s?€/);
  assert.match(await text(page, '[data-testid="next-action"]'), /Envoyer le premier message/);
  await go('/'); assert.equal(await kpi(page, 'kpi-total'), '1'); assert.equal(await kpi(page, 'kpi-to-contact'), '1');
  await page.goto(`${BASE}#/prospects/P-001/edit`);
  await page.fill('#f-city', 'Marseille'); await page.click('form[data-form="prospect"] button[type="submit"]');
  await page.waitForSelector('[data-testid="next-action"]');
  assert.match(await text(page, 'main'), /Marseille/);
  await page.reload(); assert.match(await text(page, 'h1'), /<img src=x/);
});

await test('Suppression avec confirmation (annuler conserve, confirmer supprime en cascade)', async ({ page, go }) => {
  await go('/prospects/P-001');
  await page.click('[data-action="delete-prospect"]');
  assert.match(await text(page, '.modal'), /Cabinet Exemple Alpha[\s\S]*4 action\(s\) et 1 entretien/);
  await page.click('.modal [data-action="modal-close"] >> nth=-1');
  assert.equal(await page.locator('.modal').count(), 0);
  await go('/prospects'); assert.equal(await rows(page, 'prospects-table'), 8);
  await go('/prospects/P-001'); await page.click('[data-action="delete-prospect"]'); await page.click('[data-action="confirm-delete"]');
  await page.waitForSelector('[data-testid="prospects-table"]');
  assert.equal(await rows(page, 'prospects-table'), 7);
  await go('/interviews'); assert.equal(await rows(page, 'interviews-table'), 2);
  await go('/'); assert.equal(await kpi(page, 'kpi-total'), '7'); assert.equal(await kpi(page, 'kpi-demos'), '1');
});

await test('Liste : recherche, filtres statut/pays/action, tri', async ({ page, go }) => {
  await go('/prospects');
  assert.equal(await rows(page, 'prospects-table'), 8);
  await page.fill('#p-q', 'leeds'); assert.equal(await rows(page, 'prospects-table'), 1);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'p-q', 'focus conservé');
  await page.fill('#p-q', 'zzzz'); assert.match(await text(page, '.empty'), /Aucun prospect ne correspond/);
  await page.fill('#p-q', '');
  await page.selectOption('select[data-change="p-status"]', 'contacted'); assert.equal(await rows(page, 'prospects-table'), 1);
  await page.selectOption('select[data-change="p-status"]', 'all');
  await page.selectOption('select[data-change="p-segment"]', 'fr'); assert.equal(await rows(page, 'prospects-table'), 5);
  await page.selectOption('select[data-change="p-segment"]', 'en'); assert.equal(await rows(page, 'prospects-table'), 3);
  await page.selectOption('select[data-change="p-segment"]', 'all');
  await page.selectOption('select[data-change="p-action"]', 'overdue'); assert.equal(await rows(page, 'prospects-table'), 2);
  await page.selectOption('select[data-change="p-action"]', 'today'); assert.equal(await rows(page, 'prospects-table'), 2);
  await page.selectOption('select[data-change="p-action"]', 'none'); assert.equal(await rows(page, 'prospects-table'), 2);
  await page.selectOption('select[data-change="p-action"]', 'all');
  await page.selectOption('select[data-change="p-sort"]', 'firm');
  const firms = await page.locator('[data-testid="prospects-table"] tbody tr a.strong').allInnerTexts();
  assert.deepEqual(firms, [...firms].sort((a, b) => a.localeCompare(b)));
  assert.equal(await page.locator('[data-testid="prospects-table"] tbody tr').first().locator('.b-demo').count(), 1, 'badge démo');
});

await test('Suivi manuel : message envoyé / réponse / démo / note → compteurs, statut, historique', async ({ page, go }) => {
  await clearDemo(page);
  await addProspect(page, { firm: 'Cabinet Réel', country: 'FR', status: 'to_contact' });
  assert.match(await text(page, '.timeline, main'), /Cabinet Réel/);
  await page.click('[data-action="act-open"][data-kind="message_sent"]');
  assert.match(await text(page, '.modal'), /L’outil n’envoie jamais rien/);
  await page.fill('#a-text', 'Premier message envoyé depuis ma messagerie.');
  await page.fill('#a-nextAction', 'Relancer'); await page.fill('#a-nextActionDate', '2030-02-01');
  await page.click('.modal button[type="submit"]');
  await page.waitForSelector('.modal', { state: 'detached' });
  assert.match(await text(page, 'h1 + p, .page-head .sub'), /Contacté/);
  assert.match(await text(page, '.timeline'), /Message envoyé \(manuellement\)/);
  assert.match(await text(page, '[data-testid="next-action"]'), /Relancer/);
  await page.click('[data-action="act-open"][data-kind="reply"]'); await page.fill('#a-text', 'Répond.'); await page.click('.modal button[type="submit"]');
  await page.waitForSelector('.modal', { state: 'detached' });
  assert.match(await text(page, '.page-head .sub'), /Réponse reçue/);
  await page.click('[data-action="act-open"][data-kind="demo_done"]'); await page.selectOption('#a-status', 'interest_confirmed'); await page.click('.modal button[type="submit"]');
  await page.waitForSelector('.modal', { state: 'detached' });
  assert.match(await text(page, '.page-head .sub'), /Intérêt confirmé/);
  await page.click('[data-action="act-open"][data-kind="note"]'); await page.click('.modal button[type="submit"]');
  assert.match(await text(page, '.modal .err'), /obligatoire/); await page.keyboard.press('Escape');
  await page.selectOption('select[data-change="quick-status"]', 'offer_presented');
  assert.match(await text(page, '.page-head .sub'), /Offre présentée/);
  await go('/');
  assert.equal(await kpi(page, 'kpi-messages'), '1'); assert.equal(await kpi(page, 'kpi-replies'), '1'); assert.equal(await kpi(page, 'kpi-demos'), '1'); assert.equal(await kpi(page, 'kpi-intents'), '1');
  assert.equal(await kpi(page, 'kpi-paying'), '0');
  await page.goto(`${BASE}#/prospects/P-001`); await page.selectOption('select[data-change="quick-status"]', 'paying');
  await go('/'); assert.equal(await kpi(page, 'kpi-paying'), '1'); assert.match(await text(page, '[data-goal="paying"]'), /Objectif atteint/);
});

await test('Relances : aujourd\'hui / en retard / démos / réponses ; reporter, noter, aucun envoi', async ({ page, go }) => {
  await go('/reminders');
  assert.match(await text(page, '.note-warn'), /Aucune relance n’est envoyée automatiquement/);
  const count = async (k) => Number(await page.locator(`[data-testid="rem-${k}"]`).getAttribute('data-count'));
  assert.deepEqual([await count('overdue'), await count('today'), await count('replies'), await count('demos')], [2, 2, 1, 1]);
  assert.match(await text(page, '[data-testid="rem-overdue"]'), /j de retard/);
  await page.click('[data-testid="rem-overdue"] [data-action="snooze"][data-days="3"] >> nth=0');
  assert.equal(await count('overdue'), 1);
  await page.click('[data-testid="rem-replies"] [data-action="act-open"]');
  await page.fill('#a-text', 'Appel passé : intéressée, rappeler jeudi.'); await page.click('.modal button[type="submit"]');
  await page.waitForSelector('.modal', { state: 'detached' });
  await go('/prospects/P-003'); assert.match(await text(page, '.timeline'), /rappeler jeudi/);
  assert.equal(await page.locator('[data-action*="send"], a[href^="mailto:"]').count(), 0, 'aucun contrôle d’envoi');
});

await test('Modèles : 6 × FR/EN, personnalisation, copie, enregistrement manuel de l\'envoi', async ({ page, go }) => {
  await go('/templates');
  assert.match(await text(page, '.note-warn'), /ne sait pas envoyer/);
  assert.equal(await page.locator('.tpl-item').count(), 6);
  for (const lang of ['fr', 'en']) {
    await page.click(`[data-action="tpl-lang"][data-lang="${lang}"]`);
    for (let i = 0; i < 6; i++) {
      await page.locator('.tpl-item').nth(i).click();
      const body = await page.inputValue('#tpl-body');
      assert.ok(body.length > 150 && !/⟦|\{\w+\}/.test(body), `${lang}#${i}`);
      assert.match(body, lang === 'fr' ? /Bonjour/ : /Hello/);
    }
  }
  await page.click('.tpl-item >> nth=0'); await page.click('[data-action="tpl-lang"][data-lang="fr"]');
  assert.ok(await page.locator('[data-testid="unresolved"]').isVisible());
  assert.ok(await page.locator('[data-action="tpl-log"]').isDisabled());
  await page.selectOption('#tpl-prospect', 'P-001');
  const body = await page.inputValue('#tpl-body');
  assert.match(body, /Bonjour Alice Martin,/); assert.match(body, /Cabinet Exemple Alpha/);
  assert.match(body, /ne vous écrirai plus/);
  assert.match(await text(page, '[data-testid="unresolved"]'), /\[Votre nom\]/);
  // le nom de l'expéditeur vient des paramètres
  await go('/settings'); await page.fill('#s-sender', 'Sam Fondateur'); await page.click('form[data-form="settings"] button[type="submit"]');
  await go('/templates?prospect=P-001'); assert.match(await page.inputValue('#tpl-body'), /Sam Fondateur$/);
  assert.equal(await page.locator('[data-testid="unresolved"]').count(), 0);
  // édition libre puis copie
  await page.fill('#tpl-body', (await page.inputValue('#tpl-body')) + '\nP.-S. test');
  await page.click('[data-action="tpl-copy-body"]');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /P\.-S\. test/);
  assert.match(await toast(page), /copié/);
  await page.click('[data-action="tpl-copy-subject"]');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /collecte de pièces chez Cabinet Exemple Alpha/);
  // enregistrement manuel de l'envoi
  await page.click('[data-action="tpl-log"]');
  assert.match(await page.inputValue('#a-text'), /Modèle « Premier contact » \(FR\) envoyé depuis ma messagerie/);
  assert.equal(await page.inputValue('#a-kind'), 'message_sent');
  await page.click('.modal button[type="submit"]'); await page.waitForSelector('.modal', { state: 'detached' });
  await go('/'); assert.equal(await kpi(page, 'kpi-messages'), '7');
});

await test('Entretiens : fiche complète, intérêt verbal ≠ prix accepté, niveau 5 exige un prix', async ({ page, go }) => {
  await go('/interviews/new?prospect=P-005');
  assert.equal(await page.inputValue('#i-prospectId'), 'P-005');
  await page.fill('#i-clientsManaged', '85'); await page.check('input[name="collectionMethods"][value="email"]'); await page.check('input[name="collectionMethods"][value="whatsapp"]');
  await page.fill('#i-software', 'Logiciel Z, Excel'); await page.fill('#i-hoursPerWeek', '5.5'); await page.selectOption('#i-incompleteFrequency', 'often');
  await page.check('input[name="difficulties"][value="multi_channel"]'); await page.fill('#i-competitorsCited', 'Suite Comptable X');
  await page.check('input[name="featuresWanted"][value="reminders"]'); await page.check('input[name="featuresWanted"][value="portal"]');
  await page.selectOption('#i-demoReaction', 'very_positive'); await page.selectOption('#i-testWillingness', 'yes_pilot');
  await page.fill('#i-budgetEnvisaged', '80'); await page.check('input[name="interestReasons"][value="saves_time"]');
  assert.match(await text(page, '.callout'), /ne cochez « prix accepté » que si/i);
  // très enthousiaste mais aucun engagement : niveau 0 accepté
  await page.selectOption('#i-commitmentLevel', '5');
  await page.click('form[data-form="interview"] button[type="submit"]');
  assert.match(await text(page, '.has-error'), /niveau 5 exige un prix/i);
  await page.selectOption('#i-commitmentLevel', '2');
  await page.fill('#i-priceAcceptedAmount', '99'); await page.click('form[data-form="interview"] button[type="submit"]');
  assert.match(await text(page, '.has-error'), /Cochez « prix explicitement accepté »/);
  await page.fill('#i-priceAcceptedAmount', ''); await page.fill('#i-nextStep', 'Rappeler après sa saison');
  await page.click('form[data-form="interview"] button[type="submit"]');
  await page.waitForSelector('[data-testid="next-action"]');
  assert.match(await text(page, 'main'), /Engagement[\s\S]*2[\s\S]*Réaction verbale : Très positive/);
  assert.ok(!/Prix explicitement accepté/.test(await text(page, 'main')), 'verbal très positif ≠ prix accepté');
  await go('/interviews'); assert.equal(await rows(page, 'interviews-table'), 4);
  await go('/'); assert.equal(await kpi(page, 'kpi-intents'), '1'); assert.match(await text(page, '[data-testid="kpi-intents"]'), /dont 1 sérieuse/); // l'enthousiasme verbal n'a rien ajouté
  // modification : niveau 4 avec prix explicite → intention sérieuse
  await go('/interviews'); await page.locator('[data-testid="interviews-table"] tbody tr').first().locator('a.strong').click();
  await page.selectOption('#i-commitmentLevel', '5'); await page.check('input[name="priceAcceptedExplicit"]'); await page.fill('#i-priceAcceptedAmount', '99');
  await page.click('form[data-form="interview"] button[type="submit"]'); await page.waitForSelector('[data-testid="next-action"]');
  await go('/'); assert.match(await text(page, '[data-testid="kpi-intents"]'), /dont 2 sérieuse/);
  // suppression avec confirmation
  await go('/interviews'); await page.locator('[data-testid="interviews-table"] tbody tr').first().locator('a.strong').click();
  await page.click('[data-action="delete-interview"]'); await page.click('[data-action="confirm-delete-iv"]'); await page.waitForSelector('[data-testid="interviews-table"]');
  assert.equal(await rows(page, 'interviews-table'), 3);
});

await test('Analyse : échantillon trop petit signalé, intérêt verbal vs engagement réel, comptages', async ({ page, go }) => {
  await go('/analysis');
  assert.equal(await page.locator('[data-testid="sample-note"]').getAttribute('data-sufficient'), 'false');
  assert.match(await text(page, '[data-testid="sample-note"]'), /Échantillon trop petit : 3 cabinet\(s\)[\s\S]*aucune conclusion statistique/);
  assert.match(await text(page, '[data-testid="verbal-real"]'), /2\s+réactions positives[\s\S]*1\s+engagement ≥ 3[\s\S]*1\s+engagement ≥ 4[\s\S]*1\s+prix explicitement accepté/);
  assert.equal(await rows(page, 'compare-table'), 3);
  assert.match(await text(page, '[data-testid="tally-problems"]'), /Temps passé à relancer[\s\S]*2/);
  assert.match(await text(page, '[data-testid="tally-competitors"]'), /Suite Comptable X|Cloud Accounts Y/);
  assert.match(await text(page, '[data-testid="tally-refusals"]'), /Pas une priorité/);
  assert.match(await text(page, '[data-testid="budgets"]'), /pas de médiane sous 10 valeurs/);
  assert.ok(!/%/.test(await text(page, 'main')), 'aucun pourcentage affiché');
});

await test('Analyse : avec ≥ 10 cabinets la note change et une médiane indicative apparaît', async ({ page, go, ctx }) => {
  const st = buildSeed(new Date());
  st.prospects = []; st.activities = []; st.interviews = [];
  for (let i = 1; i <= 10; i++) {
    const id = `P-${String(i).padStart(3, '0')}`;
    st.prospects.push({ id, demo: false, firm: `Cabinet ${i}`, country: i % 2 ? 'FR' : 'GB', city: '', website: '', contactName: '', contactRole: '', contactEmail: '', emailLegit: false, sourceUrl: 'https://annuaire.example/x', addedAt: '2026-11-01', firstContactAt: '', status: 'contacted', notes: '', nextAction: '', nextActionDate: '', budgetMonthly: null, problems: [], problemsText: '' });
    st.interviews.push({ id: `I-${String(i).padStart(3, '0')}`, demo: false, prospectId: id, date: '2026-11-10', clientsManaged: 10 * i, collectionMethods: ['email'], software: ['Excel'], hoursPerWeek: i, incompleteFrequency: 'often', difficulties: ['chasing_time'], difficultiesText: '', solutionsUsed: '', featuresWanted: ['portal'], budgetEnvisaged: i * 10, demoReaction: 'neutral', demoReactionText: '', testWillingness: 'maybe', priceAcceptedExplicit: false, priceAcceptedAmount: null, commitmentLevel: 0, competitorsCited: [], refusalReasons: [], interestReasons: [], nextStep: '', notes: '' });
  }
  await page.goto(`${BASE}#/settings`);
  await page.evaluate((s) => localStorage.setItem('readyfile-growth-v1', JSON.stringify(s)), st);
  await page.goto(`${BASE}#/analysis`); await page.reload(); await page.waitForSelector('[data-testid="sample-note"]');
  assert.equal(await page.locator('[data-testid="sample-note"]').getAttribute('data-sufficient'), 'true');
  assert.match(await text(page, '[data-testid="sample-note"]'), /10 cabinets avec entretien[\s\S]*pas une preuve statistique/);
  assert.match(await text(page, '[data-testid="budgets"]'), /médiane 55\s?€ \(indicatif\)/);
  assert.match(await text(page, '[data-testid="tally-problems"]'), /Temps passé à relancer[\s\S]*10/);
});

await test('Exports : CSV prospects / entretiens / notes, texte, sauvegarde JSON, protection contre l\'injection de formules', async ({ page, go }) => {
  await go('/prospects/new');
  await page.fill('#f-firm', '=HYPERLINK("http://x","clic")'); await page.fill('#f-sourceUrl', 'https://annuaire.example/inj'); await page.click('form[data-form="prospect"] button[type="submit"]');
  await page.waitForSelector('[data-testid="next-action"]');
  await go('/prospects');
  let [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-prospects"]')]);
  assert.match(dl.suggestedFilename(), /^readyfile-growth-prospects.*\.csv$/);
  let csv = await readDownload(dl);
  assert.ok(csv.startsWith('﻿id,demo,firm,country,segment,city,website,contact_name'), csv.slice(0, 60));
  assert.equal(csv.trim().split('\r\n').length, 10);
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"",""clic"")"`), 'formule neutralisée');
  await go('/interviews');
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-interviews"]')]);
  csv = await readDownload(dl); assert.equal(csv.trim().split('\r\n').length, 4); assert.match(csv, /commitment_level_0_5/);
  await go('/settings');
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-what="notes-csv"]')]);
  csv = await readDownload(dl); assert.match(csv, /id,demo,prospect_id,firm,at,kind,text/); assert.match(csv, /Appel de 10 min/);
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-what="notes-txt"]')]);
  const txt = await readDownload(dl); assert.match(txt, /notes commerciales/); assert.match(txt, /\[DÉMO\]/);
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-what="backup"]')]);
  const backup = JSON.parse(await readDownload(dl));
  assert.equal(backup.version, 1); assert.equal(backup.prospects.length, 9); assert.ok(backup.exportedAt);
});

await test('Sauvegarde JSON : restauration dans un navigateur vierge, fichier invalide refusé', async ({ page, go, ctx }) => {
  await go('/prospects/new');
  await page.fill('#f-firm', 'Cabinet À Restaurer'); await page.fill('#f-sourceUrl', 'https://annuaire.example/r'); await page.click('form[data-form="prospect"] button[type="submit"]');
  await page.waitForSelector('[data-testid="next-action"]');
  await go('/settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-what="backup"]')]);
  const file = await dl.path();
  const ctx2 = await browser.newContext({ locale: 'fr-FR' }); const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}#/settings`); await p2.waitForSelector('#main');
  await p2.setInputFiles('input[data-change="import-backup"]', file);
  await p2.waitForSelector('#toast-root .toast:has-text("Sauvegarde restaurée : 9 prospect")');
  await p2.goto(`${BASE}#/prospects`); await p2.fill('#p-q', 'restaurer'); assert.equal(await rows(p2, 'prospects-table'), 1);
  await p2.goto(`${BASE}#/settings`);
  await p2.setInputFiles('input[data-change="import-backup"]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"prospects":"nope"}') });
  await p2.waitForSelector('#toast-root .toast:has-text("pas une sauvegarde READYFILE GROWTH valide")');
  await p2.setInputFiles('input[data-change="import-backup"]', { name: 'y.json', mimeType: 'application/json', buffer: Buffer.from('pas du json') });
  await p2.waitForSelector('#toast-root .toast:has-text("illisible")');
  await p2.goto(`${BASE}#/prospects`); await p2.fill('#p-q', 'restaurer'); assert.equal(await rows(p2, 'prospects-table'), 1, 'données intactes après imports refusés');
  await ctx2.close();
});

await test('Paramètres : limites de sécurité affichées, réinitialisation confirmée', async ({ page, go }) => {
  await go('/settings');
  assert.equal(await page.locator('[data-testid="limits"] li').count(), 8);
  const t = await text(page, '[data-testid="limits"]');
  for (const w of ['Aucun envoi automatique', 'scraping', 'LinkedIn', 'Aucune connexion sortante', 'Pas d’authentification', 'chiffrement']) assert.ok(t.includes(w), w);
  await page.click('[data-action="reset-all"]'); await page.click('.modal [data-action="modal-close"] >> nth=-1');
  await go('/prospects'); assert.equal(await rows(page, 'prospects-table'), 8);
  await go('/settings'); await page.click('[data-action="reset-all"]'); await page.click('[data-action="reset-all-ok"]');
  await go('/prospects'); assert.match(await text(page, '.empty'), /Aucun prospect/);
  await go('/settings'); await page.click('[data-action="load-demo"]'); await go('/prospects'); assert.equal(await rows(page, 'prospects-table'), 8);
});

await test('Langue FR/EN à chaud (sans rechargement) et mémorisée', async ({ page, go }) => {
  await go('/prospects');
  await page.evaluate(() => { window.__m = 'same-page'; });
  assert.equal(await text(page, 'h1'), 'Prospects');
  await page.locator('.topbar .seg-btn[lang="en"]').click();
  assert.match(await text(page, '.sidebar'), /Follow-ups/); assert.match(await text(page, 'main'), /Add a prospect/);
  assert.match(await text(page, '[data-testid="prospects-table"]'), /Reply received|Demo planned|Contacted/i);
  assert.equal(await page.evaluate(() => window.__m), 'same-page');
  await page.click('.nav-link >> text=Dashboard'); await page.waitForSelector('[data-testid="funnel"]');
  assert.match(await text(page, 'main'), /Sales dashboard/); assert.match(await text(page, '[data-goal="paying"]'), /First paying customer/);
  await page.reload(); assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
});

await test('Isolation : origine distincte de READYFILE AI (stockage séparé) et rien de GROWTH côté produit', async ({ page, go, ctx }) => {
  await go('/');
  assert.ok(await page.evaluate(() => !!localStorage.getItem('readyfile-growth-v1')));
  ctx.__allowMain = true;
  const p2 = await ctx.newPage();
  await p2.goto(MAIN); await p2.waitForSelector('#app');
  assert.equal(await p2.evaluate(() => localStorage.getItem('readyfile-growth-v1')), null, 'le produit ne voit pas les données GROWTH');
  assert.ok(!(await p2.content()).match(/growth/i));
  for (const p of ['/growth/', '/growth/public/index.html', '/growth/server.js']) { const r = await p2.goto(MAIN.slice(0, -1) + p); assert.equal(r.status(), 404, p); }
  await p2.close();
  // le produit de démonstration reste intact : la présentation s'ouvre toujours
  const p3 = await ctx.newPage(); await p3.goto(MAIN); await p3.waitForSelector('.landing'); assert.match(await p3.innerText('.landing'), /Des dossiers clients complets/); await p3.close();
});

await test('Mobile (390 px) : tiroir, formulaires, tableaux empilés, aucun débordement', async ({ page, go }) => {
  await go('/');
  assert.ok(await page.locator('.menu-btn').isVisible()); assert.ok(!(await page.locator('.sidebar').isVisible()));
  await page.click('.menu-btn'); assert.ok(await page.locator('.sidebar').isVisible());
  await page.locator('.sidebar a', { hasText: 'Prospects' }).click(); await page.waitForSelector('[data-testid="prospects-table"]');
  await page.waitForSelector('.sidebar', { state: 'hidden', timeout: 2000 });
  assert.ok(await page.locator('[data-testid="prospects-table"] thead').isHidden());
  for (const r of ROUTES) { await go(r); await noOverflow(page, `${r} @390`); }
}, { viewport: { width: 390, height: 844 }, mobile: true });

await test('Tablette (820 px) : aucun débordement', async ({ page, go }) => {
  for (const r of ROUTES) { await go(r); await noOverflow(page, `${r} @820`); }
}, { viewport: { width: 820, height: 1180 } });

await browser.close(); gs.close(); ms.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nRésultat : ${results.length - failed.length}/${results.length} tests end-to-end GROWTH réussis${failed.length ? ` — ${failed.length} échec(s)` : ''}\n`);
process.exit(failed.length ? 1 : 0);
