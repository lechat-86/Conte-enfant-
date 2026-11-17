import { getLang } from './i18n.js';
import { parseYmd } from '../domain/dates.js';
const loc = () => (getLang() === 'en' ? 'en-GB' : 'fr-FR');
export const fmtDate = (s) => (s ? new Intl.DateTimeFormat(loc(), { day: '2-digit', month: 'short', year: 'numeric' }).format(s.length === 10 ? parseYmd(s) : new Date(s)) : '—');
export const fmtDateTime = (iso) => (iso ? new Intl.DateTimeFormat(loc(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—');
export const fmtEur = (n) => (n == null ? '—' : new Intl.NumberFormat(loc(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n));
export const fmtNum = (n) => new Intl.NumberFormat(loc()).format(n);
