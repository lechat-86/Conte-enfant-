import DICT from '../i18n/dict.js';
export const LANGS = ['fr', 'en'];
let current = 'fr';
const listeners = new Set();
export const getLang = () => current;
export function setLang(l) { if (!LANGS.includes(l) || l === current) return; current = l; if (typeof document !== 'undefined') document.documentElement.lang = l; listeners.forEach((f) => f(l)); }
export const onLangChange = (f) => (listeners.add(f), () => listeners.delete(f));
export const has = (k) => k in DICT;
export function t(key, params = {}, lang = current) {
  const e = DICT[key];
  if (!e) return `⟦${key}⟧`;
  return e[lang === 'en' ? 1 : 0].replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
}
export const dictionary = DICT;
