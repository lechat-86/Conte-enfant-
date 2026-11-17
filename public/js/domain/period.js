// Périodes au format « AAAA-MM ».
export const isPeriod = (p) => typeof p === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);

export function shiftMonths(period, delta) {
  const [y, m] = period.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function monthOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Compare deux périodes selon la granularité du type de document ('month' | 'year'). */
export function samePeriod(a, b, granularity) {
  if (!a || !b) return false;
  return granularity === 'year' ? a.slice(0, 4) === b.slice(0, 4) : a === b;
}
