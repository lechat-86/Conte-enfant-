import test from 'node:test';
import assert from 'node:assert/strict';
import { createDossier } from '../../public/js/domain/dossier.js';
import { lastPreparedAt, followupFor, buildFollowups, filterFollowups, countByTier, TIERS } from '../../public/js/domain/followups.js';
import { buildSeed } from '../../public/js/data/seed.js';
import { createStore, memoryStorage } from '../../public/js/data/store.js';
import fr from '../../public/js/i18n/fr.js';
import en from '../../public/js/i18n/en.js';

const NOW = new Date('2026-11-22T10:00:00Z');
const DAY = 86400000;
// états : valid | invalid | analyzing | missing ; `createdDaysAgo` fixe l'échéance (créé + 14 j)
const mk = (id, states, createdDaysAgo = 1, clientId = 'CLI-001') => {
  const d = createDossier({ id, clientId, template: 'monthly_bookkeeping', period: '2026-10', now: new Date(NOW - createdDaysAgo * DAY) });
  d.slots.forEach((s, i) => { if (states[i] && states[i] !== 'missing') s.doc = { id: `${id}-D${i}`, status: states[i] }; });
  return d;
};

test('relances : un dossier complet ou seulement « en analyse » n’est pas à relancer', () => {
  assert.equal(followupFor(mk('DOS-001', ['valid', 'valid', 'valid', 'valid']), [], NOW), null);
  assert.equal(followupFor(mk('DOS-002', ['valid', 'analyzing', 'valid', 'valid']), [], NOW), null);
  // même en retard : rien à demander au client
  assert.equal(followupFor(mk('DOS-003', ['valid', 'analyzing', 'valid', 'valid'], 40), [], NOW), null);
});

test('priorité : échéance dépassée > à corriger > manquants (le retard l’emporte)', () => {
  assert.equal(followupFor(mk('DOS-001', ['valid', 'missing', 'valid', 'valid']), [], NOW).tier, 'missing');
  assert.equal(followupFor(mk('DOS-002', ['valid', 'invalid', 'missing', 'valid']), [], NOW).tier, 'to_fix');
  const late = followupFor(mk('DOS-003', ['valid', 'invalid', 'missing', 'valid'], 20), [], NOW);
  assert.equal(late.tier, 'overdue');
  assert.deepEqual([late.invalid, late.missing, late.overdue], [1, 1, true]);
  assert.equal(late.daysLate, 6); // créé il y a 20 j, échéance à 14 j
  assert.deepEqual(TIERS, ['overdue', 'to_fix', 'missing']);
});

test('un dossier avec une pièce en analyse mais aussi une pièce manquante reste à relancer', () => {
  assert.equal(followupFor(mk('DOS-001', ['analyzing', 'missing', 'valid', 'valid']), [], NOW).tier, 'missing');
});

test('tri : priorité, puis plus en retard d’abord, puis échéance, puis identifiant', () => {
  const state = {
    events: [],
    dossiers: [
      mk('DOS-009', ['valid', 'missing', 'valid', 'valid'], 2),
      mk('DOS-008', ['valid', 'invalid', 'valid', 'valid'], 3),
      mk('DOS-007', ['missing'], 18), // 4 j de retard
      mk('DOS-006', ['missing'], 30), // 16 j de retard
      mk('DOS-005', ['valid', 'valid', 'valid', 'valid']), // complet : exclu
      mk('DOS-004', ['valid', 'missing', 'valid', 'valid'], 1),
    ],
  };
  assert.deepEqual(buildFollowups(state, NOW).map((f) => f.dossierId), ['DOS-006', 'DOS-007', 'DOS-008', 'DOS-009', 'DOS-004'].map((x) => x));
});

test('dernière relance préparée : lue dans les événements message_approved existants, par dossier', () => {
  const ev = [
    { type: 'message_approved', dossierId: 'DOS-001', at: '2026-11-10T08:00:00.000Z' },
    { type: 'message_approved', dossierId: 'DOS-001', at: '2026-11-20T09:00:00.000Z' },
    { type: 'message_approved', dossierId: 'DOS-001', at: '2026-11-15T09:00:00.000Z' },
    { type: 'message_approved', dossierId: 'DOS-002', at: '2026-11-21T09:00:00.000Z' },
    { type: 'document_received', dossierId: 'DOS-003', at: '2026-11-21T09:00:00.000Z' },
  ];
  assert.equal(lastPreparedAt(ev, 'DOS-001'), '2026-11-20T09:00:00.000Z');
  assert.equal(lastPreparedAt(ev, 'DOS-002'), '2026-11-21T09:00:00.000Z');
  assert.equal(lastPreparedAt(ev, 'DOS-003'), null); // un autre type d'événement ne compte pas
  assert.equal(lastPreparedAt(undefined, 'DOS-001'), null);
});

