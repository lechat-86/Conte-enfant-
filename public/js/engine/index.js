// Point d'entrée du moteur d'analyse documentaire.
//
// CONTRAT D'UN MOTEUR (à implémenter pour brancher un vrai OCR + modèle d'IA) :
//   {
//     id: string, name: string, simulated: boolean,
//     prepareContext?(known): known,                       // optionnel
//     analyze({ fileName, sizeKB, expected:{type,period}, scenario? }, known)
//       → Promise<{ extraction: Extraction, scenario?: string }>
//   }
// `Extraction` = { legibility, detectedType, detectedPeriod, pages:{found,expected}, fingerprint }
// (voir domain/rules.js). Le verdict est TOUJOURS calculé par domain/rules.js :
// un modèle d'IA propose des extractions, il ne décide pas seul.
import { evaluate } from '../domain/rules.js';
import { simulatedEngine } from './simulated.js';

const registry = new Map();
let activeId = 'simulated';

export function registerEngine(engine) {
  for (const k of ['id', 'name', 'analyze']) if (!engine?.[k]) throw new Error(`Moteur invalide : « ${k} » manquant`);
  registry.set(engine.id, engine);
}
export const getEngine = (id = activeId) => registry.get(id);
export function setActiveEngine(id) {
  if (!registry.has(id)) throw new Error(`Moteur inconnu : ${id}`);
  activeId = id;
}
export const listEngines = () => [...registry.values()].map(({ id, name, simulated }) => ({ id, name, simulated: !!simulated, active: id === activeId }));

registerEngine(simulatedEngine);

/**
 * @param {{fileName:string, sizeKB?:number, expected:{type:string, period:string}, scenario?:string}} input
 * @param {Array} others empreintes des autres documents connus (détection de doublons)
 */
export async function analyzeDocument(input, others = [], { engine = getEngine(), now = new Date() } = {}) {
  const known = engine.prepareContext ? engine.prepareContext(others) : others;
  const res = await engine.analyze(input, known);
  const verdict = evaluate({ extraction: res.extraction, expected: input.expected, known });
  return {
    engine: { id: engine.id, name: engine.name, simulated: !!engine.simulated },
    ...(res.scenario ? { scenario: res.scenario } : {}),
    extraction: res.extraction,
    ...verdict,
    analyzedAt: now.toISOString(),
  };
}
