import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, memoryStorage, sanitizeState, KEY } from '../../growth/public/js/data/store.js';
import { ymd } from '../../growth/public/js/domain/dates.js';
import { computeStats } from '../../growth/public/js/domain/stats.js';

const clock = () => new Date(2026, 10, 17, 10, 0, 0);
const mk = (opts = {}) => { const storage = opts.storage || memoryStorage(); return { storage, store: createStore({ storage, clock, ...opts }) }; };
const P = { firm: 'Cabinet Réel', country: 'GB', sourceUrl: 'https://annuaire.example/real', status: 'to_contact', nextAction: 'Écrire', nextActionDate: '2026-11-18' };

test('démarre avec la démo (marquée demo:true) et persiste immédiatement', () => {
  const { store, storage } = mk();
  assert.equal(store.getState().prospects.length, 8);
  assert.ok(store.getState().prospects.every((p) => p.demo));
  assert.ok(storage.getItem(KEY));
  assert.ok(store.hasDemo());
});

test('ajout / modification / suppression en cascade', () => {
  const { store } = mk();
  const r = store.addProspect(P);
  assert.ok(r.ok);
  assert.equal(r.prospect.id, 'P-009');
  assert.equal(r.prospect.demo, false);
  assert.equal(r.prospect.addedAt, '2026-11-17');
  assert.equal(store.addProspect({ ...P, firm: 'x' }).ok, false);
  assert.ok(store.updateProspect('P-009', { city: 'Leeds', status: 'contacted' }).ok);
  assert.equal(store.prospect('P-009').city, 'Leeds');
  assert.ok(store.activitiesOf('P-009').some((a) => a.kind === 'status'), 'changement de statut tracé');
  store.addActivity('P-009', { kind: 'note', text: 'x' });
  store.saveInterview({ prospectId: 'P-009', date: '2026-11-17', commitmentLevel: 1 });
  assert.ok(store.deleteProspect('P-009'));
  assert.equal(store.prospect('P-009'), undefined);
  assert.equal(store.getState().activities.filter((a) => a.prospectId === 'P-009').length, 0);
  assert.equal(store.getState().interviews.filter((i) => i.prospectId === 'P-009').length, 0);
  assert.equal(store.deleteProspect('P-009'), false);
});

test('actions manuelles : « message envoyé » met à jour compteur, premier contact et statut ; rien d\'automatique', () => {
  const { store } = mk();
  const id = store.addProspect(P).prospect.id;
  const before = computeStats(store.getState()).messagesSent;
  assert.ok(store.addActivity(id, { kind: 'message_sent', text: 'Premier contact' }).ok);
  const p = store.prospect(id);
  assert.equal(computeStats(store.getState()).messagesSent, before + 1);
  assert.equal(p.firstContactAt, '2026-11-17');
  assert.equal(p.status, 'contacted');
  assert.ok(store.addActivity(id, { kind: 'reply', text: 'Répond' }).ok);
  assert.equal(store.prospect(id).status, 'replied');
  // un statut plus avancé n'est jamais rétrogradé par un nouveau message
  store.updateProspect(id, { status: 'demo_planned' });
  store.addActivity(id, { kind: 'message_sent', text: 'Confirmation' });
  assert.equal(store.prospect(id).status, 'demo_planned');
  assert.equal(store.prospect(id).firstContactAt, '2026-11-17');
  store.addActivity(id, { kind: 'demo_done', text: 'ok', status: 'interest_confirmed', nextAction: 'Proposer pilote', nextActionDate: '2026-11-25' });
  assert.equal(store.prospect(id).status, 'interest_confirmed');
  assert.equal(store.prospect(id).nextActionDate, '2026-11-25');
  assert.equal(store.addActivity(id, { kind: 'note', text: '' }).ok, false);
  assert.equal(store.addActivity('P-404', { kind: 'note', text: 'x' }).ok, false);
});

test('reporter / effacer une prochaine action', () => {
  const { store } = mk();
  assert.ok(store.snooze('P-004', '2026-11-30'));
  assert.equal(store.prospect('P-004').nextActionDate, '2026-11-30');
  assert.ok(store.clearNextAction('P-004'));
  assert.equal(store.prospect('P-004').nextAction, '');
});

test('entretiens : création, modification, suppression, validation', () => {
  const { store } = mk();
  const r = store.saveInterview({ prospectId: 'P-005', date: '2026-11-16', commitmentLevel: 3, clientsManaged: 40, competitorsCited: 'X, Y' });
  assert.ok(r.ok);
  assert.deepEqual(r.interview.competitorsCited, ['X', 'Y']);
  assert.ok(store.saveInterview({ prospectId: 'P-005', date: '2026-11-16', commitmentLevel: 4 }, r.interview.id).ok);
  assert.equal(store.interview(r.interview.id).commitmentLevel, 4);
  assert.equal(store.saveInterview({ prospectId: 'P-005', date: '2026-11-16', commitmentLevel: 5 }).ok, false);
  assert.ok(store.deleteInterview(r.interview.id));
  assert.equal(store.deleteInterview(r.interview.id), false);
});

