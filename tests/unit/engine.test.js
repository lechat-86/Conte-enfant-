import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDocument, registerEngine, listEngines, getEngine, setActiveEngine } from '../../public/js/engine/index.js';
import { simulateAnalysis } from '../../public/js/engine/simulated.js';

const input = { fileName: 'releve_flou.pdf', expected: { type: 'bank_statement', period: '2026-10' } };

test('le moteur simulé est enregistré, actif et marqué « simulated »', () => {
  const [e] = listEngines();
  assert.equal(e.id, 'simulated');
  assert.equal(e.simulated, true);
  assert.equal(e.active, true);
});

test('analyse asynchrone = analyse synchrone (hors horodatage)', async () => {
  const a = await analyzeDocument(input, []);
  const b = simulateAnalysis({ ...input, scenario: 'auto' }, []);
  assert.deepEqual({ ...a, analyzedAt: 0 }, { ...b, analyzedAt: 0 });
  assert.equal(a.issue, 'unreadable');
});

test('un moteur tiers (futur OCR/IA) se branche sans changer les règles', async () => {
  registerEngine({
    id: 'fake-ocr',
    name: 'Faux OCR de test',
    simulated: false,
    async analyze({ expected }) {
      return { extraction: { legibility: 0.99, detectedType: expected.type, detectedPeriod: expected.period, pages: { found: 1, expected: 4 }, fingerprint: 'real-hash' } };
    },
  });
  const a = await analyzeDocument(input, [], { engine: getEngine('fake-ocr') });
  assert.equal(a.engine.id, 'fake-ocr');
  assert.equal(a.engine.simulated, false);
  assert.equal(a.issue, 'incomplete'); // verdict décidé par domain/rules.js
  setActiveEngine('fake-ocr');
  assert.equal(listEngines().find((e) => e.active).id, 'fake-ocr');
  setActiveEngine('simulated');
});

test('moteur invalide ou inconnu refusé', () => {
  assert.throws(() => registerEngine({ id: 'x' }), /manquant/);
  assert.throws(() => setActiveEngine('inconnu'), /inconnu/);
});
