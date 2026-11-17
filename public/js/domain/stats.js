// Statistiques du tableau de bord — calculées uniquement depuis l'état (données de démonstration).
import { counts, completion, dossierStatus, needsIntervention, interventionReasons, STATUSES } from './dossier.js';

export function computeStats(state, now = new Date(), weeks = 8) {
  const t = { expected: 0, received: 0, valid: 0, invalid: 0, analyzing: 0, missing: 0 };
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const attention = [];
  for (const d of state.dossiers) {
    const c = counts(d);
    for (const k of Object.keys(t)) t[k] += c[k];
    byStatus[dossierStatus(d)]++;
    if (needsIntervention(d, now)) attention.push({ dossier: d, reasons: interventionReasons(d, now) });
  }

  // Documents reçus par semaine glissante (la dernière barre = 7 derniers jours).
  const buckets = Array.from({ length: weeks }, () => 0);
  for (const d of state.dossiers)
    for (const s of d.slots) {
      if (!s.doc) continue;
      const age = Math.floor((now - new Date(s.doc.receivedAt)) / (7 * 86400000));
      if (age >= 0 && age < weeks) buckets[weeks - 1 - age]++;
    }

  return {
    totalDossiers: state.dossiers.length,
    totalClients: state.clients.length,
    expected: t.expected,
    received: t.received,
    validated: t.valid,
    incorrect: t.invalid,
    analyzing: t.analyzing,
    missing: t.missing,
    byStatus,
    attention,
    globalProgress: t.expected ? Math.round((t.valid / t.expected) * 100) : 0,
    weekly: buckets,
    avgDossierCompletion: state.dossiers.length ? Math.round(state.dossiers.reduce((a, d) => a + completion(d), 0) / state.dossiers.length) : 0,
  };
}
