// Store applicatif : état, persistance locale (localStorage du navigateur — démonstration uniquement),
// actions métier. Aucune sécurité ni authentification de production ici.
import { buildSeed, SEED_VERSION } from './seed.js';
import { createDossier, nextId, slotState } from '../domain/dossier.js';
import { validateClient, validateDossier, validateSettings } from '../domain/validation.js';
import { analyzeDocument } from '../engine/index.js';
import { serializeBackup, validateState } from '../domain/backup.js';

const KEY = 'readyfile-ai-demo';

export function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
}

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    s.setItem('__probe', '1');
    s.removeItem('__probe');
    return s;
  } catch {
    return memoryStorage(); // navigation privée / stockage bloqué
  }
}

export function createStore({ storage = safeStorage(), clock = () => new Date(), delayMs } = {}) {
  let state;
  const listeners = new Set();
  const inFlight = new Set();

  function load() {
    try {
      const raw = storage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === SEED_VERSION && Array.isArray(parsed.clients) && Array.isArray(parsed.dossiers)) return parsed;
      }
    } catch {
      /* données corrompues : on reconstruit */
    }
    return buildSeed(clock());
  }

  function persist() {
    try {
      storage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota / stockage indisponible : l'app reste utilisable en mémoire */
    }
  }
  const emit = () => listeners.forEach((fn) => fn(state));
  const commit = () => {
    persist();
    emit();
  };

  state = load();
  persist(); // fige les données de démonstration dès le premier chargement

  const addEvent = (type, p) => {
    const id = nextId('EV', state.events.map((e) => e.id), 4);
    state.events.push({ id, at: clock().toISOString(), type, ...p });
  };

  const store = {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    client: (id) => state.clients.find((c) => c.id === id),
    dossier: (id) => state.dossiers.find((d) => d.id === id),
    dossierByToken: (token) => state.dossiers.find((d) => d.token === token),
    eventsFor({ clientId, dossierId } = {}) {
      return state.events
        .filter((e) => (!clientId || e.clientId === clientId) && (!dossierId || e.dossierId === dossierId))
        .sort((a, b) => b.at.localeCompare(a.at));
    },

    addClient(input) {
      const v = validateClient(input);
      if (!v.ok) return v;
      const id = nextId('CLI', state.clients.map((c) => c.id));
      const client = { id, ...v.value, createdAt: clock().toISOString() };
      state.clients.push(client);
      addEvent('client_created', { clientId: id, params: { company: client.company } });
      commit();
      return { ok: true, client };
    },

    addDossier(input) {
      const v = validateDossier(input, state.clients);
      if (!v.ok) return v;
      const id = nextId('DOS', state.dossiers.map((d) => d.id));
      const dossier = createDossier({ id, ...v.value, now: clock() });
      state.dossiers.push(dossier);
      addEvent('dossier_created', { clientId: dossier.clientId, dossierId: id, params: { template: dossier.template, period: dossier.period } });
      commit();
      return { ok: true, dossier };
    },

    /** Dépôt (fictif) d'un document : passe en « analyse en cours », puis résout après un délai. */
    submitDocument(dossierId, slotId, { fileName, sizeKB = 240, scenario = 'auto', via = 'portal' }) {
      const dossier = store.dossier(dossierId);
      const slot = dossier?.slots.find((s) => s.id === slotId);
      if (!slot) return Promise.resolve({ ok: false, error: 'not_found' });
      if (slotState(slot) === 'valid') return Promise.resolve({ ok: false, error: 'already_valid' });
      const name = String(fileName || '').trim().slice(0, 120);
      if (!name) return Promise.resolve({ ok: false, error: 'no_file' });
      const docId = nextId('DOC', state.dossiers.flatMap((d) => d.slots.map((s) => s.doc?.id).filter(Boolean)), 4);
      slot.doc = {
        id: docId,
        fileName: name,
        sizeKB: Math.max(1, Math.round(sizeKB)),
        receivedAt: clock().toISOString(),
        via,
        status: 'analyzing',
        pendingScenario: scenario,
        attempts: (slot.doc?.attempts || 0) + 1,
      };
      addEvent('document_received', { clientId: dossier.clientId, dossierId, params: { docType: slot.type, fileName: name } });
      commit();
      const wait = delayMs ?? state.settings.analysisDelayMs ?? 0;
      return new Promise((r) => setTimeout(r, wait)).then(async () => ({ ok: true, analysis: await store.resolveAnalysis(dossierId, slotId, docId) }));
    },

    /** Exécute l'analyse (simulée) d'un document en attente. Idempotent. */
    async resolveAnalysis(dossierId, slotId, docId) {
      const dossier = store.dossier(dossierId);
      const slot = dossier?.slots.find((s) => s.id === slotId);
      const doc = slot?.doc;
      const key = `${dossierId}:${slotId}`;
      if (!doc || doc.status !== 'analyzing' || (docId && doc.id !== docId) || inFlight.has(key)) return null;
      inFlight.add(key);
      try {
        const others = dossier.slots
          .filter((s) => s.id !== slotId && s.doc?.analysis)
          .map((s) => ({ documentId: s.doc.id, fileName: s.doc.fileName, fingerprint: s.doc.analysis.extraction.fingerprint }));
        const analysis = await analyzeDocument(
          { fileName: doc.fileName, sizeKB: doc.sizeKB, expected: { type: slot.type, period: dossier.period }, scenario: doc.pendingScenario },
          others,
          { now: clock() },
        );
        if (slot.doc !== doc) return null; // remplacé entre-temps
        doc.analysis = analysis;
        doc.status = analysis.verdict === 'valid' ? 'valid' : 'invalid';
        delete doc.pendingScenario;
        addEvent('analysis_done', { clientId: dossier.clientId, dossierId, params: { docType: slot.type, verdict: analysis.verdict, issue: analysis.issue } });
        commit();
        return analysis;
      } finally {
        inFlight.delete(key);
      }
    },

    /** Trace l'approbation humaine d'un message. Rien n'est envoyé. */
    recordMessageApproved(dossierId, { lang, count }) {
      const dossier = store.dossier(dossierId);
      if (!dossier) return false;
      addEvent('message_approved', { clientId: dossier.clientId, dossierId, params: { lang, count } });
      commit();
      return true;
    },

    updateSettings(input) {
      const v = validateSettings(input);
      if (!v.ok) return v;
      state.settings = { ...state.settings, ...v.value };
      commit();
      return { ok: true };
    },

    /** Sauvegarde complète (JSON) de l'état courant. Ne touche à rien. */
    exportBackup: () => serializeBackup(state, clock()),

    /**
     * Remplace TOUT l'état par un état déjà validé (restauration). À n'appeler qu'après confirmation explicite.
     * Revalide, vérifie que l'écriture a réellement réussi, sinon revient à l'état précédent (rien n'est perdu).
     */
    replaceState(next) {
      const v = validateState(next);
      if (!v.ok) return { ok: false, error: 'invalid', where: v.where };
      const previous = state;
      const json = JSON.stringify(v.state);
      let stored = false;
      try {
        storage.setItem(KEY, json);
        stored = storage.getItem(KEY) === json;
      } catch { /* stockage plein ou bloqué */ }
      if (!stored) {
        try { storage.setItem(KEY, JSON.stringify(previous)); } catch { /* rien de plus à faire */ }
        return { ok: false, error: 'storage' };
      }
      state = v.state;
      emit();
      return { ok: true };
    },

    resetDemo() {
      state = buildSeed(clock());
      commit();
    },
  };
  return store;
}
