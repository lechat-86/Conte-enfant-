// File de relances : quels dossiers relancer, dans quel ordre, et quand le dernier message a été préparé.
// Logique pure (aucun DOM, aucun stockage) — ne lit que l'état existant, n'ajoute aucune donnée.
// Rien n'est envoyé : « préparer » = ouvrir l'assistant ; la trace est l'événement existant `message_approved`.
import { counts, isOverdue } from './dossier.js';

/** Niveaux de priorité, du plus urgent au moins urgent. */
export const TIERS = ['overdue', 'to_fix', 'missing'];
export const PREP_FILTERS = ['all', 'never', 'prepared'];
const DAY = 86400000;

/** Date (ISO) du dernier message préparé et validé pour ce dossier, ou null. */
export function lastPreparedAt(events, dossierId) {
  let last = null;
  for (const e of events || []) if (e.type === 'message_approved' && e.dossierId === dossierId && (!last || e.at > last)) last = e.at;
  return last;
}

/**
 * Entrée de relance pour un dossier, ou null s'il n'y a rien à demander au client
 * (dossier complet, ou seulement des pièces en cours d'analyse).
 * Priorité : échéance dépassée > pièces à corriger > pièces manquantes.
 */
export function followupFor(dossier, events = [], now = new Date()) {
  const c = counts(dossier);
  if (c.invalid === 0 && c.missing === 0) return null;
  const overdue = isOverdue(dossier, now);
  const tier = overdue ? 'overdue' : c.invalid > 0 ? 'to_fix' : 'missing';
  return {
    dossierId: dossier.id,
    clientId: dossier.clientId,
    tier,
    overdue,
    invalid: c.invalid,
    missing: c.missing,
    daysLate: overdue ? Math.max(1, Math.floor((now - new Date(dossier.dueDate)) / DAY)) : 0,
    dueDate: dossier.dueDate,
    lastPreparedAt: lastPreparedAt(events, dossier.id),
  };
}

const rank = (f) => TIERS.indexOf(f.tier);

/** Toutes les relances, triées : priorité, puis (retard : le plus en retard d'abord) sinon échéance la plus proche, puis identifiant. */
export function buildFollowups(state, now = new Date()) {
  return state.dossiers
    .map((d) => followupFor(d, state.events, now))
    .filter(Boolean)
    .sort((a, b) => rank(a) - rank(b) || b.daysLate - a.daysLate || a.dueDate.localeCompare(b.dueDate) || a.dossierId.localeCompare(b.dossierId));
}

/** Filtres : texte (client, identifiant), priorité, état de préparation. */
export function filterFollowups(list, { q = '', tier = 'all', prep = 'all' } = {}, clientName = () => '') {
  const needle = q.trim().toLowerCase();
  return list.filter((f) => {
    if (tier !== 'all' && f.tier !== tier) return false;
    if (prep === 'never' && f.lastPreparedAt) return false;
    if (prep === 'prepared' && !f.lastPreparedAt) return false;
    if (needle && ![f.dossierId, clientName(f.clientId)].some((x) => String(x || '').toLowerCase().includes(needle))) return false;
    return true;
  });
}

export function countByTier(list) {
  return Object.fromEntries(TIERS.map((t) => [t, list.filter((f) => f.tier === t).length]));
}
