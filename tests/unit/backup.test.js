import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildSeed } from '../../public/js/data/seed.js';
import { createStore, memoryStorage } from '../../public/js/data/store.js';
import { serializeBackup, buildBackup, parseBackup, validateState, buildCsv, csvCell, csvSeparator, CSV_COLUMNS, BACKUP_VERSION } from '../../public/js/domain/backup.js';
import { DOC_TYPE_IDS } from '../../public/js/domain/docTypes.js';
import { ISSUE_CODES } from '../../public/js/domain/rules.js';
import { buildMessage, itemsFromDossier } from '../../public/js/domain/messages.js';
import { setLang } from '../../public/js/core/i18n.js';
import fr from '../../public/js/i18n/fr.js';
import en from '../../public/js/i18n/en.js';

const NOW = new Date('2026-11-22T10:00:00Z');
const seed = () => buildSeed(NOW);
const clone = (x) => JSON.parse(JSON.stringify(x));
const wrap = (data, extra = {}) => JSON.stringify({ app: 'readyfile-ai', format: 'readyfile-ai-backup', formatVersion: 1, exportedAt: NOW.toISOString(), data, ...extra });
const bad = (data, where) => {
  const r = parseBackup(wrap(data));
  assert.equal(r.ok, false);
  assert.equal(r.error, 'invalid');
  if (where) assert.ok(r.where.startsWith(where), `où : ${r.where} (attendu ${where})`);
};

// ───────────── sauvegarde : aller-retour ─────────────

test('sauvegarde : enveloppe identifiée + données inchangées (aller-retour à l’identique)', () => {
  const state = seed();
  const text = serializeBackup(state, NOW);
  const env = JSON.parse(text);
  assert.deepEqual([env.app, env.format, env.formatVersion, env.exportedAt], ['readyfile-ai', 'readyfile-ai-backup', BACKUP_VERSION, NOW.toISOString()]);
  const r = parseBackup(text);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.state, clone(state)); // clone() = forme JSON (les champs « undefined » n'existent pas dans un fichier)
  assert.deepEqual(r.meta.counts, { clients: state.clients.length, dossiers: state.dossiers.length, events: state.events.length });
  // la sauvegarde est une copie : modifier l'état ne la modifie pas
  const b = buildBackup(state, NOW);
  state.clients[0].company = 'Modifié';
  assert.notEqual(b.data.clients[0].company, 'Modifié');
});

test('sauvegarde : le jeu de démonstration et un état modifié (relance validée, client ajouté) passent la validation', () => {
  const store = createStore({ storage: memoryStorage(), delayMs: 0, clock: () => NOW });
  store.addClient({ company: 'Café Noël & Fils', contact: 'Zoé Lefèvre', email: 'zoe@noel.example', country: 'FR', language: 'fr' });
  store.recordMessageApproved('DOS-007', { lang: 'en', count: 2 });
  const r = parseBackup(store.exportBackup());
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.state, clone(store.getState()));
  assert.equal(r.state.clients.at(-1).company, 'Café Noël & Fils'); // accents préservés
});

test('sauvegarde : un BOM UTF-8 en tête est toléré', () => {
  assert.ok(parseBackup('﻿' + serializeBackup(seed(), NOW)).ok);
});

// ───────────── validation : fichiers invalides ─────────────

test('fichiers invalides : vide, pas du JSON, trop gros', () => {
  assert.equal(parseBackup('').error, 'empty');
  assert.equal(parseBackup('   \n ').error, 'empty');
  assert.equal(parseBackup(undefined).error, 'empty');
  assert.equal(parseBackup('{pas du json').error, 'not_json');
  assert.equal(parseBackup('Bonjour, ceci est un texte').error, 'not_json');
  assert.equal(parseBackup(serializeBackup(seed(), NOW), { maxBytes: 100 }).error, 'too_large');
});

