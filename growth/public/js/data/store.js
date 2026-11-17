// Store de READYFILE GROWTH : état + persistance locale (localStorage de CETTE origine, distincte de READYFILE AI).
// Architecture de sécurisation future : `codec` (chiffrement au repos) et `storage` (adaptateur) sont injectables ;
// aucune donnée ne quitte jamais le navigateur (pas de réseau).
import { SCHEMA_VERSION, DEFAULT_GOALS, STATUSES } from '../domain/constants.js';
import { validateProspect, validateInterview, validateGoals, validateActivity } from '../domain/validation.js';
import { ymd } from '../domain/dates.js';
import { buildSeed } from './seed.js';

export const KEY = 'readyfile-growth-v1';
export function memoryStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; }
function safeStorage() { try { const s = globalThis.localStorage; s.setItem('__p', '1'); s.removeItem('__p'); return s; } catch { return memoryStorage(); } }
export const identityCodec = { encode: (s) => s, decode: (s) => s };

const nextId = (prefix, ids, pad = 3) => `${prefix}-${String(ids.reduce((m, id) => Math.max(m, Number(String(id).split('-').pop()) || 0), 0) + 1).padStart(pad, '0')}`;

/** Valide et normalise un état importé / rechargé. Retourne null si inutilisable. */
export function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== SCHEMA_VERSION) return null;
  if (!Array.isArray(raw.prospects) || !Array.isArray(raw.activities) || !Array.isArray(raw.interviews)) return null;
  const prospects = [];
  for (const p of raw.prospects) {
    if (!p || typeof p.id !== 'string' || typeof p.firm !== 'string' || !STATUSES.includes(p.status)) return null;
    prospects.push({ demo: false, emailLegit: false, ...p, addedAt: p.addedAt || ymd() });
  }
  const ids = new Set(prospects.map((p) => p.id));
  const activities = raw.activities.filter((a) => a && ids.has(a.prospectId) && typeof a.at === 'string' && typeof a.kind === 'string');
  const interviews = raw.interviews.filter((i) => i && ids.has(i.prospectId) && typeof i.date === 'string');
  const g = validateGoals({ ...DEFAULT_GOALS, ...(raw.goals || {}) });
  return { version: SCHEMA_VERSION, meta: raw.meta || {}, settings: { senderName: '', lang: 'fr', ...(raw.settings || {}) }, goals: g.ok ? g.value : { ...DEFAULT_GOALS }, prospects, activities, interviews };
}

