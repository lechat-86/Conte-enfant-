import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import DICT from '../../growth/public/js/i18n/dict.js';
import { STATUSES, COUNTRIES, PROBLEM_TAGS, FEATURE_TAGS, METHOD_TAGS, REFUSAL_TAGS, INTEREST_TAGS, FREQUENCIES, REACTIONS, WILLINGNESS, COMMITMENT_LEVELS, ACTIVITY_KINDS } from '../../growth/public/js/domain/constants.js';
import { TEMPLATE_IDS } from '../../growth/public/js/domain/templates.js';

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('chaque entrée a un texte FR et EN non vides, avec les mêmes variables', () => {
  for (const [k, v] of Object.entries(DICT)) {
    assert.ok(Array.isArray(v) && v.length === 2, k);
    assert.ok(v[0].trim() && v[1].trim(), `vide : ${k}`);
    const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    assert.equal(ph(v[0]), ph(v[1]), `variables différentes : ${k}`);
  }
});

test('toute clé littérale t(\'…\') du code existe', () => {
  const used = new Set();
  for (const f of walk('growth/public/js').filter((p) => p.endsWith('.js') && !p.includes('/i18n/'))) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
  for (const f of walk('growth/public/js/domain')) for (const m of readFileSync(f, 'utf8').matchAll(/'(err\.[a-z_0-9]+)'/g)) used.add(m[1]);
  assert.deepEqual([...used].filter((k) => !(k in DICT)), []);
  assert.ok(used.size > 200);
});

test('familles de clés dynamiques complètes', () => {
  const keys = [
    ...STATUSES.map((x) => `status.${x}`), ...COUNTRIES.map((x) => `country.${x}`), ...PROBLEM_TAGS.map((x) => `problem.${x}`), ...FEATURE_TAGS.map((x) => `feature.${x}`),
    ...METHOD_TAGS.map((x) => `method.${x}`), ...REFUSAL_TAGS.map((x) => `refusal.${x}`), ...INTEREST_TAGS.map((x) => `interest.${x}`), ...FREQUENCIES.map((x) => `freq.${x}`),
    ...REACTIONS.map((x) => `reaction.${x}`), ...WILLINGNESS.map((x) => `will.${x}`), ...COMMITMENT_LEVELS.map((x) => `level.${x}`), ...ACTIVITY_KINDS.map((x) => `kind.${x}`),
    ...TEMPLATE_IDS.flatMap((x) => [`tplname.${x}`, `tplwhen.${x}`]),
    ...['studied', 'fr', 'en', 'demos', 'seriousIntents', 'paying'].map((x) => `goal.${x}`),
    ...['prospects', 'contacted', 'replied', 'demos', 'intents', 'paying'].map((x) => `funnel.${x}`), ...['prospects', 'messages', 'replies', 'demos'].map((x) => `series.${x}`),
    ...['overdue', 'today', 'replies', 'demos', 'unplanned'].flatMap((x) => [`rem.${x}`, `rem.${x}_hint`]),
    ...['all', 'fr', 'en', 'other'].map((x) => `segf.${x}`), ...['fr', 'en', 'other'].map((x) => `seg.${x}`), ...['all', 'overdue', 'today', 'none'].map((x) => `actf.${x}`), ...['added', 'firm', 'next', 'status'].map((x) => `sort.${x}`),
    ...['no_send', 'no_scrape', 'no_linkedin', 'no_network', 'local_only', 'no_auth', 'no_encrypt', 'gdpr'].map((x) => `limit.${x}`),
    ...['dashboard', 'prospects', 'reminders', 'templates', 'interviews', 'analysis', 'settings'].map((x) => `nav.${x}`), 'lang.fr', 'lang.en',
  ];
  assert.deepEqual(keys.filter((k) => !(k in DICT)), []);
});

test('les statuts commerciaux demandés ont exactement les libellés de la mission (FR)', () => {
  const fr = (k) => DICT[`status.${k}`][0];
  assert.deepEqual(STATUSES.map(fr), ['À rechercher', 'À contacter', 'Contacté', 'Réponse reçue', 'Entretien prévu', 'Démonstration prévue', 'Intérêt confirmé', 'Offre présentée', 'Client payant', 'Refusé', 'À recontacter']);
});
