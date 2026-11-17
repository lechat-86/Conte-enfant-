import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseImportFile, evaluateRecords, summarize, templateCsv, refusalReportCsv, normName, siteHost, findDuplicate, IMPORT_COLUMNS, REQUIRED_COLUMNS, REASONS, IMPORT_STATUSES, MAX_ROWS } from '../../growth/public/js/domain/importCsv.js';
import { createStore, memoryStorage } from '../../growth/public/js/data/store.js';
import { prospectsCsv } from '../../growth/public/js/domain/csv.js';
import { buildSeed } from '../../growth/public/js/data/seed.js';

const TODAY = '2026-11-17';
const clock = () => new Date(2026, 10, 17, 10, 0, 0);
const HEAD = 'firm,country,source_url,city,website,contact_name,contact_role,contact_email,email_verified,email_source_url,source_verified_on,status,next_action,next_action_date,budget_monthly_eur,notes';
const row = (o = {}) => { const d = { firm: 'Cabinet Réel', country: 'FR', source_url: 'https://annuaire.example/reel', city: 'Lyon', website: 'https://reel.example', contact_name: '', contact_role: '', contact_email: '', email_verified: '', email_source_url: '', source_verified_on: '2026-11-16', status: '', next_action: '', next_action_date: '', budget_monthly_eur: '', notes: '', ...o }; return IMPORT_COLUMNS.map((c) => /[",\n]/.test(d[c]) ? `"${d[c].replace(/"/g, '""')}"` : d[c]).join(','); };
const file = (...rows) => `${HEAD}\r\n${rows.join('\r\n')}\r\n`;
const evalFile = (text, existing = [], today = TODAY) => { const p = parseImportFile(text); assert.ok(p.ok, JSON.stringify(p)); return evaluateRecords(p.records, existing, today); };
const reasons = (rows) => rows.map((r) => r.reasons);

test('format : colonnes obligatoires et acceptées (contrat exact)', () => {
  assert.deepEqual(REQUIRED_COLUMNS, ['firm', 'country', 'source_url']);
  assert.deepEqual(IMPORT_COLUMNS, HEAD.split(','));
  assert.deepEqual(IMPORT_STATUSES, ['to_research', 'to_contact']);
  assert.equal(templateCsv(), `${HEAD}\r\n`);
  assert.ok(templateCsv().trim().split('\r\n').length === 1, 'le modèle ne contient AUCUNE ligne exemple importable');
});

test('analyseur CSV : guillemets, "" échappés, retours ligne dans un champ, CRLF/LF/CR', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","dit ""oui"""\n"l1\nl2",z'), [['a', 'b'], ['x, y', 'dit "oui"'], ['l1\nl2', 'z']]);
  assert.deepEqual(parseCsv('a;b\n1;2', ';'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,b\r\n\r\n1,2\r\n,\r\n'), [['a', 'b'], ['1', '2']], 'lignes vides ignorées');
  assert.throws(() => parseCsv('a,"non fermé'), (e) => e.code === 'unterminated_quote');
});

test('fichier : BOM, séparateur « ; », en-têtes insensibles à la casse/espaces', () => {
  const p = parseImportFile('﻿ Firm ; COUNTRY ;Source URL\n Cabinet X ;fr;https://a.example/x\n');
  assert.ok(p.ok);
  assert.deepEqual(p.header, ['firm', 'country', 'source_url']);
  assert.equal(p.records[0].raw.firm, 'Cabinet X');
  const r = evaluateRecords(p.records, [], TODAY);
  assert.equal(r[0].status, 'valid');
  assert.equal(r[0].value.country, 'FR', 'code pays normalisé');
});

test('fichier invalide : vide, colonnes obligatoires absentes, colonne en double, sans ligne, trop de lignes, trop gros', () => {
  assert.equal(parseImportFile('').error, 'empty');
  assert.equal(parseImportFile('   \n').error, 'empty');
  assert.deepEqual(parseImportFile('firm,city\nX,Y').missing, ['country', 'source_url']);
  assert.equal(parseImportFile('firm,country,source_url,firm\nA,FR,https://a.example,B').error, 'duplicate_columns');
  assert.equal(parseImportFile('firm,country,source_url\n').error, 'no_rows');
  const many = 'firm,country,source_url\n' + Array.from({ length: MAX_ROWS + 1 }, (_, i) => `F${i},FR,https://a.example/${i}`).join('\n');
  assert.equal(parseImportFile(many).error, 'too_many_rows');
  assert.equal(parseImportFile('firm,country,source_url\n' + 'x'.repeat(2_100_000)).error, 'too_large');
  assert.equal(parseImportFile('firm,country,source_url\n"A,FR').error, 'unterminated_quote');
});

test('colonnes inconnues : ignorées ET signalées (jamais importées en silence) ; id / first_contact_at / problems non acceptés', () => {
  const p = parseImportFile('id,firm,country,source_url,first_contact_at,problems,demo\nP-001,Cabinet X,FR,https://a.example,2026-01-01,missing_documents,yes\n');
  assert.deepEqual(p.ignoredColumns, ['id', 'first_contact_at', 'problems', 'demo']);
  const [r] = evaluateRecords(p.records, [], TODAY);
  assert.equal(r.status, 'valid');
  assert.ok(!('id' in r.value) && r.value.firstContactAt === '' && r.value.problems.length === 0, 'rien d\'ignoré ne passe dans le prospect');
  assert.equal(parseImportFile('line_number,firm,country,source_url,refusal_reasons,refusal_text\n2,A,FR,https://a.example,x,y\n').ignoredColumns.length, 0, 'colonnes de nos rapports tolérées');
});

test('ligne valide : tous les champs mappés, statut par défaut « à rechercher », rien d\'inventé', () => {
  const [r] = evalFile(file(row({ contact_name: 'Jean Dupont', contact_role: 'Associé', notes: 'Cabinet indépendant ; taille : non publiée', budget_monthly_eur: '99', next_action: 'Écrire', next_action_date: '2026-12-01' })));
  assert.equal(r.status, 'valid');
  assert.deepEqual(r.value, { firm: 'Cabinet Réel', country: 'FR', city: 'Lyon', website: 'https://reel.example', contactName: 'Jean Dupont', contactRole: 'Associé', contactEmail: '', emailLegit: false, emailSourceUrl: '', sourceUrl: 'https://annuaire.example/reel', sourceVerifiedAt: '2026-11-16', firstContactAt: '', status: 'to_research', notes: 'Cabinet indépendant ; taille : non publiée', nextAction: 'Écrire', nextActionDate: '2026-12-01', budgetMonthly: 99, problems: [], problemsText: '' });
});

test('champs obligatoires et URL source : chaque ligne doit en avoir une valide', () => {
  const rows = evalFile(file(row({ firm: '' }), row({ firm: 'A' }), row({ country: '' }), row({ country: 'XX' }), row({ source_url: '' }), row({ source_url: 'pas-une-url' }), row({ source_url: 'javascript:alert(1)' }), row({ source_url: 'ftp://x.example' })));
  assert.deepEqual(reasons(rows), [['invalid_firm'], ['invalid_firm'], ['invalid_country'], ['invalid_country'], ['missing_source_url'], ['invalid_source_url'], ['invalid_source_url'], ['invalid_source_url']]);
  assert.ok(rows.every((r) => r.status === 'refused' && !r.value));
});

test('e-mail : JAMAIS accepté sans vérification déclarée ET URL publique ; messageries grand public refusées', () => {
  const ok = { contact_email: 'contact@reel.example', email_verified: 'yes', email_source_url: 'https://reel.example/contact' };
  const rows = evalFile(file(
    row(ok),                                                                 // accepté
    row({ ...ok, firm: 'B Cabinet', website: 'https://b.example', email_verified: '' }),            // non vérifié
    row({ ...ok, firm: 'C Cabinet', website: 'https://c.example', email_verified: 'no' }),
    row({ ...ok, firm: 'D Cabinet', website: 'https://d.example', email_source_url: '' }),          // sans source
    row({ ...ok, firm: 'E Cabinet', website: 'https://e.example', email_source_url: 'contact' }),   // source invalide
    row({ ...ok, firm: 'F Cabinet', website: 'https://f.example', contact_email: 'jean@gmail.com' }),
    row({ ...ok, firm: 'G Cabinet', website: 'https://g.example', contact_email: 'jean@orange.fr' }),
    row({ ...ok, firm: 'H Cabinet', website: 'https://h.example', contact_email: 'pas-un-email' }),
    row({ ...ok, firm: 'I Cabinet', website: 'https://i.example', email_verified: 'OUI' }),        // « oui » accepté
  ));
  assert.deepEqual(rows.map((r) => r.status), ['valid', 'refused', 'refused', 'refused', 'refused', 'refused', 'refused', 'refused', 'valid']);
  assert.deepEqual(rows.slice(1, 8).flatMap((r) => r.reasons), ['email_unverified', 'email_unverified', 'email_source_invalid', 'email_source_invalid', 'email_free_provider', 'email_free_provider', 'invalid_email']);
  assert.equal(rows[0].value.contactEmail, 'contact@reel.example');
  assert.equal(rows[0].value.emailLegit, true);
  assert.equal(rows[0].value.emailSourceUrl, 'https://reel.example/contact', 'la provenance de l\'e-mail est conservée');
});

test('aucun e-mail n\'est jamais produit par l\'import : sans colonne e-mail → champ vide', () => {
  const rows = evalFile(file(row(), row({ firm: 'Autre cabinet', website: 'https://autre.example', email_verified: 'yes', email_source_url: 'https://autre.example/c' })));
  assert.ok(rows.every((r) => r.value.contactEmail === ''));
});

test('statut : seuls to_research / to_contact ; un import ne peut pas simuler un contact ou un client', () => {
  const rows = evalFile(file(row({ status: 'to_contact' }), row({ firm: 'B Cabinet', website: 'https://b.example', status: 'contacted' }), row({ firm: 'C Cabinet', website: 'https://c.example', status: 'paying' }), row({ firm: 'D Cabinet', website: 'https://d.example', status: 'inconnu' })));
  assert.deepEqual(rows.map((r) => r.status), ['valid', 'refused', 'refused', 'refused']);
  assert.ok(rows.slice(1).every((r) => r.reasons.includes('status_not_allowed')));
});

test('dates, budget, action : validés', () => {
  const rows = evalFile(file(row({ source_verified_on: '2026-13-01' }), row({ firm: 'B Cabinet', website: 'https://b.example', source_verified_on: '2026-12-25' }), row({ firm: 'C Cabinet', website: 'https://c.example', budget_monthly_eur: '-5' }), row({ firm: 'D Cabinet', website: 'https://d.example', next_action_date: '2026-12-01' }), row({ firm: 'E Cabinet', website: 'https://e.example', website2: 'x' })));
  assert.deepEqual(reasons(rows).slice(0, 4), [['invalid_date'], ['invalid_date'], ['invalid_budget'], ['action_needed']]);
  assert.equal(rows[4].status, 'valid');
});

test('doublons avec les prospects EXISTANTS : nom+pays, site, accents, forme juridique, casse, www — jamais d\'écrasement', () => {
  const existing = [
    { id: 'P-001', firm: 'Cabinet Exemple Alpha', country: 'FR', website: 'https://www.alpha.example/accueil' },
    { id: 'P-002', firm: 'Smith & Co Ltd', country: 'GB', website: '' },
    { id: 'P-003', firm: 'Société Générale d’Expertise SARL', country: 'FR', website: 'https://sge.example' },
  ];
  const rows = evalFile(file(
    row({ firm: 'CABINET EXEMPLE ALPHA' , website: ''}),                         // même nom, même pays
    row({ firm: 'Autre nom', website: 'http://alpha.example/contact' }),          // même site (www/http/chemin ignorés)
    row({ firm: 'Smith and Co', country: 'GB', website: '' }),                     // & = and, Ltd ignoré
    row({ firm: 'Societe Generale d Expertise', country: 'FR', website: '' }),     // accents/apostrophe/SARL
    row({ firm: 'Cabinet Exemple Alpha', country: 'GB', website: '' }),            // même nom MAIS autre pays → pas un doublon
    row({ firm: 'Nouveau Cabinet', website: 'https://nouveau.example' }),
  ), existing);
  assert.deepEqual(rows.map((r) => r.status), ['refused', 'refused', 'refused', 'refused', 'valid', 'valid']);
  assert.deepEqual(rows.slice(0, 4).map((r) => r.duplicateOf.id), ['P-001', 'P-001', 'P-002', 'P-003']);
  assert.ok(rows.slice(0, 4).every((r) => r.reasons.includes('duplicate_existing')));
});

test('doublons À L\'INTÉRIEUR du fichier : la 1ʳᵉ ligne valide est gardée, les suivantes refusées', () => {
  const rows = evalFile(file(row(), row({ source_url: 'https://autre.example/s', website: '' }), row({ firm: 'Autre', website: 'https://www.reel.example/x' }), row({ firm: 'Cabinet Réel', country: 'GB', website: '' })));
  assert.deepEqual(rows.map((r) => r.status), ['valid', 'refused', 'refused', 'valid']);
  assert.ok(rows[1].reasons.includes('duplicate_in_file') && rows[1].duplicateOf.line === 2);
  // une ligne refusée pour un autre motif ne « réserve » pas la clé
  const r2 = evalFile(file(row({ source_url: '' }), row()));
  assert.deepEqual(r2.map((r) => r.status), ['refused', 'valid']);
});

test('utilitaires de doublon', () => {
  assert.equal(normName('Cabinet  DUPONT & Associés SARL'), 'cabinet dupont and associes');
  assert.equal(normName('SARL'), 'sarl', 'un nom réduit à une forme juridique reste comparable');
  assert.equal(siteHost('https://WWW.Example.COM/a?b=1'), 'example.com');
  assert.equal(siteHost('example.com/x'), 'example.com');
  assert.equal(siteHost(''), '');
  assert.equal(findDuplicate({ firm: 'X', country: 'FR', website: '' }, []), null);
});

test('colonnes en trop / en moins (virgule non protégée) : ligne refusée plutôt que décalée', () => {
  const rows = evalFile(`${HEAD}\r\nCabinet, Dupont & Fils,FR,https://a.example/x,Lyon\r\n${row({ firm: 'OK Cabinet', website: 'https://ok.example' })}\r\n`);
  assert.deepEqual(rows.map((r) => r.status), ['refused', 'valid']);
  assert.deepEqual(rows[0].reasons, ['bad_column_count']);
});

test('injection : formules / HTML dans les champs sont conservés tels quels mais jamais interprétés (export protégé)', () => {
  const [r] = evalFile(file(row({ firm: '=HYPERLINK("http://x")', notes: '<img src=x onerror=alert(1)>' })));
  assert.equal(r.status, 'valid');
  const store = createStore({ storage: memoryStorage(), clock });
  store.getState().prospects = [];
  store.importProspects([{ line: 2, raw: r.raw, cells: r.cells }]);
  assert.ok(prospectsCsv(store.getState()).includes(`"'=HYPERLINK(""http://x"")"`));
});

test('rapport des lignes refusées : colonnes d\'origine + motifs, réimportable après correction', () => {
  const rows = evalFile(file(row(), row({ firm: '', source_url: '' }), row({ firm: 'Cabinet, "Spécial"', source_url: '', website: 'https://sp.example' })));
  const csv = refusalReportCsv(rows, (c) => `texte:${c}`);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], `line_number,${HEAD},refusal_reasons,refusal_text`);
  assert.equal(lines.length, 3, 'seulement les lignes refusées');
  assert.ok(lines[1].startsWith('3,') && lines[1].includes('invalid_firm|missing_source_url'));
  assert.ok(lines[2].includes('"Cabinet, ""Spécial"""'));
  // réimport du rapport : mêmes colonnes reconnues, aucune colonne « ignorée » de notre fait
  const re = parseImportFile(csv);
  assert.ok(re.ok);
  assert.deepEqual(re.ignoredColumns, []);
  assert.equal(refusalReportCsv(evalFile(file(row())), (c) => c).trim().split('\r\n').length, 1, 'aucun refus → en-tête seul');
});

test('résumé', () => {
  const rows = evalFile(file(row(), row({ source_url: '' }), row({ firm: 'B', website: 'https://b.example' })));
  assert.deepEqual(summarize(rows), { total: 3, valid: 1, refused: 2 });
  assert.ok(REASONS.includes('duplicate_existing') && REASONS.length === 17);
});

// ───────────── Intégrité des données : AJOUT SEUL, jamais de perte ─────────────
const snap = (st) => JSON.stringify({ prospects: st.prospects, activities: st.activities, interviews: st.interviews, goals: st.goals, settings: st.settings });
const recordsOf = (text) => parseImportFile(text).records;

test('store.importProspects : AJOUT SEUL — prospects, activités, entretiens, objectifs existants strictement inchangés', () => {
  const store = createStore({ storage: memoryStorage(), clock });
  store.addProspect({ firm: 'Prospect Réel', country: 'GB', sourceUrl: 'https://annuaire.example/pr', status: 'contacted', nextAction: 'x', nextActionDate: '2026-12-01' });
  store.addActivity('P-009', { kind: 'note', text: 'note réelle à préserver' });
  store.updateGoals({ studied: 30, fr: 20, en: 10, demos: 8, seriousIntents: 5, paying: 2 });
  const before = structuredClone(store.getState());
  const res = store.importProspects(recordsOf(file(row(), row({ firm: 'Second Cabinet', website: 'https://second.example', country: 'GB' }))), { fileName: 'test.csv' });
  const after = store.getState();
  assert.equal(res.imported.length, 2);
  assert.deepEqual(after.prospects.slice(0, before.prospects.length), before.prospects, 'prospects existants intacts, dans le même ordre');
  assert.deepEqual(after.activities.slice(0, before.activities.length), before.activities, 'activités existantes intactes');
  assert.deepEqual(after.interviews, before.interviews);
  assert.deepEqual(after.goals, before.goals);
  assert.deepEqual(after.settings, before.settings);
  assert.equal(after.prospects.length, before.prospects.length + 2);
  assert.deepEqual(res.imported, ['P-010', 'P-011'], 'identifiants à la suite, jamais réutilisés');
  const p = after.prospects.at(-1);
  assert.equal(p.demo, false); assert.equal(p.addedAt, '2026-11-17'); assert.equal(p.status, 'to_research'); assert.equal(p.firstContactAt, '');
  const act = after.activities.at(-1);
  assert.equal(act.kind, 'note'); assert.match(act.text, /Import CSV « test\.csv » — ligne 3\. Source : https:\/\/annuaire\.example\/reel|ligne 3/);
});

test('un import ne crée ni message envoyé, ni réponse, ni démo, ni client : aucun KPI commercial gonflé', async () => {
  const { computeStats } = await import('../../growth/public/js/domain/stats.js');
  const store = createStore({ storage: memoryStorage(), clock });
  const s0 = computeStats(store.getState());
  store.importProspects(recordsOf(file(row(), row({ firm: 'Deux', website: 'https://deux.example', country: 'GB', status: 'to_contact' }))));
  const s1 = computeStats(store.getState());
  assert.equal(s1.total, s0.total + 2);
  for (const k of ['messagesSent', 'repliesReceived', 'demosDone', 'intents', 'seriousIntents', 'paying']) assert.equal(s1[k], s0[k], k);
  assert.equal(s1.toContact, s0.toContact + 1);
});

test('doublon d\'un prospect existant (démo ou réel) : refusé, l\'existant n\'est PAS écrasé même si le CSV est « meilleur »', () => {
  const store = createStore({ storage: memoryStorage(), clock });
  const orig = structuredClone(store.prospect('P-001'));
  const res = store.importProspects(recordsOf(file(row({ firm: 'Cabinet Exemple Alpha', country: 'FR', city: 'AUTRE VILLE', website: '', notes: 'ÉCRASEMENT', contact_name: 'Pirate' }))));
  assert.equal(res.imported.length, 0);
  assert.equal(res.rows[0].status, 'refused');
  assert.deepEqual(store.prospect('P-001'), orig);
  assert.equal(store.getState().prospects.length, 8);
});

test('revalidation à l\'écriture : un prospect ajouté entre la prévisualisation et la confirmation est détecté (pas de doublon)', () => {
  const store = createStore({ storage: memoryStorage(), clock });
  const preview = evaluateRecords(recordsOf(file(row())), store.getState().prospects, TODAY);
  assert.equal(preview[0].status, 'valid');
  store.addProspect({ firm: 'Cabinet Réel', country: 'FR', sourceUrl: 'https://autre.example/x' });   // saisi entre-temps
  const n = store.getState().prospects.length;
  const res = store.importProspects(recordsOf(file(row())));
  assert.equal(res.imported.length, 0);
  assert.deepEqual(res.rows[0].reasons, ['duplicate_existing']);
  assert.equal(store.getState().prospects.length, n);
});

test('l\'import ne fait confiance à rien : lignes non valides refusées au moment d\'écrire, même si l\'interface les envoie', () => {
  const store = createStore({ storage: memoryStorage(), clock });
  const bad = [{ line: 2, raw: { firm: 'Sans source', country: 'FR', source_url: '', contact_email: 'invente@sanssource.example', email_verified: '', status: 'paying' }, cells: [] }, { line: 3, raw: null, cells: ['x'] }];
  const n = store.getState().prospects.length;
  const res = store.importProspects(bad);
  assert.equal(res.imported.length, 0);
  assert.equal(store.getState().prospects.length, n);
  assert.ok(res.rows[0].reasons.includes('missing_source_url') && res.rows[0].reasons.includes('email_unverified') && res.rows[0].reasons.includes('status_not_allowed'));
  assert.deepEqual(res.rows[1].reasons, ['bad_column_count']);
});

test('import partiel : seules les lignes validées sont ajoutées ; persistance ; aucune écriture si rien à ajouter', () => {
  const storage = memoryStorage();
  const store = createStore({ storage, clock });
  let emits = 0; store.subscribe(() => emits++);
  const raw0 = storage.getItem('readyfile-growth-v1');
  assert.equal(store.importProspects(recordsOf(file(row({ source_url: '' })))).imported.length, 0);
  assert.equal(emits, 0, 'aucun changement notifié'); assert.equal(storage.getItem('readyfile-growth-v1'), raw0, 'stockage octet pour octet identique');
  const res = store.importProspects(recordsOf(file(row({ source_url: '' }), row({ firm: 'Bon Cabinet', website: 'https://bon.example' }))));
  assert.equal(res.imported.length, 1); assert.equal(emits, 1);
  assert.equal(createStore({ storage, clock }).getState().prospects.length, 9, 'persisté');
});

test('la restauration JSON existante est inchangée : elle remplace toujours tout (comportement documenté), l\'import CSV jamais', () => {
  const a = createStore({ storage: memoryStorage(), clock });
  a.importProspects(recordsOf(file(row())));
  const backup = a.exportBackup();
  const b = createStore({ storage: memoryStorage(), clock });
  assert.ok(b.importBackup(backup).ok);
  assert.equal(b.getState().prospects.length, 9);
  assert.deepEqual(b.getState().prospects, a.getState().prospects, 'les champs de traçabilité survivent à l\'aller-retour JSON');
  const c = createStore({ storage: memoryStorage(), clock }); const nC = c.getState().prospects.length;
  c.importProspects(recordsOf(file(row({ firm: 'Z Cabinet', website: 'https://z.example' }))));
  assert.equal(c.getState().prospects.length, nC + 1, 'CSV : ajout');
});

test('la provenance est conservée et exportée (e-mail : URL publique ; source : date de vérification)', () => {
  const store = createStore({ storage: memoryStorage(), clock });
  store.importProspects(recordsOf(file(row({ contact_email: 'contact@reel.example', email_verified: 'yes', email_source_url: 'https://reel.example/contact' }))));
  const csv = prospectsCsv(store.getState()).trim().split('\r\n');
  assert.ok(csv[0].endsWith(',email_source_url,source_verified_on'));
  assert.ok(csv.at(-1).endsWith('https://reel.example/contact,2026-11-16'));
});

test('modifier un prospect importé depuis le formulaire conserve sa provenance', () => {
  const store = createStore({ storage: memoryStorage(), clock });
  store.importProspects(recordsOf(file(row({ contact_email: 'contact@reel.example', email_verified: 'yes', email_source_url: 'https://reel.example/contact' }))));
  assert.ok(store.updateProspect('P-009', { city: 'Marseille' }).ok);
  const p = store.prospect('P-009');
  assert.equal(p.emailSourceUrl, 'https://reel.example/contact'); assert.equal(p.sourceVerifiedAt, '2026-11-16');
});

test('données de démonstration : un fichier réaliste de 20 lignes (15 FR / 5 GB) se prévisualise sans rien créer', () => {
  const lines = [];
  for (let i = 1; i <= 15; i++) lines.push(row({ firm: `Cabinet Test FR ${i}`, country: 'FR', website: `https://fr${i}.example`, source_url: `https://annuaire.example/fr/${i}` }));
  for (let i = 1; i <= 5; i++) lines.push(row({ firm: `Test Accountants UK ${i}`, country: 'GB', website: `https://uk${i}.example`, source_url: `https://directory.example/uk/${i}` }));
  const existing = buildSeed(clock()).prospects;
  const rows = evalFile(file(...lines), existing);
  assert.deepEqual(summarize(rows), { total: 20, valid: 20, refused: 0 });
  assert.equal(existing.length, 8);
});

test('le modèle CSV versionné (docs/) est identique au modèle généré par l\'application', async () => {
  const { readFileSync } = await import('node:fs');
  assert.equal(readFileSync('docs/growth-import-template.csv', 'utf8'), templateCsv());
  assert.match(readFileSync('docs/GROWTH.md', 'utf8'), /firm,country,source_url,city,website,contact_name,contact_role,contact_email,email_verified,email_source_url,source_verified_on,status,next_action,next_action_date,budget_monthly_eur,notes/);
});
