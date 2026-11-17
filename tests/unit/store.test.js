import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, memoryStorage } from '../../public/js/data/store.js';
import { dossierStatus, completion, slotState } from '../../public/js/domain/dossier.js';

const mk = (storage = memoryStorage()) => ({ storage, store: createStore({ storage, delayMs: 0, clock: () => new Date('2026-11-17T09:00:00Z') }) });
const goodClient = { company: 'Nouvelle Société SAS', contact: 'Zoé Test', email: 'zoe@nouvelle.example', country: 'FR', language: 'en' };

test('ajout d’un client : validé, identifiant suivant, historisé', () => {
  const { store } = mk();
  const before = store.getState().clients.length;
  const r = store.addClient(goodClient);
  assert.ok(r.ok);
  assert.equal(r.client.id, 'CLI-009');
  assert.equal(store.getState().clients.length, before + 1);
  assert.equal(store.eventsFor({ clientId: 'CLI-009' })[0].type, 'client_created');
});

test('ajout d’un client invalide : rejeté, rien n’est créé', () => {
  const { store } = mk();
  const n = store.getState().clients.length;
  const r = store.addClient({ ...goodClient, email: 'nope' });
  assert.equal(r.ok, false);
  assert.equal(r.errors.email, 'err.email');
  assert.equal(store.getState().clients.length, n);
});

test('création de dossier fictif : modèle → pièces attendues, 0 % complété, statut « en attente »', () => {
  const { store } = mk();
  const r = store.addDossier({ clientId: 'CLI-001', template: 'annual_closing', period: '2026-12' });
  assert.ok(r.ok);
  assert.equal(r.dossier.id, 'DOS-013');
  assert.equal(r.dossier.slots.length, 5);
  assert.equal(completion(r.dossier), 0);
  assert.equal(dossierStatus(r.dossier), 'pending');
  assert.equal(store.addDossier({ clientId: 'CLI-404', template: 'annual_closing', period: '2026-12' }).ok, false);
});

test('dépôt : analyse en cours puis résultat simulé ; dossier complété jusqu’à « Complet »', async () => {
  const { store } = mk();
  const d = store.addDossier({ clientId: 'CLI-002', template: 'onboarding', period: '2026-11' }).dossier;
  const [s1, s2, s3, s4] = d.slots;
  const p = store.submitDocument(d.id, s1.id, { fileName: 'piece_identite.pdf' });
  assert.equal(slotState(s1), 'analyzing'); // état intermédiaire visible
  assert.equal(dossierStatus(d), 'analyzing');
  const out = await p;
  assert.equal(out.analysis.verdict, 'valid');
  assert.equal(slotState(s1), 'valid');
  assert.equal(completion(d), 25);
  await store.submitDocument(d.id, s2.id, { fileName: 'kbis_flou.pdf' });
  assert.equal(slotState(s2), 'invalid');
  assert.equal(dossierStatus(d), 'to_fix');
  // re-dépôt correct de la pièce à corriger
  await store.submitDocument(d.id, s2.id, { fileName: 'kbis_v2.pdf', scenario: 'ok' });
  assert.equal(slotState(s2), 'valid');
  assert.equal(s2.doc.attempts, 2);
  await store.submitDocument(d.id, s3.id, { fileName: 'a.pdf' });
  await store.submitDocument(d.id, s4.id, { fileName: 'b.pdf' });
  assert.equal(dossierStatus(d), 'complete');
  assert.equal(completion(d), 100);
});

test('les 6 scénarios de vérification via le store', async () => {
  const { store } = mk();
  const d = store.addDossier({ clientId: 'CLI-001', template: 'monthly_bookkeeping', period: '2026-10' }).dossier;
  const [a, b, c, e] = d.slots;
  await store.submitDocument(d.id, a.id, { fileName: 'ok.pdf', scenario: 'ok' });
  const expectIssue = async (slot, scenario, issue) => {
    await store.submitDocument(d.id, slot.id, { fileName: `f_${scenario}.pdf`, scenario });
    assert.equal(slot.doc.analysis.issue, issue, scenario);
  };
  await expectIssue(b, 'unreadable', 'unreadable');
  await expectIssue(c, 'wrong_type', 'wrong_type');
  await expectIssue(e, 'duplicate', 'duplicate');
  assert.equal(e.doc.analysis.details.duplicateOf.documentId, a.doc.id);
  await expectIssue(b, 'wrong_period', 'wrong_period');
  await expectIssue(c, 'incomplete', 'incomplete');
});

