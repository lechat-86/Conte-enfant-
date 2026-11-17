import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, itemsFromDossier } from '../../public/js/domain/messages.js';
import { buildSeed } from '../../public/js/data/seed.js';

const base = { clientName: 'Camille', firmName: 'Cabinet Démo', period: '2026-10', link: 'http://x/#/portal/t', dossierId: 'DOS-9' };
const incomplete = { kind: 'issue', type: 'bank_statement', code: 'incomplete', details: { pages: { found: 2, expected: 4 } } };

test('exemple de la mission (FR) : document incomplet', () => {
  const m = buildMessage({ ...base, lang: 'fr', items: [incomplete] });
  assert.match(m, /^Bonjour Camille,/);
  assert.match(m, /Nous avons bien reçu votre document « Relevé bancaire »\. Cependant, celui-ci semble incomplet\. Pourriez-vous nous transmettre une nouvelle version comportant toutes les pages \? Merci\./);
  assert.match(m, /http:\/\/x\/#\/portal\/t/);
  assert.match(m, /Cordialement,\nCabinet Démo$/);
});

test('version anglaise', () => {
  const m = buildMessage({ ...base, lang: 'en', items: [incomplete] });
  assert.match(m, /^Hello Camille,/);
  assert.match(m, /it appears to be incomplete\. Could you send us a new version containing all pages\?/);
  assert.match(m, /Kind regards,\nCabinet Démo$/);
});

test('plusieurs points : liste à puces, documents manquants et période', () => {
  const m = buildMessage({ ...base, lang: 'fr', items: [incomplete, { kind: 'missing', type: 'payslips' }, { kind: 'issue', type: 'sales_invoices', code: 'wrong_period', details: { detectedPeriod: '2026-09' } }] });
  assert.equal((m.match(/^• /gm) || []).length, 3);
  assert.match(m, /Document manquant : Bulletins de paie \(octobre 2026\)/);
  assert.match(m, /septembre 2026 détectée/);
  assert.match(m, /3\/|2\/4 pages/);
});

test('chaque code d’anomalie produit un message FR et EN sans clé manquante', () => {
  for (const lang of ['fr', 'en']) for (const code of ['unreadable', 'wrong_type', 'duplicate', 'wrong_period', 'incomplete']) {
    const d = { pages: { found: 1, expected: 4 }, detectedType: 'payslips', detectedPeriod: '2026-09' };
    for (const items of [[{ kind: 'issue', type: 'bank_statement', code, details: d }], [{ kind: 'issue', type: 'bank_statement', code, details: d }, { kind: 'missing', type: 'payslips' }]]) {
      const m = buildMessage({ ...base, lang, items });
      assert.ok(!m.includes('⟦') && !m.includes('{'), `${lang}/${code}: ${m}`);
    }
  }
});

test('aucun point → message neutre ; la langue du message est indépendante de l’UI', () => {
  assert.match(buildMessage({ ...base, lang: 'en', items: [] }), /Nothing to report/);
});

test('items issus d’un dossier de démonstration (anomalies + manquants)', () => {
  const d = buildSeed(new Date()).dossiers.find((x) => x.id === 'DOS-007');
  const items = itemsFromDossier(d);
  assert.deepEqual(items.map((i) => `${i.kind}:${i.code || ''}`).sort(), ['issue:incomplete', 'issue:wrong_type', 'missing:']);
  assert.equal(itemsFromDossier(d, { includeMissing: false }).length, 2);
});