export function createStore({ storage = safeStorage(), codec = identityCodec, clock = () => new Date(), seed = true } = {}) {
  let state;
  const listeners = new Set();
  const today = () => ymd(clock());

  function load() {
    try {
      const raw = storage.getItem(KEY);
      if (raw) { const s = sanitizeState(JSON.parse(codec.decode(raw))); if (s) return s; }
    } catch { /* données illisibles : on repart proprement (la sauvegarde JSON reste la référence) */ }
    return seed ? buildSeed(clock()) : { ...buildSeed(clock()), prospects: [], activities: [], interviews: [] };
  }
  const persist = () => { try { storage.setItem(KEY, codec.encode(JSON.stringify(state))); } catch { /* quota */ } };
  const commit = () => { persist(); listeners.forEach((f) => f(state)); };
  state = load();
  persist();

  const addAct = (prospectId, kind, text, at = clock().toISOString()) => {
    state.activities.push({ id: nextId('A', state.activities.map((a) => a.id), 4), prospectId, at, kind, text, demo: !!state.prospects.find((p) => p.id === prospectId)?.demo });
  };

  const s = {
    getState: () => state,
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
    prospect: (id) => state.prospects.find((p) => p.id === id),
    activitiesOf: (id) => state.activities.filter((a) => a.prospectId === id).sort((a, b) => b.at.localeCompare(a.at)),
    interviewsOf: (id) => state.interviews.filter((i) => i.prospectId === id).sort((a, b) => b.date.localeCompare(a.date)),
    interview: (id) => state.interviews.find((i) => i.id === id),
    hasDemo: () => state.prospects.some((p) => p.demo),

    addProspect(input) {
      const v = validateProspect(input);
      if (!v.ok) return v;
      const id = nextId('P', state.prospects.map((p) => p.id));
      const p = { id, demo: false, ...v.value, addedAt: today() };
      state.prospects.push(p); commit();
      return { ok: true, prospect: p };
    },
    updateProspect(id, input) {
      const p = s.prospect(id); if (!p) return { ok: false, errors: { _: 'err.not_found' } };
      const v = validateProspect({ ...p, ...input });
      if (!v.ok) return v;
      const before = p.status;
      Object.assign(p, v.value);
      if (before !== p.status) addAct(id, 'status', `${before} → ${p.status}`);
      commit(); return { ok: true, prospect: p };
    },
    deleteProspect(id) {
      if (!s.prospect(id)) return false;
      state.prospects = state.prospects.filter((p) => p.id !== id);
      state.activities = state.activities.filter((a) => a.prospectId !== id);
      state.interviews = state.interviews.filter((i) => i.prospectId !== id);
      commit(); return true;
    },

    /** Enregistre une action MANUELLE déjà réalisée par l'utilisateur (message envoyé, réponse, démo…). N'envoie rien. */
    addActivity(prospectId, input) {
      const p = s.prospect(prospectId); if (!p) return { ok: false, errors: { _: 'err.not_found' } };
      const v = validateActivity(input);
      if (!v.ok) return v;
      const { kind, text, nextAction, nextActionDate, status } = v.value;
      addAct(prospectId, kind, text);
      if (kind === 'message_sent') {
        if (!p.firstContactAt) p.firstContactAt = today();
        if (['to_research', 'to_contact'].includes(p.status)) { addAct(prospectId, 'status', `${p.status} → contacted`); p.status = 'contacted'; }
      }
      if (kind === 'reply' && ['to_contact', 'contacted', 'to_recontact'].includes(p.status)) { addAct(prospectId, 'status', `${p.status} → replied`); p.status = 'replied'; }
      if (status && status !== p.status) { addAct(prospectId, 'status', `${p.status} → ${status}`); p.status = status; }
      if (nextActionDate) { p.nextAction = nextAction; p.nextActionDate = nextActionDate; }
      else if (nextAction === '' && v.value.nextActionDate === '' && input.clearNext) { p.nextAction = ''; p.nextActionDate = ''; }
      commit(); return { ok: true };
    },
    snooze(prospectId, date) { const p = s.prospect(prospectId); if (!p) return false; p.nextActionDate = date; commit(); return true; },
    clearNextAction(prospectId) { const p = s.prospect(prospectId); if (!p) return false; p.nextAction = ''; p.nextActionDate = ''; commit(); return true; },

    saveInterview(input, id = null) {
      const v = validateInterview(input, state.prospects);
      if (!v.ok) return v;
      if (id) {
        const cur = s.interview(id); if (!cur) return { ok: false, errors: { _: 'err.not_found' } };
        Object.assign(cur, v.value);
        commit(); return { ok: true, interview: cur };
      }
      const demo = !!s.prospect(v.value.prospectId)?.demo;
      const iv = { id: nextId('I', state.interviews.map((i) => i.id)), demo, ...v.value };
      state.interviews.push(iv); commit(); return { ok: true, interview: iv };
    },
    deleteInterview(id) { const n = state.interviews.length; state.interviews = state.interviews.filter((i) => i.id !== id); if (state.interviews.length !== n) commit(); return state.interviews.length !== n; },

    updateGoals(input) { const v = validateGoals(input); if (!v.ok) return v; state.goals = v.value; commit(); return { ok: true }; },
    updateSettings(patch) {
      const name = String(patch.senderName ?? state.settings.senderName).trim().slice(0, 100);
      const lang = ['fr', 'en'].includes(patch.lang) ? patch.lang : state.settings.lang;
      state.settings = { ...state.settings, senderName: name, lang }; commit(); return { ok: true };
    },

    /** Sauvegarde complète (JSON) — référence pour préserver les données entre deux versions de l'outil. */
    exportBackup: () => JSON.stringify({ ...state, exportedAt: clock().toISOString() }, null, 2),
    importBackup(text) {
      let parsed; try { parsed = JSON.parse(text); } catch { return { ok: false, error: 'err.import_json' }; }
      const clean = sanitizeState(parsed);
      if (!clean) return { ok: false, error: 'err.import_schema' };
      state = clean; commit(); return { ok: true, prospects: clean.prospects.length };
    },
    /** Supprime uniquement les enregistrements de démonstration ; conserve les saisies réelles et les objectifs. */
    clearDemo() {
      const ids = new Set(state.prospects.filter((p) => p.demo).map((p) => p.id));
      state.prospects = state.prospects.filter((p) => !ids.has(p.id));
      state.activities = state.activities.filter((a) => !ids.has(a.prospectId));
      state.interviews = state.interviews.filter((i) => !ids.has(i.prospectId));
      commit(); return ids.size;
    },
    resetAll() { state = { ...buildSeed(clock()), prospects: [], activities: [], interviews: [], goals: { ...DEFAULT_GOALS } }; commit(); },
    loadDemo() { const d = buildSeed(clock()); const offset = state.prospects.length; if (offset) return false; state = { ...state, prospects: d.prospects, activities: d.activities, interviews: d.interviews }; commit(); return true; },
  };
  return s;
}
