import { getLang } from './i18n.js';

const loc = (lang) => (lang === 'en' ? 'en-GB' : 'fr-FR');

export function fmtDate(iso, lang = getLang()) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(loc(lang), { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function fmtDateTime(iso, lang = getLang()) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(loc(lang), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function fmtMoney(amount, currency, lang = getLang()) {
  return new Intl.NumberFormat(loc(lang), { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(amount);
}

export function fmtNumber(n, lang = getLang()) {
  return new Intl.NumberFormat(loc(lang)).format(n);
}

/** « 2026-10 » → « octobre 2026 » / « October 2026 » */
export function fmtPeriod(period, lang = getLang()) {
  if (!period) return '—';
  const [y, m] = period.split('-').map(Number);
  return new Intl.DateTimeFormat(loc(lang), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function fmtYear(period) {
  return period ? period.split('-')[0] : '—';
}

export function fmtSize(kb) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} Mo`.replace('Mo', getLang() === 'en' ? 'MB' : 'Mo') : `${kb} Ko`.replace('Ko', getLang() === 'en' ? 'KB' : 'Ko');
}