test('fichier d’une autre application (ex. sauvegarde d’un autre outil, tableau, état brut) : refusé sans toucher à rien', () => {
  const other = { version: 1, prospects: [{ id: 'P-1', name: 'Cabinet X' }], interviews: [], exportedAt: '2026-11-01' };
  assert.equal(parseBackup(JSON.stringify(other)).error, 'wrong_app');
  assert.equal(parseBackup('[1,2,3]').error, 'wrong_app');
  assert.equal(parseBackup('42').error, 'wrong_app');
  assert.equal(parseBackup('null').error, 'wrong_app');
  assert.equal(parseBackup(JSON.stringify(seed())).error, 'wrong_app'); // état brut sans enveloppe
  assert.equal(parseBackup(wrap(seed(), { app: 'autre' })).error, 'wrong_app');
});

test('version du format : plus récente → message dédié ; invalide → incohérent', () => {
  assert.equal(parseBackup(wrap(seed(), { formatVersion: 2 })).error, 'newer_version');
  assert.equal(parseBackup(wrap(seed(), { formatVersion: 'x' })).error, 'invalid');
  assert.equal(parseBackup(wrap(seed(), { formatVersion: 0 })).error, 'invalid');
});

test('données incohérentes : refusées avec l’endroit du problème', () => {
  const mut = (fn) => { const s = clone(seed()); fn(s); return s; };
  bad(null, 'data');
  bad(mut((s) => { s.version = 2; }), 'data.version');
  bad(mut((s) => { delete s.clients; }), 'data.clients');
  bad(mut((s) => { s.dossiers = 'x'; }), 'data.dossiers');
  bad(mut((s) => { s.clients[1].id = s.clients[0].id; }), 'data.clients[1].id'); // identifiant en double
  bad(mut((s) => { s.clients[0].language = 'de'; }), 'data.clients[0].language');
  bad(mut((s) => { s.clients[0].email = 42; }), 'data.clients[0].email');
  bad(mut((s) => { s.dossiers[0].clientId = 'CLI-999'; }), 'data.dossiers[0].clientId'); // client inexistant
  bad(mut((s) => { s.dossiers[0].template = 'inconnu'; }), 'data.dossiers[0].template');
  bad(mut((s) => { s.dossiers[0].period = '2026-13'; }), 'data.dossiers[0].period');
  bad(mut((s) => { s.dossiers[0].dueDate = 'pas une date'; }), 'data.dossiers[0].dueDate');
  bad(mut((s) => { s.dossiers[0].slots = []; }), 'data.dossiers[0].slots');
  bad(mut((s) => { s.dossiers[0].slots[0].type = 'zzz'; }), 'data.dossiers[0].slots[0].type');
  bad(mut((s) => { s.dossiers[1].token = s.dossiers[0].token; }), 'data.dossiers.token');
  bad(mut((s) => { s.dossiers[1].slots[0].id = s.dossiers[0].slots[0].id; }), 'data.dossiers[1].slots[0].id');
  bad(mut((s) => { s.dossiers[0].slots[0].doc.status = 'bizarre'; }), 'data.dossiers[0].slots[0].doc.status');
  bad(mut((s) => { delete s.dossiers[0].slots[0].doc.analysis; }), 'data.dossiers[0].slots[0].doc.analysis');
  bad(mut((s) => { s.dossiers[0].slots[0].doc.status = 'invalid'; }), 'data.dossiers[0].slots[0].doc.status'); // statut ≠ verdict
  bad(mut((s) => { s.events[0].type = 'envoi_email'; }), 'data.events[0].type');
  bad(mut((s) => { s.events[0].clientId = 'CLI-999'; }), 'data.events[0].clientId');
  bad(mut((s) => { s.events[1].id = s.events[0].id; }), 'data.events[1].id');
  bad(mut((s) => { s.settings.retentionDays = 5; }), 'data.settings.retentionDays');
  bad(mut((s) => { s.settings.firmName = ''; }), 'data.settings.firmName');
});

test('l’analyse d’un document invalide doit être complète (sinon l’interface planterait)', () => {
  const s = clone(seed());
  const doc = s.dossiers.flatMap((d) => d.slots).find((x) => x.doc?.status === 'invalid').doc;
  doc.analysis.details = {};
  assert.equal(validateState(s).ok, false);
});

