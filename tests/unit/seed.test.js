import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../../public/js/data/seed.js';
import { computeStats } from '../../public/js/domain/stats.js';
import { counts, dossierStatus, completion, slotState } from '../../public/js/domain/dossier.js';
import { DOC_TYPES } from '../../public/js/domain/docTypes.js';

const NOW = new Date('2026-11-17T09:00:00Z');
const seed = buildSeed(NOW);
const docs = seed.dossiers.flatMap((d) => d.slots.filter((s) => s.doc).map((s) => ({ d, s, doc: s.doc })));

test('volumes minimum exigés : 8 clients, 12 dossiers, plusieurs dizaines de documents', () => {
  assert.ok(seed.clients.length >= 8);
  assert.ok(seed.dossiers.length >= 12);
  assert.ok(docs.length >= 30, `documents reçus : ${docs.length}`);
  assert.ok(seed.dossiers.flatMap((d) => d.slots).length >= 40);
});

test('les 4 statuts de dossier sont représentés', () => {
  assert.deepEqual([...new Set(seed.dossiers.map(dossierStatus))].sort(), ['analyzing', 'complete', 'pending', 'to_fix']);
});

test('tous les cas documentaires sont présents (correct, illisible, doublon, période, type, incomplet)', () => {
  const issues = new Set(docs.map(({ doc }) => doc.analysis?.issue).filter(Boolean));
  assert.deepEqual([...issues].sort(), ['duplicate', 'incomplete', 'unreadable', 'wrong_period', 'wrong_type']);
  assert.ok(docs.some(({ doc }) => doc.status === 'valid'));
  assert.ok(docs.some(({ doc }) => doc.status === 'analyzing'));
});

test('cohérence : chaque doublon référence un vrai document du même dossier', () => {
  for (const { d, s, doc } of docs.filter(({ doc }) => doc.analysis?.issue === 'duplicate')) {
    const ref = doc.analysis.details.duplicateOf;
    const found = d.slots.find((x) => x.doc?.id === ref.documentId);
    assert.ok(found && found.id !== s.id, `doublon sans référence valide : ${s.id}`);
    assert.equal(found.doc.analysis.extraction.fingerprint, doc.analysis.extraction.fingerprint);
  }
});

test('cohérence : statut du document = verdict de son analyse ; périodes conformes aux dossiers', () => {
  for (const { doc, d, s } of docs) {
    if (doc.status === 'analyzing') { assert.equal(doc.analysis, undefined); continue; }
    assert.equal(doc.status, doc.analysis.verdict === 'valid' ? 'valid' : 'invalid');
    assert.equal(doc.analysis.details.expectedPeriod, d.period);
    assert.equal(doc.analysis.details.expectedType, s.type);
    if (doc.analysis.issue === 'wrong_period') assert.notEqual(doc.analysis.details.detectedPeriod, d.period);
  }
});

test('cohérence temporelle : dépôt après création du dossier, échéance après création', () => {
  for (const d of seed.dossiers) {
    assert.ok(new Date(d.dueDate) > new Date(d.createdAt));
    for (const s of d.slots) if (s.doc) assert.ok(new Date(s.doc.receivedAt) >= new Date(d.createdAt), `${d.id}/${s.id}`);
  }
});

test('statistiques : invariants et cohérence avec les dossiers', () => {
  const st = computeStats(seed, NOW);
  assert.equal(st.received + st.missing, st.expected);
  assert.equal(st.validated + st.incorrect + st.analyzing, st.received);
  assert.equal(st.totalDossiers, seed.dossiers.length);
  assert.equal(Object.values(st.byStatus).reduce((a, b) => a + b, 0), st.totalDossiers);
  assert.equal(st.expected, seed.dossiers.reduce((a, d) => a + counts(d).expected, 0));
  assert.equal(st.globalProgress, Math.round((st.validated / st.expected) * 100));
  assert.ok(st.weekly.reduce((a, b) => a + b, 0) <= st.received);
  assert.equal(st.weekly.length, 8);
  for (const { dossier, reasons } of st.attention) assert.ok(reasons.length && dossierStatus(dossier) !== 'complete');
  assert.ok(st.attention.length >= 3);
});

test('complétion cohérente avec les états des pièces', () => {
  for (const d of seed.dossiers) {
    const valid = d.slots.filter((s) => slotState(s) === 'valid').length;
    assert.equal(completion(d), Math.round((valid / d.slots.length) * 100));
    if (dossierStatus(d) === 'complete') assert.equal(completion(d), 100);
  }
});

test('intégrité : identifiants uniques, clients référencés, types connus', () => {
  const ids = [...seed.clients.map((c) => c.id), ...seed.dossiers.map((d) => d.id), ...docs.map(({ doc }) => doc.id), ...seed.events.map((e) => e.id)];
  assert.equal(new Set(ids).size, ids.length);
  for (const d of seed.dossiers) {
    assert.ok(seed.clients.some((c) => c.id === d.clientId));
    for (const s of d.slots) assert.ok(DOC_TYPES[s.type]);
  }
  for (const e of seed.events) assert.ok(!e.clientId || seed.clients.some((c) => c.id === e.clientId));
});

test('aucune donnée réelle : emails sur domaine réservé « .example »', () => {
  for (const c of seed.clients) assert.match(c.email, /@[a-z0-9-]+\.example$/);
});

test('la graine est déterministe pour une date donnée', () => {
  assert.deepEqual(buildSeed(NOW), seed);
});
