// Logique métier des dossiers (pure : aucune dépendance au DOM ni au stockage).
import { TEMPLATES } from './docTypes.js';

export const STATUSES = ['complete', 'pending', 'to_fix', 'analyzing'];
export const DEFAULT_DEADLINE_DAYS = 14;

/** État d'un emplacement de document : missing | valid | invalid | analyzing */
export const slotState = (slot) => (slot.doc ? slot.doc.status : 'missing');

export function counts(dossier) {
  const c = { expected: dossier.slots.length, valid: 0, invalid: 0, analyzing: 0, missing: 0 };
  for (const s of dossier.slots) c[slotState(s)]++;
  c.received = c.valid + c.invalid + c.analyzing;
  return c;
}

/** Taux de complétion (0..100) = documents validés / documents attendus. */
export function completion(dossier) {
  const c = counts(dossier);
  return c.expected === 0 ? 0 : Math.round((c.valid / c.expected) * 100);
}

/** Statut : analyse en cours > à corriger > en attente (pièces manquantes) > complet. */
export function dossierStatus(dossier) {
  const c = counts(dossier);
  if (c.analyzing > 0) return 'analyzing';
  if (c.invalid > 0) return 'to_fix';
  if (c.missing > 0) return 'pending';
  return 'complete';
}

export const missingSlots = (d) => d.slots.filter((s) => slotState(s) === 'missing');
export const invalidSlots = (d) => d.slots.filter((s) => slotState(s) === 'invalid');

export function isOverdue(dossier, now = new Date()) {
  return dossierStatus(dossier) !== 'complete' && new Date(dossier.dueDate) < now;
}

/** Raisons d'intervention humaine (liste vide = aucune intervention nécessaire). */
export function interventionReasons(dossier, now = new Date()) {
  const reasons = [];
  if (invalidSlots(dossier).length) reasons.push('to_fix');
  if (isOverdue(dossier, now)) reasons.push('overdue');
  return reasons;
}
export const needsIntervention = (d, now) => interventionReasons(d, now).length > 0;

export function createDossier({ id, clientId, template, period, now = new Date(), deadlineDays = DEFAULT_DEADLINE_DAYS }) {
  const types = TEMPLATES[template];
  if (!types) throw new Error(`Modèle inconnu : ${template}`);
  const due = new Date(now.getTime() + deadlineDays * 86400000);
  return {
    id,
    clientId,
    template,
    period,
    createdAt: now.toISOString(),
    dueDate: due.toISOString(),
    token: `demo-${id.toLowerCase()}`, // jeton de démonstration — NON secret
    slots: types.map((type, i) => ({ id: `${id}-S${i + 1}`, type, doc: null })),
  };
}

export function nextId(prefix, existingIds, pad = 3) {
  const max = existingIds.reduce((m, id) => Math.max(m, Number(String(id).split('-').pop()) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`;
}