test('clés inconnues ignorées ; __proto__ n’empoisonne rien', () => {
  const s = clone(seed());
  s.intrus = { a: 1 };
  s.settings.autre = 'x';
  const r = parseBackup(`{"app":"readyfile-ai","format":"readyfile-ai-backup","formatVersion":1,"exportedAt":"${NOW.toISOString()}","data":${JSON.stringify(s).replace('{"version"', '{"__proto__":{"pollue":true},"version"')}}`);
  assert.ok(r.ok);
  assert.equal(r.state.intrus, undefined);
  assert.equal(r.state.settings.autre, undefined);
  assert.equal({}.pollue, undefined);
  assert.equal(Object.keys(r.state).sort().join(), 'clients,dossiers,events,settings,version');
});

// ───────────── store : remplacement sûr ─────────────

const mkStore = (storage = memoryStorage()) => ({ storage, store: createStore({ storage, delayMs: 0, clock: () => NOW }) });

test('replaceState : remplace tout (sans fusion) et persiste', () => {
  const { store, storage } = mkStore();
  const other = seed();
  other.clients = other.clients.slice(0, 2);
  other.dossiers = other.dossiers.filter((d) => other.clients.some((c) => c.id === d.clientId));
  other.events = other.events.filter((e) => (!e.clientId || other.clients.some((c) => c.id === e.clientId)) && (!e.dossierId || other.dossiers.some((d) => d.id === e.dossierId)));
  store.addClient({ company: 'À perdre SAS', contact: 'Test Test', email: 't@t.example', country: 'FR', language: 'fr' });
  let notified = 0;
  store.subscribe(() => notified++);
  assert.deepEqual(store.replaceState(other), { ok: true });
  assert.equal(store.getState().clients.length, 2);
  assert.ok(!store.getState().clients.some((c) => c.company === 'À perdre SAS'), 'aucune fusion');
  assert.equal(JSON.parse(storage.getItem('readyfile-ai-demo')).clients.length, 2);
  assert.equal(notified, 1);
  // un nouveau store relit bien les données restaurées
  assert.equal(createStore({ storage, delayMs: 0, clock: () => NOW }).getState().clients.length, 2);
});

test('replaceState : état invalide → rien ne change', () => {
  const { store, storage } = mkStore();
  const before = storage.getItem('readyfile-ai-demo');
  const broken = clone(seed());
  broken.dossiers[0].clientId = 'CLI-999';
  const r = store.replaceState(broken);
  assert.deepEqual([r.ok, r.error], [false, 'invalid']);
  assert.equal(storage.getItem('readyfile-ai-demo'), before);
  assert.equal(store.getState().dossiers[0].clientId, 'CLI-001');
});

test('replaceState : stockage plein ou bloqué → échec franc et données précédentes conservées', () => {
  for (const mode of ['throws', 'silent']) {
    const mem = memoryStorage();
    const { store } = mkStore(mem);
    const before = mem.getItem('readyfile-ai-demo');
    const faulty = {
      getItem: (k) => mem.getItem(k),
      setItem: (k, v) => { if (mode === 'throws') throw new Error('QuotaExceededError'); /* silent : n'écrit rien */ },
      removeItem: (k) => mem.removeItem(k),
    };
    const s2 = createStore({ storage: faulty, delayMs: 0, clock: () => NOW });
    const next = seed();
    next.settings.firmName = 'Nouveau nom';
    const r = s2.replaceState(next);
    assert.deepEqual([r.ok, r.error], [false, 'storage'], mode);
    assert.notEqual(s2.getState().settings.firmName, 'Nouveau nom', mode);
    assert.equal(mem.getItem('readyfile-ai-demo'), before, mode);
  }
});

test('exportBackup ne modifie pas l’état et ne touche à aucune autre clé de stockage (indépendance vis-à-vis des autres outils)', () => {
  const storage = memoryStorage();
  storage.setItem('readyfile-growth-v1', 'SENTINELLE-AUTRE-OUTIL');
  const { store } = mkStore(storage);
  const before = JSON.stringify(store.getState());
  const text = store.exportBackup();
  assert.equal(JSON.stringify(store.getState()), before);
  assert.ok(!text.includes('SENTINELLE'));
  assert.ok(store.replaceState(parseBackup(text).state).ok);
  assert.equal(storage.getItem('readyfile-growth-v1'), 'SENTINELLE-AUTRE-OUTIL');
});

