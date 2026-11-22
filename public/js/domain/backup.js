// Sauvegarde / restauration / export CSV des données READYFILE AI. Logique PURE (aucun DOM, aucun stockage).
// - Une sauvegarde est une ENVELOPPE autour de l'état existant : le format des données n'est pas modifié.
// - Tout fichier importé est considéré comme non fiable : validation stricte AVANT toute modification.
// - Ne touche qu'à la clé de stockage de READYFILE AI ; un fichier d'une autre application est refusé (wrong_app).
import { t } from '../core/i18n.js';
import { fmtPeriod } from '../core/format.js';
import { DOC_TYPES, TEMPLATE_IDS } from './docTypes.js';
import { isPeriod } from './period.js';
import { ISSUE_CODES, CHECK_ORDER } from './rules.js';
import { counts, completion, dossierStatus, isOverdue, missingSlots, invalidSlots } from './dossier.js';
import { lastPreparedAt } from './followups.js';

export const APP_ID = 'readyfile-ai';
export const BACKUP_FORMAT = 'readyfile-ai-backup';
export const BACKUP_VERSION = 1; // version du FORMAT de sauvegarde (≠ version des données)
export const STATE_VERSION = 1; // doit rester égale à SEED_VERSION du store
export const MAX_BYTES = 10 * 1024 * 1024;

const EVENT_TYPES = ['client_created', 'dossier_created', 'document_received', 'analysis_done', 'message_approved'];
const CHECK_STATUSES = ['pass', 'fail', 'skipped', 'na'];
const MAX = { clients: 5000, dossiers: 20000, slots: 30, events: 100000 };

// ───────────────────────────── sauvegarde ─────────────────────────────

export function buildBackup(state, now = new Date()) {
  return {
    app: APP_ID,
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data: JSON.parse(JSON.stringify(state)), // copie : la sauvegarde ne partage rien avec l'état vivant
  };
}

export const serializeBackup = (state, now) => JSON.stringify(buildBackup(state, now), null, 2);

export const summarize = (state) => ({ clients: state.clients.length, dossiers: state.dossiers.length, events: state.events.length });

// ───────────────────────────── validation ─────────────────────────────

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v, max = 200, min = 1) => typeof v === 'string' && v.length >= min && v.length <= max;
const isDate = (v) => isStr(v, 40) && !Number.isNaN(Date.parse(v));
const isNum = (v, lo = 0, hi = 1e9) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

class Bad extends Error {
  constructor(where) { super(where); this.where = where; }
}
const need = (cond, where) => { if (!cond) throw new Bad(where); };

function checkAnalysis(a, where) {
  need(isObj(a), where);
  need(a.verdict === 'valid' || a.verdict === 'invalid', `${where}.verdict`);
  need(a.issue === null || ISSUE_CODES.includes(a.issue), `${where}.issue`);
  need(isObj(a.extraction) && isStr(a.extraction.fingerprint, 200), `${where}.extraction`);
  need(Array.isArray(a.checks) && a.checks.length <= 10 && a.checks.every((c) => isObj(c) && CHECK_ORDER.includes(c.id) && CHECK_STATUSES.includes(c.status)), `${where}.checks`);
  need(isObj(a.details) && isObj(a.details.pages) && isNum(a.details.pages.found, 0, 10000) && isNum(a.details.pages.expected, 0, 10000), `${where}.details`);
  need(a.details.detectedType == null || a.details.detectedType in DOC_TYPES, `${where}.details.detectedType`);
  need(a.details.detectedPeriod == null || isStr(a.details.detectedPeriod, 10), `${where}.details.detectedPeriod`);
  need(a.details.duplicateOf == null || (isObj(a.details.duplicateOf) && isStr(a.details.duplicateOf.fileName, 200)), `${where}.details.duplicateOf`);
  need(isObj(a.engine) && isStr(a.engine.id, 80), `${where}.engine`);
  need(isDate(a.analyzedAt), `${where}.analyzedAt`);
  return a;
}

function checkDoc(doc, where, seenDocs) {
  if (doc === null) return null;
  need(isObj(doc), where);
  need(isStr(doc.id, 40) && !seenDocs.has(doc.id), `${where}.id`);
  seenDocs.add(doc.id);
  need(isStr(doc.fileName, 200), `${where}.fileName`);
  need(isNum(doc.sizeKB, 0, 1e7), `${where}.sizeKB`);
  need(isDate(doc.receivedAt), `${where}.receivedAt`);
  need(['email', 'portal', 'manual'].includes(doc.via), `${where}.via`);
  need(Number.isInteger(doc.attempts) && doc.attempts >= 0 && doc.attempts <= 1000, `${where}.attempts`);
  need(['valid', 'invalid', 'analyzing'].includes(doc.status), `${where}.status`);
  if (doc.status === 'analyzing') {
    need(doc.pendingScenario == null || isStr(doc.pendingScenario, 30), `${where}.pendingScenario`);
    return { ...doc };
  }
  const analysis = checkAnalysis(doc.analysis, `${where}.analysis`);
  need((doc.status === 'valid') === (analysis.verdict === 'valid'), `${where}.status`); // statut cohérent avec l'analyse
  need(doc.status === 'valid' || analysis.issue !== null, `${where}.analysis.issue`);
  return { ...doc };
}

