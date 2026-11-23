// Internationalisation FR / EN, changement de langue à chaud (sans rechargement).
import fr from '../i18n/fr.js';
import en from '../i18n/en.js';

export const LANGS = ['fr', 'en'];
const dicts = { fr, en };
let current = 'fr';
const listeners = new Set();

export const getLang = () => current;

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return;
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const has = (key, lang = current) => dicts[lang] && dicts[lang][key] != null;

/** Traduit une clé. `lang` permet de forcer une langue (ex. messages destinés au client). */
export function t(key, params = {}, lang = current) {
  const s = dicts[lang]?.[key];
  if (s == null) return `⟦${key}⟧`; // marqueur visible : détecté par les tests
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
}

export const dictionaries = dicts;
