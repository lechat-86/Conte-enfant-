import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import fr from '../../public/js/i18n/fr.js';
import en from '../../public/js/i18n/en.js';
import { t, setLang, getLang } from '../../public/js/core/i18n.js';
import { DOC_TYPE_IDS, TEMPLATE_IDS } from '../../public/js/domain/docTypes.js';
import { ISSUE_CODES, CHECK_ORDER } from '../../public/js/domain/rules.js';
import { SCENARIOS } from '../../public/js/engine/simulated.js';
import { PLANS } from '../../public/js/domain/pricing.js';
import { STATUSES } from '../../public/js/domain/dossier.js';
import { COUNTRIES } from '../../public/js/domain/countries.js';

test('FR et EN ont exactement les mêmes clés', () => {
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
});

test('aucune traduction vide, mêmes placeholders dans les deux langues', () => {
  for (const k of Object.keys(fr)) {
    assert.ok(fr[k].trim() && en[k].trim(), `valeur vide : ${k}`);
    const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    assert.equal(ph(fr[k]), ph(en[k]), `placeholders différents : ${k}`);
  }
});

test('les textes EN ne sont pas de simples copies du FR (liste blanche des identiques légitimes)', () => {
  const same = Object.keys(fr).filter((k) => fr[k] === en[k]);
  const allowed = /^(plan\.(starter|pro|business)$|country\.|rm\.|msg\.signoff$)/;
  const identicalWords = new Set(['nav.clients', 'sim.tag', 'docstate.invalid', 'dash.clients_n', 'clients.health', 'dossier.actions', 'lab.verdict', 'lab.f_pages',
    'clients.dossiers', 'check.type', 'lab.f_fingerprint', 'clients.client', 'clients.title', 'dossiers.client', 'common.copy', 'via.email', 'dossiers.id', 'dash.w',
    'portal.title', 'dossier.message', 'assistant.message', 'lab.f_type', 'status.pending', 'status.complete', 'clients.contact']);
  const suspicious = same.filter((k) => !allowed.test(k) && !identicalWords.has(k));
  assert.deepEqual(suspicious, []);
});

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith('.js') && !p.includes('/i18n/') ? [p] : [];
  });
}

test('toute clé littérale t(\'…\') utilisée dans le code existe', () => {
  const used = new Set();
  for (const f of sourceFiles('public/js')) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
  }
  const missing = [...used].filter((k) => !(k in fr));
  assert.deepEqual(missing, []);
  assert.ok(used.size > 150, 'le scan doit trouver beaucoup de clés');
});

test('familles de clés dynamiques complètes', () => {
  const keys = [
    ...DOC_TYPE_IDS.map((x) => `doc.${x}`),
    ...TEMPLATE_IDS.map((x) => `tpl.${x}`),
    ...STATUSES.map((x) => `status.${x}`),
    ...['valid', 'invalid', 'analyzing', 'missing'].map((x) => `docstate.${x}`),
    ...ISSUE_CODES.flatMap((x) => [`issue.${x}`, `issue.${x}.pro`, `issue.${x}.client`, `issue.${x}.action`, `msg.item.${x}`, `msg.single.${x}`, `event.analysis.${x}`]),
    ...CHECK_ORDER.map((x) => `check.${x}`),
    ...['pass', 'fail', 'skipped', 'na'].map((x) => `checkstatus.${x}`),
    ...['auto', ...SCENARIOS].flatMap((x) => [`scenario.${x}`, `scenario.${x}.desc`]),
    ...PLANS.flatMap((p) => [`plan.${p.id}`, `plan.${p.id}.tag`, ...p.features.map((f) => `feat.${f}`)]),
    ...COUNTRIES.map((c) => `country.${c}`),
    ...['portal', 'email', 'manual'].map((x) => `via.${x}`),
    ...['all', 'missing', 'issues', 'ok'].map((x) => `clients.health.${x}`),
    ...['to_fix', 'overdue'].map((x) => `reason.${x}`),
    ...['encryption', 'access', 'isolation', 'deletion', 'audit_log', 'retention', 'gdpr', 'hosting'].flatMap((x) => [`rm.${x}`, `rm.${x}.target`]),
    'issue.ok.pro', 'lang.fr', 'lang.en', 'nav.dashboard', 'nav.clients', 'nav.dossiers', 'nav.analysis', 'nav.pricing', 'nav.settings',
    'event.client_created', 'event.dossier_created', 'event.document_received', 'event.analysis.ok', 'event.message_approved',
  ];
  for (const k of keys) {
    assert.ok(k in fr, `FR manquant : ${k}`);
    assert.ok(k in en, `EN manquant : ${k}`);
  }
});

test('changement de langue à chaud et marqueur de clé manquante', () => {
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(t('nav.dashboard'), 'Dashboard');
  setLang('fr');
  assert.equal(t('nav.dashboard'), 'Tableau de bord');
  assert.equal(t('nav.dashboard', {}, 'en'), 'Dashboard');
  assert.match(t('cle.inexistante'), /^⟦cle\.inexistante⟧$/);
  setLang('xx'); // langue inconnue ignorée
  assert.equal(getLang(), 'fr');
});