/** Valide un état complet. Retourne {ok:true, state} (copie nettoyée) ou {ok:false, where}. */
export function validateState(raw) {
  try {
    need(isObj(raw), 'data');
    need(raw.version === STATE_VERSION, 'data.version');
    need(Array.isArray(raw.clients) && raw.clients.length <= MAX.clients, 'data.clients');
    need(Array.isArray(raw.dossiers) && raw.dossiers.length <= MAX.dossiers, 'data.dossiers');
    need(Array.isArray(raw.events) && raw.events.length <= MAX.events, 'data.events');

    const clientIds = new Set();
    const clients = raw.clients.map((c, i) => {
      const w = `data.clients[${i}]`;
      need(isObj(c), w);
      need(isStr(c.id, 40) && !clientIds.has(c.id), `${w}.id`);
      clientIds.add(c.id);
      need(isStr(c.company, 120) && isStr(c.contact, 120), `${w}.company`);
      need(isStr(c.email, 200), `${w}.email`);
      need(isStr(c.country, 10), `${w}.country`);
      need(c.language === 'fr' || c.language === 'en', `${w}.language`);
      need(isDate(c.createdAt), `${w}.createdAt`);
      return { ...c };
    });

    const dossierIds = new Set();
    const slotIds = new Set();
    const docIds = new Set();
    const dossiers = raw.dossiers.map((d, i) => {
      const w = `data.dossiers[${i}]`;
      need(isObj(d), w);
      need(isStr(d.id, 40) && !dossierIds.has(d.id), `${w}.id`);
      dossierIds.add(d.id);
      need(clientIds.has(d.clientId), `${w}.clientId`);
      need(TEMPLATE_IDS.includes(d.template), `${w}.template`);
      need(isStr(d.period, 10) && isPeriod(d.period), `${w}.period`);
      need(isDate(d.createdAt) && isDate(d.dueDate), `${w}.dueDate`);
      need(isStr(d.token, 80), `${w}.token`);
      need(Array.isArray(d.slots) && d.slots.length >= 1 && d.slots.length <= MAX.slots, `${w}.slots`);
      const slots = d.slots.map((s, j) => {
        const ws = `${w}.slots[${j}]`;
        need(isObj(s), ws);
        need(isStr(s.id, 60) && !slotIds.has(s.id), `${ws}.id`);
        slotIds.add(s.id);
        need(s.type in DOC_TYPES, `${ws}.type`);
        return { ...s, doc: checkDoc(s.doc ?? null, `${ws}.doc`, docIds) };
      });
      return { ...d, slots };
    });
    need(new Set(dossiers.map((d) => d.token)).size === dossiers.length, 'data.dossiers.token'); // jetons uniques

    const eventIds = new Set();
    const events = raw.events.map((e, i) => {
      const w = `data.events[${i}]`;
      need(isObj(e), w);
      need(isStr(e.id, 40) && !eventIds.has(e.id), `${w}.id`);
      eventIds.add(e.id);
      need(isDate(e.at), `${w}.at`);
      need(EVENT_TYPES.includes(e.type), `${w}.type`);
      need(e.clientId == null || clientIds.has(e.clientId), `${w}.clientId`);
      need(e.dossierId == null || dossierIds.has(e.dossierId), `${w}.dossierId`);
      need(e.params == null || isObj(e.params), `${w}.params`);
      const p = e.params || {};
      need(p.docType == null || p.docType in DOC_TYPES, `${w}.params.docType`);
      need(p.template == null || TEMPLATE_IDS.includes(p.template), `${w}.params.template`);
      need(p.issue == null || ISSUE_CODES.includes(p.issue), `${w}.params.issue`);
      need(p.verdict == null || p.verdict === 'valid' || p.verdict === 'invalid', `${w}.params.verdict`);
      return { ...e };
    });

    const s = raw.settings;
    need(isObj(s), 'data.settings');
    need(isStr(s.firmName, 80), 'data.settings.firmName');
    need(Number.isInteger(s.retentionDays) && s.retentionDays >= 30 && s.retentionDays <= 3650, 'data.settings.retentionDays');
    need(s.analysisDelayMs == null || isNum(s.analysisDelayMs, 0, 60000), 'data.settings.analysisDelayMs');

    // Seules les clés connues sont conservées : une clé inconnue au premier niveau est ignorée, jamais copiée.
    return { ok: true, state: { version: STATE_VERSION, clients, dossiers, events, settings: { firmName: s.firmName, retentionDays: s.retentionDays, analysisDelayMs: s.analysisDelayMs ?? 1200 } } };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, where: e.where };
    throw e;
  }
}

