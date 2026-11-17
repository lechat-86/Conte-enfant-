import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProspect, validateInterview, validateGoals, validateActivity, isHttpUrl } from '../../growth/public/js/domain/validation.js';
import { computeStats, goalsProgress, weeklyProgress, maxCommitment } from '../../growth/public/js/domain/stats.js';
import { computeReminders } from '../../growth/public/js/domain/reminders.js';
import { analyze } from '../../growth/public/js/domain/analysis.js';
import { csvCell, toCsv, prospectsCsv, interviewsCsv, notesCsv, notesText, PROSPECT_COLUMNS, INTERVIEW_COLUMNS } from '../../growth/public/js/domain/csv.js';
import { TEMPLATE_IDS, TEMPLATES, renderTemplate } from '../../growth/public/js/domain/templates.js';
import { DEFAULT_GOALS, STATUSES, segmentOf, MIN_SAMPLE } from '../../growth/public/js/domain/constants.js';
import { addDays, isYmd, ymd, diffDays } from '../../growth/public/js/domain/dates.js';
import { buildSeed } from '../../growth/public/js/data/seed.js';

const NOW = new Date(2026, 10, 17, 10, 0, 0);
const TODAY = ymd(NOW);
const seed = () => buildSeed(NOW);
const empty = () => ({ ...seed(), prospects: [], activities: [], interviews: [] });
const good = { firm: 'Cabinet Test', country: 'FR', sourceUrl: 'https://annuaire.example/x', status: 'to_contact' };

test('objectifs préconfigurés conformes à la mission (15 / 10 / 5 / 5 / 3 / 1)', () => {
  assert.deepEqual(DEFAULT_GOALS, { studied: 15, fr: 10, en: 5, demos: 5, seriousIntents: 3, paying: 1 });
  assert.equal(STATUSES.length, 11);
});

test('segments : France / anglophones / autres', () => {
  assert.equal(segmentOf('FR'), 'fr');
  for (const c of ['GB', 'IE', 'US', 'CA', 'AU']) assert.equal(segmentOf(c), 'en');
  for (const c of ['DE', 'ES', 'BE']) assert.equal(segmentOf(c), 'other');
});

test('dates : validation stricte, ajout de jours, écart', () => {
  assert.ok(isYmd('2026-02-28') && !isYmd('2026-02-30') && !isYmd('26-1-1') && !isYmd(''));
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-11-17', '2026-11-10'), 7);
});

test('prospect : champs obligatoires, URL source requise, e-mail avec attestation de légitimité', () => {
  assert.ok(validateProspect(good).ok);
  const bad = validateProspect({ firm: 'A', country: 'XX', sourceUrl: '' });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['country', 'firm', 'sourceUrl']);
  assert.equal(validateProspect({ ...good, sourceUrl: 'javascript:alert(1)' }).errors.sourceUrl, 'err.url');
  assert.equal(validateProspect({ ...good, website: 'ftp://x' }).errors.website, 'err.url');
  assert.equal(validateProspect({ ...good, contactEmail: 'a@b.example' }).errors.emailLegit, 'err.email_legit');
  assert.ok(validateProspect({ ...good, contactEmail: 'a@b.example', emailLegit: 'on' }).ok);
  assert.equal(validateProspect({ ...good, contactEmail: 'nope', emailLegit: 'on' }).errors.contactEmail, 'err.email');
  assert.equal(validateProspect({ ...good, nextActionDate: '2026-13-01', nextAction: 'x' }).errors.nextActionDate, 'err.date');
  assert.equal(validateProspect({ ...good, nextActionDate: '2026-11-20' }).errors.nextAction, 'err.action_needed');
  assert.equal(validateProspect({ ...good, budgetMonthly: '-5' }).errors.budgetMonthly, 'err.budget');
  assert.equal(validateProspect({ ...good, budgetMonthly: '' }).value.budgetMonthly, null);
  assert.deepEqual(validateProspect({ ...good, problems: ['chasing_time', 'inconnu', 'chasing_time'] }).value.problems, ['chasing_time']);
  assert.ok(isHttpUrl('https://a.example') && !isHttpUrl('mailto:a@b.c') && !isHttpUrl('data:text/html,x'));
});