test('objectifs modifiables et validés', () => {
  const { store } = mk();
  assert.ok(store.updateGoals({ studied: 20, fr: 12, en: 8, demos: 6, seriousIntents: 4, paying: 2 }).ok);
  assert.equal(store.getState().goals.studied, 20);
  assert.equal(store.updateGoals({ studied: -1, fr: 1, en: 1, demos: 1, seriousIntents: 1, paying: 1 }).ok, false);
  assert.equal(store.getState().goals.studied, 20);
});

test('persistance : les données survivent à un rechargement', () => {
  const { store, storage } = mk();
  store.addProspect(P);
  const again = createStore({ storage, clock });
  assert.equal(again.getState().prospects.length, 9);
  assert.equal(again.prospect('P-009').firm, 'Cabinet Réel');
});

test('stockage corrompu ou version inconnue : repli propre, sans exception', () => {
  const s1 = memoryStorage(); s1.setItem(KEY, '{pas du json');
  assert.equal(createStore({ storage: s1, clock }).getState().prospects.length, 8);
  const s2 = memoryStorage(); s2.setItem(KEY, JSON.stringify({ version: 99, prospects: [], activities: [], interviews: [] }));
  assert.equal(createStore({ storage: s2, clock }).getState().prospects.length, 8);
  const quota = { getItem: () => null, setItem() { throw new Error('quota'); }, removeItem() {} };
  assert.ok(createStore({ storage: quota, clock }).addProspect(P).ok);
});

test('sauvegarde JSON : aller-retour complet ; import invalide refusé sans rien modifier', () => {
  const a = mk();
  a.store.addProspect(P);
  a.store.addActivity('P-009', { kind: 'note', text: 'note réelle' });
  const backup = a.store.exportBackup();
  const b = mk();
  assert.ok(b.store.importBackup(backup).ok);
  assert.deepEqual(b.store.getState().prospects, a.store.getState().prospects);
  assert.deepEqual(b.store.getState().activities, a.store.getState().activities);
  const before = JSON.stringify(b.store.getState());
  assert.equal(b.store.importBackup('{pas json').error, 'err.import_json');
  assert.equal(b.store.importBackup(JSON.stringify({ version: 1, prospects: [{ id: 1 }], activities: [], interviews: [] })).error, 'err.import_schema');
  assert.equal(b.store.importBackup(JSON.stringify({ version: 2 })).error, 'err.import_schema');
  assert.equal(JSON.stringify(b.store.getState()), before, 'état inchangé après import refusé');
});

test('import : les activités/entretiens orphelins sont écartés', () => {
  const s = sanitizeState({ version: 1, prospects: [{ id: 'P-001', firm: 'A', status: 'to_contact' }], activities: [{ id: 'A', prospectId: 'P-001', at: 'x', kind: 'note' }, { id: 'B', prospectId: 'P-404', at: 'x', kind: 'note' }], interviews: [{ id: 'I', prospectId: 'P-404', date: 'x' }] });
  assert.equal(s.activities.length, 1);
  assert.equal(s.interviews.length, 0);
});

test('« Démarrer avec mes données » : supprime SEULEMENT la démo, conserve les saisies réelles et les objectifs', () => {
  const { store } = mk();
  store.addProspect(P);
  store.addActivity('P-009', { kind: 'note', text: 'réel' });
  store.updateGoals({ studied: 30, fr: 20, en: 10, demos: 8, seriousIntents: 5, paying: 2 });
  assert.equal(store.clearDemo(), 8);
  assert.equal(store.getState().prospects.length, 1);
  assert.equal(store.getState().prospects[0].firm, 'Cabinet Réel');
  assert.equal(store.getState().activities.every((a) => a.prospectId === 'P-009'), true);
  assert.equal(store.getState().interviews.length, 0);
  assert.equal(store.getState().goals.studied, 30);
  assert.equal(store.hasDemo(), false);
  assert.equal(store.loadDemo(), false, 'ne recharge pas la démo par-dessus des données réelles');
});

test('tout effacer, puis aucun KPI inventé', () => {
  const { store } = mk();
  store.resetAll();
  const s = computeStats(store.getState());
  assert.equal(s.total, 0);
  assert.deepEqual(store.getState().goals, { studied: 15, fr: 10, en: 5, demos: 5, seriousIntents: 3, paying: 1 });
  assert.ok(store.loadDemo());
});

test('architecture de sécurisation : le « codec » de chiffrement est appliqué à l\'écriture et à la lecture', () => {
  const rev = (s) => [...s].reverse().join('');
  const codec = { encode: rev, decode: rev };
  const { storage, store } = mk({ codec });
  store.addProspect(P);
  const raw = storage.getItem(KEY);
  assert.throws(() => JSON.parse(raw), 'le stockage ne contient pas de JSON en clair');
  assert.equal(createStore({ storage, codec, clock }).getState().prospects.length, 9);
});

test('abonnés notifiés ; paramètres validés', () => {
  const { store } = mk();
  let n = 0; const off = store.subscribe(() => n++);
  store.addProspect(P); off(); store.addProspect({ ...P, firm: 'Autre cabinet' });
  assert.equal(n, 1);
  store.updateSettings({ senderName: '  Sam  ', lang: 'en' });
  assert.deepEqual([store.getState().settings.senderName, store.getState().settings.lang], ['Sam', 'en']);
  store.updateSettings({ lang: 'zz' });
  assert.equal(store.getState().settings.lang, 'en');
});

test('date du jour pilotée par l\'horloge injectée', () => {
  assert.equal(ymd(clock()), '2026-11-17');
});
