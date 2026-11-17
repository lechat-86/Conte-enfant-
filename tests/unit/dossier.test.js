import test from 'node:test';
import assert from 'node:assert/strict';
import { createDossier, counts, completion, dossierStatus, needsIntervention, interventionReasons, isOverdue, nextId } from '../../public/js/domain/dossier.js';
import { TEMPLATES } from '../../public/js/domain/docTypes.js';

const mk = (states, now = new Date('2026-11-01T10:00:00Z')) => {
  const d = createDossier({ id: 'DOS-001', clientId: 'CLI-001', template: 'monthly_bookkeeping', period: '2026-10', now });
  d.slots.forEach((s, i) => { if (states[i] && states[i] !== 'missing') s.doc = { id: `D${i}`, status: states[i] }; });
  return d;
};

test('création : modèle → liste de documents attendus, aucun reçu', () => {
  const d = mk([]);
  assert.deepEqual(d.slots.map((s) => s.type), TEMPLATES.monthly_bookkeeping);
  assert.ok(d.slots.every((s) => s.doc === null));
  assert.equal(d.token, 'demo-dos-001');
  assert.equal(new Date(d.dueDate) - new Date(d.createdAt), 14 * 86400000);
  assert.throws(() => createDossier({ id: 'X', clientId: 'C', template: 'nope', period: '2026-10' }));
});

test('statuts : complet / en attente / à corriger / en cours d’analyse', () => {
  assert.equal(dossierStatus(mk(['valid', 'valid', 'valid', 'valid'])), 'complete');
  assert.equal(dossierStatus(mk(['valid', 'missing', 'valid', 'valid'])), 'pending');
  assert.equal(dossierStatus(mk(['valid', 'invalid', 'missing', 'valid'])), 'to_fix');
  assert.equal(dossierStatus(mk(['valid', 'invalid', 'analyzing', 'valid'])), 'analyzing');
  assert.equal(dossierStatus(mk([])), 'pending');
});

test('taux de complétion = validés / attendus', () => {
  assert.equal(completion(mk([])), 0);
  assert.equal(completion(mk(['valid', 'invalid', 'analyzing', 'missing'])), 25);
  assert.equal(completion(mk(['valid', 'valid', 'valid', 'valid'])), 100);
  const c = counts(mk(['valid', 'invalid', 'analyzing', 'missing']));
  assert.deepEqual(c, { expected: 4, valid: 1, invalid: 1, analyzing: 1, missing: 1, received: 3 });
});

test('intervention : document à corriger ou échéance dépassée (jamais pour un dossier complet)', () => {
  const late = new Date('2026-12-30T00:00:00Z');
  const ok = mk(['valid', 'valid', 'valid', 'valid']);
  assert.equal(needsIntervention(ok, late), false);
  const pending = mk(['valid', 'missing', 'valid', 'valid']);
  assert.equal(needsIntervention(pending, new Date('2026-11-05T00:00:00Z')), false);
  assert.deepEqual(interventionReasons(pending, late), ['overdue']);
  assert.ok(isOverdue(pending, late));
  assert.deepEqual(interventionReasons(mk(['invalid']), late), ['to_fix', 'overdue']);
});

test('identifiants séquentiels', () => {
  assert.equal(nextId('DOS', ['DOS-001', 'DOS-012', 'DOS-003']), 'DOS-013');
  assert.equal(nextId('CLI', []), 'CLI-001');
});