test('entretien : intérêt verbal ≠ prix accepté ; niveau 5 exige un prix explicite chiffré', () => {
  const ps = [{ id: 'P-001' }];
  const base = { prospectId: 'P-001', date: '2026-11-10', commitmentLevel: 2 };
  assert.ok(validateInterview(base, ps).ok);
  assert.equal(validateInterview({ ...base, commitmentLevel: 5 }, ps).errors.commitmentLevel, 'err.level5_price');
  assert.ok(validateInterview({ ...base, commitmentLevel: 5, priceAcceptedExplicit: 'on', priceAcceptedAmount: '99' }, ps).ok);
  assert.equal(validateInterview({ ...base, priceAcceptedExplicit: 'on' }, ps).errors.priceAcceptedAmount, 'err.price_needed');
  assert.equal(validateInterview({ ...base, priceAcceptedAmount: '99' }, ps).errors.priceAcceptedExplicit, 'err.price_explicit');
  assert.equal(validateInterview({ ...base, prospectId: 'P-999' }, ps).errors.prospectId, 'err.required');
  assert.equal(validateInterview({ ...base, date: 'hier' }, ps).errors.date, 'err.date');
  assert.equal(validateInterview({ ...base, hoursPerWeek: '200' }, ps).errors.hoursPerWeek, 'err.hours');
  assert.equal(validateInterview({ ...base, clientsManaged: '12.5' }, ps).errors.clientsManaged, 'err.integer');
  assert.deepEqual(validateInterview({ ...base, software: 'A, B;A\nC' }, ps).value.software, ['A', 'B', 'C']);
  assert.equal(validateInterview({ ...base, commitmentLevel: 9 }, ps).errors.commitmentLevel, 'err.invalid');
});

test('objectifs et activités : validation', () => {
  assert.ok(validateGoals({ studied: 20, fr: 12, en: 8, demos: 6, seriousIntents: 4, paying: 2 }).ok);
  assert.equal(validateGoals({ ...DEFAULT_GOALS, fr: -1 }).errors.fr, 'err.goal');
  assert.equal(validateGoals({ ...DEFAULT_GOALS, paying: '' }).errors.paying, 'err.goal');
  assert.equal(validateGoals({ ...DEFAULT_GOALS, en: 2.5 }).errors.en, 'err.goal');
  assert.equal(validateActivity({ kind: 'note', text: '' }).errors.text, 'err.required');
  assert.ok(validateActivity({ kind: 'message_sent', text: '' }).ok);
  assert.equal(validateActivity({ kind: 'sms_auto', text: 'x' }).errors.kind, 'err.invalid');
});

test('statistiques : état vide = zéros partout (aucune donnée inventée)', () => {
  const s = computeStats(empty());
  for (const k of ['total', 'french', 'english', 'toContact', 'messagesSent', 'repliesReceived', 'demosDone', 'intents', 'seriousIntents', 'paying', 'studied']) assert.equal(s[k], 0, k);
  assert.ok(s.funnel.every((f) => f.value === 0));
  const g = goalsProgress(empty());
  assert.ok(Object.values(g).every((x) => x.current === 0 && !x.done && x.remaining === x.target));
  const w = weeklyProgress(empty(), TODAY);
  assert.ok(Object.values(w.series).every((arr) => arr.every((v) => v === 0)));
});

test('statistiques sur la démo : cohérence interne et invariants', () => {
  const st = seed();
  const s = computeStats(st);
  assert.equal(s.total, 8);
  assert.equal(s.french + s.english <= s.total, true);
  assert.equal(s.messagesSent, st.activities.filter((a) => a.kind === 'message_sent').length);
  assert.equal(s.repliesReceived, st.activities.filter((a) => a.kind === 'reply').length);
  assert.equal(s.demosDone, st.activities.filter((a) => a.kind === 'demo_done').length);
  const f = Object.fromEntries(s.funnel.map((x) => [x.key, x.value]));
  assert.ok(f.prospects >= f.contacted && f.contacted >= f.replied && f.replied >= f.demos, JSON.stringify(f));
  assert.ok(f.paying <= f.intents);
  assert.equal(s.seriousIntents, 1); // une seule fiche d'entretien au niveau ≥ 4
  assert.equal(maxCommitment(st, 'P-006'), 4);
});

test('intention « sérieuse » : engagement ≥ 4 ou client payant — jamais l\'intérêt verbal seul', () => {
  const st = empty();
  st.prospects.push({ id: 'P-001', firm: 'X', country: 'FR', status: 'interest_confirmed', addedAt: TODAY, problems: [] });
  st.interviews.push({ id: 'I-001', prospectId: 'P-001', date: TODAY, demoReaction: 'very_positive', commitmentLevel: 2, priceAcceptedExplicit: false });
  assert.equal(computeStats(st).intents, 1);
  assert.equal(computeStats(st).seriousIntents, 0);
  st.interviews[0].commitmentLevel = 4;
  assert.equal(computeStats(st).seriousIntents, 1);
});

