import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateAnalysis, resolveScenario, SCENARIOS } from '../../public/js/engine/simulated.js';
import { evaluate, LEGIBILITY_MIN } from '../../public/js/domain/rules.js';
import { shiftMonths, samePeriod, isPeriod } from '../../public/js/domain/period.js';

const expected = { type: 'bank_statement', period: '2026-10' };
const run = (scenario, extra = {}, others = []) => simulateAnalysis({ fileName: 'x.pdf', expected, scenario, ...extra }, others);

test('scénario « ok » : document correct et lisible', () => {
  const a = run('ok');
  assert.equal(a.verdict, 'valid');
  assert.equal(a.issue, null);
  assert.ok(a.checks.every((c) => c.status === 'pass'));
  assert.equal(a.engine.simulated, true);
});

const CASES = { unreadable: 'unreadable', wrong_type: 'wrong_type', duplicate: 'duplicate', wrong_period: 'wrong_period', incomplete: 'incomplete' };
for (const [scenario, issue] of Object.entries(CASES)) {
  test(`scénario « ${scenario} » → anomalie ${issue}`, () => {
    const a = run(scenario);
    assert.equal(a.verdict, 'invalid');
    assert.equal(a.issue, issue);
    assert.equal(a.scenario, scenario);
  });
}

test('illisible : les autres contrôles sont « non évalués »', () => {
  const a = run('unreadable');
  assert.deepEqual(a.checks.slice(1).map((c) => c.status), ['skipped', 'skipped', 'skipped', 'skipped']);
});

test('doublon : référence un document existant du dossier quand il y en a un', () => {
  const first = run('ok');
  const others = [{ documentId: 'DOC-1', fileName: 'releve_a.pdf', fingerprint: first.extraction.fingerprint }];
  const dup = run('duplicate', {}, others);
  assert.equal(dup.issue, 'duplicate');
  assert.equal(dup.details.duplicateOf.documentId, 'DOC-1');
  assert.equal(dup.details.duplicateOf.fileName, 'releve_a.pdf');
});

test('doublon sans autre document : archive fictive explicite', () => {
  const dup = run('duplicate');
  assert.equal(dup.details.duplicateOf.fileName, 'archive-demo.pdf');
});

test('un fichier légitime n’est pas un doublon des autres', () => {
  const a = run('ok', { fileName: 'a.pdf' });
  const b = simulateAnalysis({ fileName: 'b.pdf', expected, scenario: 'ok' }, [{ documentId: 'D', fileName: 'a.pdf', fingerprint: a.extraction.fingerprint }]);
  assert.equal(b.verdict, 'valid');
});

test('période incorrecte : mois précédent (type mensuel) / année précédente (type annuel)', () => {
  assert.equal(run('wrong_period').extraction.detectedPeriod, '2026-09');
  const y = simulateAnalysis({ fileName: 'x.pdf', expected: { type: 'tax_return', period: '2026-03' }, scenario: 'wrong_period' });
  assert.equal(y.extraction.detectedPeriod, '2025-03');
  assert.equal(y.issue, 'wrong_period');
});

test('types sans période : le contrôle de période est « sans objet »', () => {
  const a = simulateAnalysis({ fileName: 'x.pdf', expected: { type: 'id_document', period: '2026-10' }, scenario: 'wrong_period' });
  assert.equal(a.checks.find((c) => c.id === 'period').status, 'na');
  assert.equal(a.verdict, 'valid');
});

test('incomplet : pages détectées < pages attendues', () => {
  const a = run('incomplete');
  assert.ok(a.details.pages.found < a.details.pages.expected);
});

test('ordre de priorité des anomalies : lisibilité > type > doublon > période > pages', () => {
  const base = { legibility: 0.9, detectedType: 'bank_statement', detectedPeriod: '2026-10', pages: { found: 4, expected: 4 }, fingerprint: 'f' };
  const known = [{ documentId: null, fileName: 'k', fingerprint: 'f' }];
  const all = { ...base, detectedType: 'payslips', detectedPeriod: '2020-01', pages: { found: 1, expected: 4 } };
  assert.equal(evaluate({ extraction: all, expected, known }).issue, 'wrong_type');
  assert.equal(evaluate({ extraction: { ...all, detectedType: 'bank_statement' }, expected, known }).issue, 'duplicate');
  assert.equal(evaluate({ extraction: { ...all, detectedType: 'bank_statement' }, expected }).issue, 'wrong_period');
  assert.equal(evaluate({ extraction: { ...all, detectedType: 'bank_statement', detectedPeriod: '2026-10' }, expected }).issue, 'incomplete');
  assert.equal(evaluate({ extraction: { ...all, legibility: 0.1 }, expected, known }).issue, 'unreadable');
});

test('seuil de lisibilité', () => {
  const ex = { legibility: LEGIBILITY_MIN, detectedType: 'bank_statement', detectedPeriod: '2026-10', pages: { found: 4, expected: 4 }, fingerprint: 'z' };
  assert.equal(evaluate({ extraction: ex, expected }).verdict, 'valid');
  assert.equal(evaluate({ extraction: { ...ex, legibility: LEGIBILITY_MIN - 0.01 }, expected }).issue, 'unreadable');
});

test('déterminisme : mêmes entrées → mêmes résultats', () => {
  const strip = (a) => ({ ...a, analyzedAt: 0 });
  for (const s of SCENARIOS) assert.deepEqual(strip(run(s)), strip(run(s)));
});

test('scénario déduit du nom de fichier (mode auto)', () => {
  assert.equal(resolveScenario('releve_flou.pdf'), 'unreadable');
  assert.equal(resolveScenario('scan_ILLISIBLE.pdf'), 'unreadable');
  assert.equal(resolveScenario('facture_copie.pdf'), 'duplicate');
  assert.equal(resolveScenario('doublon.pdf'), 'duplicate');
  assert.equal(resolveScenario('releve_ancienne.pdf'), 'wrong_period');
  assert.equal(resolveScenario('releve_partiel.pdf'), 'incomplete');
  assert.equal(resolveScenario('mauvais_document.pdf'), 'wrong_type');
  assert.equal(resolveScenario('releve_octobre.pdf'), 'ok');
  assert.equal(resolveScenario('flou.pdf', 'incomplete'), 'incomplete'); // le choix explicite prime
});

test('utilitaires de période', () => {
  assert.equal(shiftMonths('2026-01', -1), '2025-12');
  assert.equal(shiftMonths('2026-12', 1), '2027-01');
  assert.equal(shiftMonths('2026-03', -12), '2025-03');
  assert.ok(isPeriod('2026-10') && !isPeriod('2026-13') && !isPeriod('26-10') && !isPeriod(''));
  assert.ok(samePeriod('2026-02', '2026-11', 'year') && !samePeriod('2026-02', '2026-11', 'month'));
});