test('le code de sauvegarde ne référence aucun autre outil ni stockage externe', () => {
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  for (const f of walk('public/js').filter((x) => /(backup|download|settings|store)\.js$/.test(x))) {
    const txt = readFileSync(f, 'utf8');
    assert.ok(!/growth|fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|mailto:/i.test(txt), `${f} : référence interdite`);
  }
});

// ───────────── CSV ─────────────

/** Mini-lecteur CSV (RFC 4180) pour vérifier le fichier produit. */
function parseCsv(text, sep) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  assert.equal(cell + row.length, '0', 'le fichier doit se terminer par un saut de ligne');
  return rows;
}

test('CSV FR : séparateur « ; », accents, CRLF, une ligne par dossier + clients sans dossier, colonnes cohérentes', () => {
  const state = seed();
  state.clients.push({ id: 'CLI-099', company: 'Société sans dossier', contact: 'Zoé Hérault', email: 'z@h.example', country: 'FR', language: 'fr', createdAt: NOW.toISOString() });
  const csv = buildCsv(state, { lang: 'fr', now: NOW });
  assert.ok(csv.includes('\r\n') && !/[^\r]\n/.test(csv), 'fins de ligne CRLF');
  assert.ok(!csv.startsWith('﻿'), 'le BOM est ajouté au téléchargement, pas ici');
  const rows = parseCsv(csv, ';');
  assert.equal(rows.length, 1 + state.dossiers.length + 1);
  assert.ok(rows.every((r) => r.length === CSV_COLUMNS.length), 'même nombre de colonnes partout');
  assert.deepEqual(rows[0].slice(0, 3), ['Dossier', 'Société cliente', 'Contact client']);
  assert.ok(rows[0].includes('Échéance') && rows[0].includes('Documents manquants'));
  const col = (name) => rows[0].indexOf(name);
  const dos8 = rows.find((r) => r[0] === 'DOS-008');
  assert.equal(dos8[col('Société cliente')], 'Olivar Foods SL');
  assert.equal(dos8[col('Modèle')], 'Entrée en relation (KYC)');
  assert.equal(dos8[col('Statut')], 'En attente');
  assert.equal(dos8[col('En retard')], 'Oui');
  assert.match(dos8[col('Échéance')], /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dos8[col('Documents manquants (nombre)')], '3');
  assert.equal(dos8[col('Documents manquants')], "Extrait Kbis | Attestation d'assurance | Relevé bancaire");
  const dos3 = rows.find((r) => r[0] === 'DOS-003');
  assert.equal(dos3[col('Statut')], 'À corriger');
  assert.equal(dos3[col('Documents à corriger (liste)')], "Factures d'achat");
  const last = rows.at(-1);
  assert.deepEqual([last[0], last[1], last[2]], ['', 'Société sans dossier', 'Zoé Hérault']);
  assert.ok(csv.includes('é') && csv.includes('À corriger'), 'accents préservés');
});

test('CSV EN : séparateur « , », libellés anglais, mêmes données', () => {
  const csv = buildCsv(seed(), { lang: 'en', now: NOW });
  const rows = parseCsv(csv, ',');
  assert.ok(rows.every((r) => r.length === CSV_COLUMNS.length));
  assert.deepEqual(rows[0].slice(0, 3), ['File', 'Client company', 'Client contact']);
  const dos8 = rows.find((r) => r[0] === 'DOS-008');
  assert.equal(dos8[rows[0].indexOf('Status')], 'Pending');
  assert.equal(dos8[rows[0].indexOf('Overdue')], 'Yes');
  assert.match(dos8[rows[0].indexOf('Missing documents')], /^Company registration extract \| Insurance certificate \| Bank statement$/);
  assert.equal(csvSeparator('en'), ',');
  assert.equal(csvSeparator('fr'), ';');
});

