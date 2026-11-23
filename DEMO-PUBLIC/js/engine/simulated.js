// MOTEUR DE SIMULATION — AUCUNE ANALYSE RÉELLE.
// Il ne lit jamais le contenu d'un fichier : il fabrique une « extraction »
// déterministe à partir d'un scénario (choisi ou déduit du nom de fichier).
// Un vrai moteur OCR/IA le remplacera derrière la même interface (voir engine/index.js).
import { DOC_TYPES, DOC_TYPE_IDS } from '../domain/docTypes.js';
import { shiftMonths } from '../domain/period.js';
import { evaluate } from '../domain/rules.js';

export const SCENARIOS = ['ok', 'unreadable', 'wrong_type', 'duplicate', 'wrong_period', 'incomplete'];

const KEYWORDS = [
  ['unreadable', /flou|blur|illisible|unreadable/i],
  ['wrong_type', /mauvais|wrong|autre|other/i],
  ['duplicate', /doublon|double|dup|copie|copy/i],
  ['wrong_period', /periode|période|period|ancien|old/i],
  ['incomplete', /incomplet|incomplete|partiel|partial/i],
];

/** Déduit le scénario du nom de fichier si `requested` vaut « auto ». Déterministe. */
export function resolveScenario(fileName = '', requested = 'auto') {
  if (SCENARIOS.includes(requested)) return requested;
  for (const [scenario, re] of KEYWORDS) if (re.test(fileName)) return scenario;
  return 'ok';
}

export function hash(s) {
  let x = 5381;
  for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) >>> 0;
  return x.toString(16).padStart(8, '0');
}

/** Archive fictive utilisée quand aucun autre document du dossier ne peut servir de doublon. */
export const SIM_ARCHIVE = { documentId: null, fileName: 'archive-demo.pdf', fingerprint: 'sim:archive-demo' };

export function simulateExtraction({ fileName, expected, scenario }, others = []) {
  const spec = DOC_TYPES[expected.type];
  const base = {
    legibility: 0.94,
    detectedType: expected.type,
    detectedPeriod: spec.granularity ? expected.period : null,
    pages: { found: spec.pages, expected: spec.pages },
    fingerprint: `sim:${hash(`${fileName}|${expected.type}|${expected.period}`)}`,
  };
  switch (scenario) {
    case 'unreadable':
      return { ...base, legibility: 0.28 };
    case 'wrong_type': {
      const i = DOC_TYPE_IDS.indexOf(expected.type);
      return { ...base, detectedType: DOC_TYPE_IDS[(i + 1) % DOC_TYPE_IDS.length] };
    }
    case 'duplicate': {
      const src = others.find((o) => o.fingerprint) || SIM_ARCHIVE;
      return { ...base, fingerprint: src.fingerprint };
    }
    case 'wrong_period':
      return { ...base, detectedPeriod: shiftMonths(expected.period, spec.granularity === 'year' ? -12 : -1) };
    case 'incomplete':
      return { ...base, pages: { found: Math.max(1, Math.floor(spec.pages / 2)), expected: spec.pages } };
    default:
      return base;
  }
}

/** Contexte de doublons : autres documents du dossier + archive fictive. */
export const withArchive = (others) => (others.some((o) => o.fingerprint) ? others : [...others, SIM_ARCHIVE]);

/** Analyse complète synchrone (utilisée par le jeu de données de démonstration). */
export function simulateAnalysis(input, others = [], now = new Date()) {
  const scenario = resolveScenario(input.fileName, input.scenario);
  const known = withArchive(others);
  const extraction = simulateExtraction({ ...input, scenario }, known);
  return {
    engine: { id: simulatedEngine.id, name: simulatedEngine.name, simulated: true },
    scenario,
    extraction,
    ...evaluate({ extraction, expected: input.expected, known }),
    analyzedAt: now.toISOString(),
  };
}

export const simulatedEngine = {
  id: 'simulated',
  name: 'Simulation déterministe',
  simulated: true,
  prepareContext: withArchive,
  async analyze({ fileName, expected, scenario }, others = []) {
    const resolved = resolveScenario(fileName, scenario);
    return { scenario: resolved, extraction: simulateExtraction({ fileName, expected, scenario: resolved }, others) };
  },
};