/**
 * Lit le texte d'un fichier de sauvegarde.
 * @returns {{ok:true,state:object,meta:{exportedAt:string,counts:{clients:number,dossiers:number,events:number}}}|{ok:false,error:string,where?:string}}
 * Codes d'erreur : empty | too_large | not_json | wrong_app | newer_version | invalid
 */
export function parseBackup(text, { maxBytes = MAX_BYTES } = {}) {
  if (typeof text !== 'string' || !text.replace(/^﻿/, '').trim()) return { ok: false, error: 'empty' };
  if (text.length > maxBytes) return { ok: false, error: 'too_large' };
  let obj;
  try { obj = JSON.parse(text.replace(/^﻿/, '')); } catch { return { ok: false, error: 'not_json' }; }
  if (!isObj(obj) || obj.app !== APP_ID || obj.format !== BACKUP_FORMAT) return { ok: false, error: 'wrong_app' };
  if (!Number.isInteger(obj.formatVersion) || obj.formatVersion < 1) return { ok: false, error: 'invalid', where: 'formatVersion' };
  if (obj.formatVersion > BACKUP_VERSION) return { ok: false, error: 'newer_version' };
  const v = validateState(obj.data);
  if (!v.ok) return { ok: false, error: 'invalid', where: v.where };
  return { ok: true, state: v.state, meta: { exportedAt: isDate(obj.exportedAt) ? obj.exportedAt : null, counts: summarize(v.state) } };
}

// ───────────────────────────── export CSV (Excel) ─────────────────────────────

export const csvSeparator = (lang) => (lang === 'en' ? ',' : ';');

/** Neutralise l'injection de formules (=, +, -, @, tabulation, retour chariot en début de texte) et protège les séparateurs. */
export function csvCell(value, sep) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return new RegExp(`[${sep === ',' ? ',' : ';'}"\\r\\n]`).test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const day = (iso) => (iso ? String(iso).slice(0, 10) : '');
export const CSV_COLUMNS = ['dossier', 'client', 'contact', 'email', 'country', 'template', 'period', 'created', 'due', 'overdue', 'status', 'completion', 'expected', 'received', 'valid', 'to_fix', 'analyzing', 'missing_count', 'missing_list', 'to_fix_list', 'last_prepared'];

/**
 * CSV : une ligne par dossier (+ une ligne par client sans dossier). Lignes séparées par CRLF.
 * Le BOM UTF-8 est ajouté au téléchargement (voir ui/download.js), pas ici.
 */
export function buildCsv(state, { lang = 'fr', now = new Date() } = {}) {
  const sep = csvSeparator(lang);
  const tr = (k, p) => t(k, p || {}, lang);
  const line = (cells) => cells.map((c) => csvCell(c, sep)).join(sep);
  const docs = (slots) => slots.map((s) => tr(`doc.${s.type}`)).join(' | ');
  const clientOf = (id) => state.clients.find((c) => c.id === id) || {};
  const rows = [line(CSV_COLUMNS.map((c) => tr(`csv.col.${c}`)))];
  const yes = tr('csv.yes');
  const no = tr('csv.no');

  for (const d of state.dossiers) {
    const c = clientOf(d.clientId);
    const k = counts(d);
    const status = dossierStatus(d);
    rows.push(line([
      d.id, c.company, c.contact, c.email, c.country, tr(`tpl.${d.template}`), fmtPeriod(d.period, lang), day(d.createdAt), day(d.dueDate),
      isOverdue(d, now) ? yes : no, tr(`status.${status}`), completion(d), k.expected, k.received, k.valid, k.invalid, k.analyzing, k.missing,
      docs(missingSlots(d)), docs(invalidSlots(d)), day(lastPreparedAt(state.events, d.id)),
    ]));
  }
  const withDossier = new Set(state.dossiers.map((d) => d.clientId));
  for (const c of state.clients.filter((x) => !withDossier.has(x.id))) {
    rows.push(line(CSV_COLUMNS.map((col) => ({ client: c.company, contact: c.contact, email: c.email, country: c.country }[col] ?? ''))));
  }
  return rows.join('\r\n') + '\r\n';
}