test('objectifs : atteint / reste à réaliser', () => {
  const st = seed();
  st.goals = { ...DEFAULT_GOALS, paying: 0, demos: 2, studied: 7 };
  const g = goalsProgress(st);
  assert.ok(g.paying.done && g.demos.done && g.studied.done);
  assert.equal(g.fr.remaining, 10 - 5);
  assert.equal(g.seriousIntents.remaining, 2);
});

test('progression hebdomadaire : cumul croissant, 8 semaines', () => {
  const w = weeklyProgress(seed(), TODAY);
  assert.equal(w.ends.length, 8);
  for (const arr of Object.values(w.series)) for (let i = 1; i < arr.length; i++) assert.ok(arr[i] >= arr[i - 1]);
  assert.equal(w.series.prospects.at(-1), 8);
});

test('rappels : aujourd\'hui, en retard, démos, réponses ; dossiers clos exclus ; rien n\'est envoyé', () => {
  const r = computeReminders(seed(), TODAY);
  assert.deepEqual(r.today.map((p) => p.id), ['P-002', 'P-005']);
  assert.deepEqual(r.overdue.map((p) => p.id).sort(), ['P-003', 'P-004']);
  assert.deepEqual(r.demos.map((p) => p.id), ['P-001']);
  assert.deepEqual(r.replies.map((p) => p.id), ['P-003']);
  const st = seed();
  st.prospects.find((p) => p.id === 'P-004').status = 'refused';
  st.prospects.find((p) => p.id === 'P-004').nextActionDate = addDays(TODAY, -9);
  assert.ok(!computeReminders(st, TODAY).overdue.some((p) => p.id === 'P-004'), 'un prospect refusé ne génère pas de relance');
  assert.equal(r.lateDays(r.overdue.find((p) => p.id === 'P-004')), 3);
  const u = seed(); u.prospects[3].nextActionDate = '';
  assert.ok(computeReminders(u, TODAY).unplanned.some((p) => p.id === 'P-004'));
});

test('analyse : petit échantillon → comptages bruts, jamais de médiane ni de pourcentage', () => {
  const a = analyze(seed());
  assert.equal(a.n, 3);
  assert.equal(a.sufficient, false);
  assert.equal(a.budgets.median, null);
  assert.equal(a.budgets.count, 2); // le 3e entretien n'a pas de budget : jamais de valeur inventée
  assert.deepEqual([a.budgets.min, a.budgets.max], [60, 99]);
  assert.deepEqual(a.problems.find((p) => p.key === 'chasing_time').firms.sort(), ['P-001', 'P-006']);
  assert.ok(a.competitors.some((c) => c.key === 'cloud accounts y' && c.count === 1), 'un cabinet compte une seule fois par valeur');
  assert.deepEqual(a.verbalVsReal, { verbalPositive: 2, commitment3: 1, commitment4: 1, priceAccepted: 1 });
  // aucun champ de pourcentage / taux / moyenne n'est produit
  const keys = (o) => (o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => [k, ...(Array.isArray(v) ? [] : keys(v))]) : []);
  assert.deepEqual(keys({ ...a, rows: undefined }).filter((k) => /percent|pct|rate|ratio|average|mean/i.test(k)), []);
});

test('analyse : échantillon suffisant → médiane indicative', () => {
  const st = empty();
  for (let i = 1; i <= MIN_SAMPLE; i++) {
    const id = `P-${String(i).padStart(3, '0')}`;
    st.prospects.push({ id, firm: `F${i}`, country: 'FR', status: 'contacted', addedAt: TODAY, problems: [], budgetMonthly: null });
    st.interviews.push({ id: `I-${i}`, prospectId: id, date: TODAY, difficulties: [], featuresWanted: ['portal'], software: ['Excel'], competitorsCited: [], refusalReasons: [], interestReasons: [], budgetEnvisaged: i * 10, demoReaction: 'neutral', commitmentLevel: 0, priceAcceptedExplicit: false });
  }
  const a = analyze(st);
  assert.ok(a.sufficient);
  assert.equal(a.budgets.median, 55);
  assert.equal(a.features[0].count, 10);
});