test('dépôt refusé : document déjà validé, fichier absent, emplacement inconnu', async () => {
  const { store } = mk();
  assert.equal((await store.submitDocument('DOS-001', 'DOS-001-S1', { fileName: 'x.pdf' })).error, 'already_valid');
  assert.equal((await store.submitDocument('DOS-002', 'DOS-002-S3', { fileName: '   ' })).error, 'no_file');
  assert.equal((await store.submitDocument('DOS-999', 'x', { fileName: 'x.pdf' })).error, 'not_found');
});

test('analyse d’un document en attente : idempotente, déclenchée à la demande', async () => {
  const { store } = mk();
  const slot = store.dossier('DOS-006').slots[0];
  assert.equal(slotState(slot), 'analyzing');
  const [r1, r2] = await Promise.all([store.resolveAnalysis('DOS-006', slot.id), store.resolveAnalysis('DOS-006', slot.id)]);
  assert.equal([r1, r2].filter(Boolean).length, 1, 'une seule résolution');
  assert.equal(slotState(slot), 'valid');
  assert.equal(await store.resolveAnalysis('DOS-006', slot.id), null);
});

test('persistance : l’état survit à un rechargement ; réinitialisation possible', () => {
  const storage = memoryStorage();
  const a = createStore({ storage }).addClient(goodClient);
  const s2 = createStore({ storage });
  assert.ok(s2.client(a.client.id));
  s2.resetDemo();
  assert.equal(s2.client(a.client.id), undefined);
  assert.equal(s2.getState().clients.length, 8);
});

test('stockage corrompu ou version inconnue : retour propre aux données de démonstration', () => {
  const storage = memoryStorage();
  storage.setItem('readyfile-ai-demo', '{not json');
  assert.equal(createStore({ storage }).getState().dossiers.length, 12);
  storage.setItem('readyfile-ai-demo', JSON.stringify({ version: 999, clients: [], dossiers: [] }));
  assert.equal(createStore({ storage }).getState().dossiers.length, 12);
});

test('stockage indisponible (quota) : l’application continue en mémoire', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem() {} };
  const s = createStore({ storage });
  assert.ok(s.addClient(goodClient).ok);
});

test('isolation du portail : un jeton ne donne accès qu’à son propre dossier', () => {
  const { store } = mk();
  const d = store.dossierByToken('demo-dos-003');
  assert.equal(d.id, 'DOS-003');
  assert.equal(store.dossierByToken('demo-dos-004').clientId === d.clientId, false);
  assert.equal(store.dossierByToken('demo-dos-999'), undefined);
  assert.equal(store.dossierByToken(''), undefined);
  assert.equal(store.dossierByToken('DOS-003'), undefined); // l'identifiant n'est pas un jeton
});

test('validation humaine : l’approbation est tracée sans aucun envoi', () => {
  const { store } = mk();
  assert.ok(store.recordMessageApproved('DOS-003', { lang: 'fr', count: 2 }));
  const ev = store.eventsFor({ dossierId: 'DOS-003' })[0];
  assert.equal(ev.type, 'message_approved');
  assert.equal(store.recordMessageApproved('DOS-404', { lang: 'fr', count: 1 }), false);
});

test('paramètres : validés puis persistés', () => {
  const { store } = mk();
  assert.equal(store.updateSettings({ firmName: 'X', retentionDays: 10 }).ok, false);
  assert.ok(store.updateSettings({ firmName: 'Cabinet Test', retentionDays: 365 }).ok);
  assert.equal(store.getState().settings.retentionDays, 365);
});

test('abonnés notifiés à chaque changement', () => {
  const { store } = mk();
  let n = 0;
  const off = store.subscribe(() => n++);
  store.addClient(goodClient);
  off();
  store.addClient({ ...goodClient, company: 'Autre SA' });
  assert.equal(n, 1);
});
