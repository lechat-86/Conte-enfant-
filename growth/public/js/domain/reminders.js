// Rappels VISUELS uniquement : rien n'est jamais envoyé automatiquement.
import { CLOSED_STATUSES, ACTIVE_STATUSES } from './constants.js';
import { ymd, addDays, diffDays } from './dates.js';

const open = (p) => !CLOSED_STATUSES.includes(p.status);
const byDate = (a, b) => (a.nextActionDate || '9999').localeCompare(b.nextActionDate || '9999');

export function computeReminders(state, today = ymd()) {
  const ps = state.prospects;
  const dueToday = ps.filter((p) => open(p) && p.nextActionDate === today);
  const overdue = ps.filter((p) => open(p) && p.nextActionDate && p.nextActionDate < today).sort(byDate);
  const demos = ps.filter((p) => p.status === 'demo_planned').sort(byDate);
  const replies = ps.filter((p) => p.status === 'replied').sort((a, b) => (a.nextActionDate || '9999').localeCompare(b.nextActionDate || '9999'));
  const unplanned = ps.filter((p) => ACTIVE_STATUSES.includes(p.status) && !p.nextActionDate);
  const lateDays = (p) => diffDays(today, p.nextActionDate);
  return {
    today: dueToday, overdue, demos, replies, unplanned, lateDays,
    count: dueToday.length + overdue.length + replies.length + demos.filter((p) => !p.nextActionDate || p.nextActionDate <= addDays(today, 7)).length,
  };
}
