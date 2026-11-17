// Analyse comparative des retours. Comptages bruts toujours ; moyennes/médianes seulement si l'échantillon est suffisant.
import { MIN_SAMPLE } from './constants.js';

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function tally(rows, pick) {
  const m = new Map();
  for (const r of rows) {
    const seen = new Set();
    for (const raw of pick(r)) {
      const k = norm(raw);
      if (!k || seen.has(k)) continue;           // un cabinet compte une seule fois par valeur
      seen.add(k);
      const cur = m.get(k) || { key: k, label: raw.trim(), count: 0, firms: [] };
      cur.count++; cur.firms.push(r.prospect.id);
      m.set(k, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Une ligne par cabinet : prospect + son dernier entretien + toutes ses déclarations agrégées. */
export function buildRows(state) {
  return state.prospects.map((p) => {
    const ivs = state.interviews.filter((i) => i.prospectId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    return { prospect: p, interviews: ivs, last: ivs[0] || null };
  });
}

const median = (arr) => { const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function analyze(state) {
  const rows = buildRows(state);
  const withInterview = rows.filter((r) => r.last);
  const n = withInterview.length;
  const sufficient = n >= MIN_SAMPLE;
  const union = (r, k) => [...new Set(r.interviews.flatMap((i) => i[k]))];
  const problems = tally(rows, (r) => [...r.prospect.problems, ...union(r, 'difficulties')]);
  const features = tally(withInterview, (r) => union(r, 'featuresWanted'));
  const competitors = tally(withInterview, (r) => union(r, 'competitorsCited'));
  const software = tally(withInterview, (r) => union(r, 'software'));
  const refusals = tally(withInterview, (r) => union(r, 'refusalReasons'));
  const interests = tally(withInterview, (r) => union(r, 'interestReasons'));
  const budgets = rows
    .map((r) => ({ prospectId: r.prospect.id, value: r.last?.budgetEnvisaged ?? r.prospect.budgetMonthly }))
    .filter((b) => b.value != null)
    .sort((a, b) => a.value - b.value);
  const values = budgets.map((b) => b.value);
  // Distinction essentielle : intérêt verbal / engagement réel / prix explicitement accepté.
  const verbalPositive = withInterview.filter((r) => ['positive', 'very_positive'].includes(r.last.demoReaction)).length;
  const commitment3 = withInterview.filter((r) => Math.max(...r.interviews.map((i) => i.commitmentLevel)) >= 3).length;
  const commitment4 = withInterview.filter((r) => Math.max(...r.interviews.map((i) => i.commitmentLevel)) >= 4).length;
  const priceAccepted = withInterview.filter((r) => r.interviews.some((i) => i.priceAcceptedExplicit)).length;
  return {
    rows, n, sufficient, minSample: MIN_SAMPLE, problems, features, competitors, software, refusals, interests,
    budgets: { list: budgets, count: values.length, min: values[0] ?? null, max: values.at(-1) ?? null, median: sufficient && values.length >= MIN_SAMPLE ? median(values) : null },
    verbalVsReal: { verbalPositive, commitment3, commitment4, priceAccepted },
  };
}
