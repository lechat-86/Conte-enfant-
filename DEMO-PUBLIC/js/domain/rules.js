// Règles de décision documentaires — indépendantes du moteur d'extraction.
// Un moteur (simulé aujourd'hui, OCR + IA demain) produit une « extraction » ;
// ces règles déterministes et auditables en déduisent le verdict.
import { DOC_TYPES } from './docTypes.js';
import { samePeriod } from './period.js';

export const ISSUE_CODES = ['unreadable', 'wrong_type', 'duplicate', 'wrong_period', 'incomplete'];
export const CHECK_ORDER = ['legibility', 'type', 'duplicate', 'period', 'pages'];
export const CHECK_TO_ISSUE = {
  legibility: 'unreadable',
  type: 'wrong_type',
  duplicate: 'duplicate',
  period: 'wrong_period',
  pages: 'incomplete',
};
export const LEGIBILITY_MIN = 0.6;

/**
 * @typedef {Object} Extraction
 * @property {number} legibility  0..1
 * @property {string} detectedType
 * @property {string|null} detectedPeriod  « AAAA-MM »
 * @property {{found:number, expected:number}} pages
 * @property {string} fingerprint  empreinte de contenu (pour la détection de doublons)
 */

/**
 * @param {{extraction: Extraction, expected: {type:string, period:string}, known?: Array<{documentId:string|null, fileName:string, fingerprint:string}>}} input
 */
export function evaluate({ extraction, expected, known = [] }) {
  const checks = [];
  const push = (id, status, value) => checks.push({ id, status, value });

  const legible = extraction.legibility >= LEGIBILITY_MIN;
  push('legibility', legible ? 'pass' : 'fail', extraction.legibility);

  let match = null;
  if (!legible) {
    // Si le document est illisible, les autres contrôles ne sont pas fiables.
    CHECK_ORDER.slice(1).forEach((id) => push(id, 'skipped'));
  } else {
    push('type', extraction.detectedType === expected.type ? 'pass' : 'fail', extraction.detectedType);
    match = known.find((k) => k.fingerprint === extraction.fingerprint) || null;
    push('duplicate', match ? 'fail' : 'pass', match ? match.fileName : null);
    const gran = DOC_TYPES[expected.type]?.granularity;
    if (!gran) push('period', 'na');
    else push('period', samePeriod(extraction.detectedPeriod, expected.period, gran) ? 'pass' : 'fail', extraction.detectedPeriod);
    const { found, expected: exp } = extraction.pages;
    push('pages', found >= exp ? 'pass' : 'fail', `${found}/${exp}`);
  }

  const firstFail = checks.find((c) => c.status === 'fail');
  return {
    verdict: firstFail ? 'invalid' : 'valid',
    issue: firstFail ? CHECK_TO_ISSUE[firstFail.id] : null,
    checks,
    details: {
      legibility: extraction.legibility,
      expectedType: expected.type,
      detectedType: extraction.detectedType,
      expectedPeriod: expected.period,
      detectedPeriod: extraction.detectedPeriod,
      pages: extraction.pages,
      duplicateOf: match ? { documentId: match.documentId, fileName: match.fileName } : null,
    },
  };
}
