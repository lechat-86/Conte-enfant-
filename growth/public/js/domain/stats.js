// Statistiques commerciales — calculées UNIQUEMENT depuis les saisies. Aucune donnée inventée, aucune projection.
import { REPLIED_OR_BEYOND, INTENT_STATUSES, segmentOf } from './constants.js';
import { dayOf, addDays, ymd, parseYmd } from './dates.js';

const countKind = (acts, kind) => acts.filter((a) => a.kind === kind).length;
const distinctProspects = (acts, kind) => new Set(acts.filter((a) => a.kind === kind).map((a) => a.prospectId)).size;
export const maxCommitment = (state, pid) => Math.max(0, ...state.interviews.filter((i) => i.prospectId === pid).map((i) => i.commitmentLevel));

export function computeStats(state) {
  const { prospects, activities } = state;
  const hasKind = (p, kind) => activities.some((a) => a.prospectId === p.id && a.kind === kind);
  const contacted = prospects.filter((p) => p.firstContactAt || hasKind(p, 'message_sent') || REPLIED_OR_BEYOND.includes(p.status) || p.status === 'contacted');
  const replied = prospects.filter((p) => hasKind(p, 'reply') || REPLIED_OR_BEYOND.includes(p.status));
  const demoProspects = prospects.filter((p) => hasKind(p, 'demo_done'));
  const intents = prospects.filter((p) => INTENT_STATUSES.includes(p.status));
  const serious = prospects.filter((p) => p.status === 'paying' || maxCommitment(state, p.id) >= 4);
  const paying = prospects.filter((p) => p.status === 'paying');
  const studied = prospects.filter((p) => p.status !== 'to_research');
  return {
    total: prospects.length,
    french: prospects.filter((p) => segmentOf(p.country) === 'fr').length,
    english: prospects.filter((p) => segmentOf(p.country) === 'en').length,
    toContact: prospects.filter((p) => p.status === 'to_contact').length,
    messagesSent: countKind(activities, 'message_sent'),
    repliesReceived: countKind(activities, 'reply'),
    demosDone: countKind(activities, 'demo_done'),
    intents: intents.length,
    seriousIntents: serious.length,
    paying: paying.length,
    studied: studied.length,
    studiedFr: studied.filter((p) => segmentOf(p.country) === 'fr').length,
    studiedEn: studied.filter((p) => segmentOf(p.country) === 'en').length,
    demoProspects: demoProspects.length,
    // Entonnoir : nombre de cabinets ayant atteint chaque étape (comptes bruts, pas de taux).
    funnel: [
      { key: 'prospects', value: prospects.length },
      { key: 'contacted', value: contacted.length },
      { key: 'replied', value: replied.length },
      { key: 'demos', value: demoProspects.length },
      { key: 'intents', value: intents.length },
      { key: 'paying', value: paying.length },
    ],
  };
}

/** Cumul hebdomadaire sur `weeks` semaines (dernière = semaine en cours, se terminant à `today`). */
export function weeklyProgress(state, today = ymd(), weeks = 8) {
  const ends = Array.from({ length: weeks }, (_, i) => addDays(today, -7 * (weeks - 1 - i)));
  const upTo = (dates, end) => dates.filter((d) => d <= end).length;
  const added = state.prospects.map((p) => p.addedAt);
  const by = (kind) => state.activities.filter((a) => a.kind === kind).map((a) => dayOf(a.at));
  const series = { prospects: added, messages: by('message_sent'), replies: by('reply'), demos: by('demo_done') };
  return { ends, series: Object.fromEntries(Object.entries(series).map(([k, d]) => [k, ends.map((e) => upTo(d, e))])) };
}

/** Avancement de chaque objectif : { current, target, done, remaining }. */
export function goalsProgress(state, stats = computeStats(state)) {
  const cur = { studied: stats.studied, fr: stats.studiedFr, en: stats.studiedEn, demos: stats.demoProspects, seriousIntents: stats.seriousIntents, paying: stats.paying };
  return Object.fromEntries(Object.entries(state.goals).map(([k, target]) => {
    const current = cur[k] ?? 0;
    return [k, { current, target, done: current >= target, remaining: Math.max(0, target - current) }];
  }));
}
export const _parse = parseYmd;