test('analyse : les valeurs libres sont normalisées (casse/espaces) et comptées une fois par cabinet', () => {
  const st = empty();
  st.prospects.push({ id: 'P-001', firm: 'A', country: 'FR', status: 'contacted', addedAt: TODAY, problems: [] }, { id: 'P-002', firm: 'B', country: 'FR', status: 'contacted', addedAt: TODAY, problems: [] });
  const iv = (id, p, soft) => ({ id, prospectId: p, date: TODAY, difficulties: [], featuresWanted: [], software: soft, competitorsCited: [], refusalReasons: [], interestReasons: [], demoReaction: 'unknown', commitmentLevel: 0 });
  st.interviews.push(iv('I-1', 'P-001', ['Logiciel  X', 'logiciel x']), iv('I-2', 'P-001', ['LOGICIEL X']), iv('I-3', 'P-002', ['logiciel x']));
  assert.equal(analyze(st).software[0].count, 2);
});

test('CSV : guillemets, virgules, retours ligne, injection de formules neutralisée', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('dit "oui"'), '"dit ""oui"""');
  assert.equal(csvCell('l1\nl2'), '"l1\nl2"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(['x', 'y']), 'x | y');
  for (const evil of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=x']) assert.ok(csvCell(evil).startsWith("'") || csvCell(evil).startsWith('"\''), evil);
  assert.equal(toCsv(['a', 'b'], [[1, 2]]), 'a,b\r\n1,2\r\n');
});

test('exports CSV : en-têtes stables, une ligne par enregistrement, colonne « demo »', () => {
  const st = seed();
  const parse = (csv) => csv.trim().split('\r\n');
  const p = parse(prospectsCsv(st));
  assert.equal(p.length, 1 + st.prospects.length);
  assert.equal(p[0], PROSPECT_COLUMNS.join(','));
  assert.ok(p[1].includes('yes'));
  assert.equal(parse(interviewsCsv(st)).length, 1 + st.interviews.length);
  assert.equal(parse(interviewsCsv(st))[0], INTERVIEW_COLUMNS.join(','));
  assert.ok(notesCsv(st).split('\r\n')[0].startsWith('id,demo,prospect_id'));
  st.prospects[0].firm = '=HYPERLINK("http://x")';
  assert.ok(prospectsCsv(st).includes(`"'=HYPERLINK`));
  const txt = notesText(st);
  assert.ok(txt.includes('confidentiel') && txt.includes('[DÉMO]') && txt.includes('Appel de 10 min'));
});

test('modèles : 6 types × 2 langues, courts, sans variable non résolue, avec possibilité de refus', () => {
  assert.deepEqual(TEMPLATE_IDS, ['first_contact', 'interview_request', 'demo_proposal', 'thanks_after_interview', 'follow_up', 'post_demo_feedback']);
  for (const id of TEMPLATE_IDS) for (const lang of ['fr', 'en']) {
    const r = renderTemplate(id, lang, { contact: 'Alice Martin', firm: 'Cabinet Alpha', sender: 'Sam' });
    assert.ok(!/\{\w+\}/.test(r.subject + r.body), `${id}/${lang} : variable non résolue`);
    assert.deepEqual(r.unresolved, []);
    assert.ok(r.body.includes('Alice Martin') && r.body.endsWith('Sam'), `${id}/${lang}`);
    assert.ok(r.body.split(/\s+/).length < 140, `${id}/${lang} trop long`);
    assert.ok(!/gratuit|garanti|guarantee|free|offre limitée|limited offer|100\s?%/i.test(r.body), `${id}/${lang} : promesse commerciale`);
  }
  for (const id of ['first_contact', 'follow_up']) for (const lang of ['fr', 'en']) assert.match(TEMPLATES[id][lang].body, lang === 'fr' ? /ne vous écrirai plus/ : /won't write again/);
  assert.match(TEMPLATES.demo_proposal.fr.body, /prototype/);
  assert.match(TEMPLATES.demo_proposal.en.body, /simulated/);
});

test('modèles : variables absentes laissées visibles entre crochets pour inciter à personnaliser', () => {
  const r = renderTemplate('first_contact', 'fr', {});
  assert.deepEqual(r.unresolved.sort(), ['[Cabinet]', '[Prénom Nom]', '[Votre nom]']);
  assert.throws(() => renderTemplate('inconnu', 'fr'), /inconnu/);
});