test('CSV : guillemets, séparateurs et sauts de ligne protégés ; injection de formule neutralisée', () => {
  assert.equal(csvCell('Pain & Co', ';'), 'Pain & Co');
  assert.equal(csvCell('A;B', ';'), '"A;B"');
  assert.equal(csvCell('A;B', ','), 'A;B'); // « ; » n'est pas un séparateur en mode virgule
  assert.equal(csvCell('A,B', ','), '"A,B"');
  assert.equal(csvCell('Il dit "oui"', ';'), '"Il dit ""oui"""');
  assert.equal(csvCell('ligne1\nligne2', ';'), '"ligne1\nligne2"');
  assert.equal(csvCell(42, ';'), '42');
  assert.equal(csvCell(null, ';'), '');
  for (const evil of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd']) {
    assert.ok(csvCell(evil, ';').replace(/^"/, '').startsWith("'"), `non neutralisé : ${evil}`);
  }
  const state = seed();
  state.clients[0].company = '=1+1;"piège"';
  const rows = parseCsv(buildCsv(state, { lang: 'fr', now: NOW }), ';');
  assert.equal(rows.find((r) => r[0] === 'DOS-001')[1], '\'=1+1;"piège"');
});

test('CSV : toutes les colonnes ont un libellé FR et EN', () => {
  for (const c of CSV_COLUMNS) { assert.ok(fr[`csv.col.${c}`], c); assert.ok(en[`csv.col.${c}`], c); assert.notEqual(fr[`csv.col.${c}`], en[`csv.col.${c}`], c); }
});

// ───────────── correctif : parenthèses vides « () » dans les messages ─────────────

test('messages : jamais de parenthèses vides « () », pour tous les types de pièces et les deux langues', () => {
  for (const lang of ['fr', 'en']) {
    setLang(lang);
    for (const type of DOC_TYPE_IDS) {
      const items = [{ kind: 'missing', type, key: 'a' }];
      const msg = buildMessage({ lang, clientName: 'Test', firmName: 'Cabinet', period: '2026-10', items, dossierId: 'DOS-001' });
      assert.ok(!/\(\s*\)/.test(msg), `${lang}/${type} : ${msg}`);
    }
    for (const d of seed().dossiers) {
      const msg = buildMessage({ lang, clientName: 'Test', firmName: 'Cabinet', period: d.period, items: itemsFromDossier(d), dossierId: d.id, link: 'http://x/#/portal/t' });
      assert.ok(!/\(\s*\)/.test(msg), `${lang}/${d.id}`);
    }
  }
  setLang('fr');
});

test('messages : la pièce sans période n’a pas de parenthèses, la pièce mensuelle garde sa période', () => {
  setLang('fr');
  const m = (type) => buildMessage({ lang: 'fr', clientName: 'X', firmName: 'F', period: '2026-10', items: [{ kind: 'missing', type, key: 'k' }, { kind: 'missing', type: 'bank_statement', key: 'k2' }], dossierId: 'DOS-001' });
  assert.match(m('company_registration'), /• Document manquant : Extrait Kbis\./);
  assert.match(m('company_registration'), /• Document manquant : Relevé bancaire \(octobre 2026\)\./);
  setLang('en');
  assert.match(buildMessage({ lang: 'en', clientName: 'X', firmName: 'F', period: '2026-10', items: [{ kind: 'missing', type: 'id_document', key: 'k' }, { kind: 'missing', type: 'bank_statement', key: 'k2' }] }), /• Missing document: Director's ID document\./);
  setLang('fr');
});

test('i18n : clés ajoutées présentes en FR et EN, avec les mêmes paramètres', () => {
  const keys = Object.keys(fr).filter((k) => /^(backup\.|csv\.|settings\.(backup|csv)_|msg\.item\.missing_noperiod)/.test(k));
  assert.ok(keys.length > 40);
  for (const k of keys) assert.ok(en[k], `EN manquant : ${k}`);
  for (const c of ['empty', 'too_large', 'not_json', 'wrong_app', 'newer_version', 'invalid', 'read', 'storage']) assert.ok(fr[`backup.err.${c}`] && en[`backup.err.${c}`], c);
  assert.deepEqual(ISSUE_CODES.length, 5);
});
