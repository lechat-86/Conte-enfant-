// Dates calendaires « AAAA-MM-JJ » (fuseau local) — pures, sans dépendance.
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function isYmd(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseYmd(s);
  return ymd(d) === s;
}
export function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
export const diffDays = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 86400000);
export const dayOf = (iso) => ymd(new Date(iso));