test('filtres : texte (client / n°), priorité, état de préparation', () => {
  const state = {
    events: [{ type: 'message_approved', dossierId: 'DOS-002', at: '2026-11-21T09:00:00.000Z' }],
    dossiers: [mk('DOS-001', ['missing'], 30, 'CLI-001'), mk('DOS-002', ['invalid'], 2, 'CLI-002'), mk('DOS-003', ['missing'], 2, 'CLI-001')],
  };
  const list = buildFollowups(state, NOW);
  const names = { 'CLI-001': 'Boulangerie Pain & Co', 'CLI-002': 'Studio Lumen SAS' };
  const name = (id) => names[id];
  const ids = (f) => filterFollowups(list, f, name).map((x) => x.dossierId);
  assert.deepEqual(ids({}), ['DOS-001', 'DOS-002', 'DOS-003']);
  assert.deepEqual(ids({ q: 'lumen' }), ['DOS-002']);
  assert.deepEqual(ids({ q: ' dos-003 ' }), ['DOS-003']);
  assert.deepEqual(ids({ tier: 'overdue' }), ['DOS-001']);
  assert.deepEqual(ids({ tier: 'missing' }), ['DOS-003']);
  assert.deepEqual(ids({ prep: 'never' }), ['DOS-001', 'DOS-003']);
  assert.deepEqual(ids({ prep: 'prepared' }), ['DOS-002']);
  assert.deepEqual(ids({ q: 'zzz' }), []);
  assert.deepEqual(countByTier(list), { overdue: 1, to_fix: 1, missing: 1 });
});

test('sur le jeu de démo : tout dossier non complet avec pièce à demander figure dans la liste, rien d’autre', () => {
  const state = buildSeed(NOW);
  const list = buildFollowups(state, NOW);
  const ids = new Set(list.map((f) => f.dossierId));
  for (const d of state.dossiers) {
    const needs = d.slots.some((s) => !s.doc || s.doc.status === 'invalid');
    assert.equal(ids.has(d.id), needs, d.id);
  }
  // ordre : les niveaux ne « remontent » jamais
  const ranks = list.map((f) => TIERS.indexOf(f.tier));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

test('intégration : approuver un message met à jour la date de dernière relance, sans changer le format des données', () => {
  const clock = () => new Date('2026-11-22T10:00:00Z');
  const store = createStore({ storage: memoryStorage(), delayMs: 0, clock });
  const target = buildFollowups(store.getState(), clock()).find((f) => !f.lastPreparedAt);
  const before = JSON.stringify(Object.keys(store.getState()).sort());
  const eventKeys = Object.keys(store.getState().events.find((e) => e.type === 'document_received')).sort(); // même forme qu'un événement de dossier existant
  assert.ok(store.recordMessageApproved(target.dossierId, { lang: 'fr', count: 1 }));
  const after = buildFollowups(store.getState(), clock()).find((f) => f.dossierId === target.dossierId);
  assert.equal(after.lastPreparedAt, clock().toISOString());
  assert.equal(JSON.stringify(Object.keys(store.getState()).sort()), before); // mêmes champs d'état
  assert.deepEqual(Object.keys(store.getState().events.at(-1)).sort().filter((k) => k !== 'at'), eventKeys.filter((k) => k !== 'at'));
});

test('i18n : toutes les clés « followups.* » existent en FR et en EN avec les mêmes paramètres', () => {
  const keys = Object.keys(fr).filter((k) => k.startsWith('followups.') || k === 'nav.followups');
  assert.ok(keys.length >= 20);
  for (const k of keys) {
    assert.ok(en[k], `EN manquant : ${k}`);
    assert.notEqual(fr[k], en[k], `FR = EN : ${k}`);
  }
});
