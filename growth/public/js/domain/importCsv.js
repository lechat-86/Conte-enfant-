// Import CSV de prospects — logique PURE (aucun DOM, aucun réseau, aucun stockage).
// Principes : rien n'est ajouté sans validation de l'utilisateur ; on n'écrase JAMAIS un prospect existant ;
// aucune adresse e-mail n'est acceptée sans preuve (source publique + vérification déclarée) ; aucune donnée n'est inventée.
import { csvCell } from './csv.js';
import { validateProspect, isHttpUrl } from './validation.js';
import { isYmd } from './dates.js';

export const MAX_FILE_CHARS = 2_000_000;
export const MAX_ROWS = 1000;

/** Colonnes acceptées, dans l'ordre du modèle. * = obligatoire. */
export const IMPORT_COLUMNS = ['firm', 'country', 'source_url', 'city', 'website', 'contact_name', 'contact_role', 'contact_email', 'email_verified', 'email_source_url', 'source_verified_on', 'status', 'next_action', 'next_action_date', 'budget_monthly_eur', 'notes'];
export const REQUIRED_COLUMNS = ['firm', 'country', 'source_url'];
/** Colonnes présentes dans nos propres rapports : tolérées (ignorées sans avertissement) pour permettre de corriger puis réimporter. */
export const REPORT_COLUMNS = ['line_number', 'refusal_reasons', 'refusal_text'];
/** Statuts autorisés à l'import : un import ne peut jamais prétendre qu'un contact ou un échange a eu lieu. */
export const IMPORT_STATUSES = ['to_research', 'to_contact'];

export const REASONS = ['bad_column_count', 'invalid_firm', 'invalid_country', 'missing_source_url', 'invalid_source_url', 'invalid_website', 'invalid_email', 'email_free_provider', 'email_unverified', 'email_source_invalid', 'invalid_date', 'invalid_budget', 'status_not_allowed', 'action_needed', 'too_long', 'duplicate_existing', 'duplicate_in_file'];

const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.fr', 'yahoo.co.uk', 'hotmail.com', 'hotmail.fr', 'hotmail.co.uk', 'outlook.com', 'outlook.fr', 'live.com', 'live.fr', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'gmx.com', 'gmx.fr', 'proton.me', 'protonmail.com', 'btinternet.com', 'sky.com', 'talktalk.net']);
const COUNTRY_ALIASES = { france: 'FR', uk: 'GB', 'united kingdom': 'GB', 'royaume-uni': 'GB', 'great britain': 'GB', gb: 'GB', fr: 'FR' };
const LEGAL = new Set(['sarl', 'sas', 'sasu', 'sa', 'eurl', 'sci', 'scp', 'ltd', 'limited', 'llp', 'plc', 'inc', 'llc']);

export class ImportError extends Error { constructor(code, extra = {}) { super(code); this.code = code; Object.assign(this, extra); } }

/** Analyseur CSV RFC 4180 : guillemets, guillemets échappés (""), retours à la ligne dans les champs, CRLF/LF. */
export function parseCsv(text, delimiter = ',') {
  const rows = []; let row = []; let cell = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += c;
    } else if (c === '"' && cell === '') inQ = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (inQ) throw new ImportError('unterminated_quote');
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

function detectDelimiter(text) {
  const first = text.split(/\r?\n/, 1)[0] || '';
  let inQ = false; let commas = 0; let semis = 0;
  for (const c of first) { if (c === '"') inQ = !inQ; else if (!inQ) { if (c === ',') commas++; else if (c === ';') semis++; } }
  return semis > commas ? ';' : ',';
}

const normHeader = (h) => h.replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, '_');

/** Lit le fichier : en-têtes, colonnes ignorées, enregistrements. Ne valide pas encore les lignes. */
export function parseImportFile(text) {
  try {
    if (typeof text !== 'string' || !text.replace(/^﻿/, '').trim()) throw new ImportError('empty');
    if (text.length > MAX_FILE_CHARS) throw new ImportError('too_large');
    const table = parseCsv(text.replace(/^﻿/, ''), detectDelimiter(text.replace(/^﻿/, '')));
    if (table.length < 1) throw new ImportError('empty');
    const header = table[0].map(normHeader);
    const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
    if (missing.length) throw new ImportError('missing_columns', { missing });
    if (new Set(header).size !== header.length) throw new ImportError('duplicate_columns');
    const body = table.slice(1);
    if (!body.length) throw new ImportError('no_rows');
    if (body.length > MAX_ROWS) throw new ImportError('too_many_rows', { max: MAX_ROWS });
    const known = new Set([...IMPORT_COLUMNS, ...REPORT_COLUMNS]);
    return {
      ok: true, header, ignoredColumns: header.filter((h) => h && !known.has(h)),
      records: body.map((cells, i) => ({ line: i + 2, cells, raw: cells.length === header.length ? Object.fromEntries(header.map((h, k) => [h, cells[k].trim()])) : null })),
    };
  } catch (e) {
    if (e instanceof ImportError) return { ok: false, error: e.code, missing: e.missing, max: e.max };
    throw e;
  }
}

export function normName(s) {
  const base = String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  const stripped = base.split(' ').filter((t) => t && !LEGAL.has(t)).join(' ');
  return stripped || base;
}
export function siteHost(url) {
  const s = String(url ?? '').trim();
  if (!s) return '';
  try { return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}
const countryOf = (s) => { const k = String(s ?? '').trim(); return COUNTRY_ALIASES[k.toLowerCase()] || k.toUpperCase(); };
const truthy = (v) => ['yes', 'oui', 'true', '1', 'y'].includes(String(v ?? '').trim().toLowerCase());

/** Clé de doublon d'un prospect : même site OU même nom normalisé dans le même pays. */
export function findDuplicate(candidate, pool) {
  const host = siteHost(candidate.website); const name = normName(candidate.firm);
  for (const p of pool) {
    if (host && siteHost(p.website) === host) return p;
    if (p.country === candidate.country && name && normName(p.firm) === name) return p;
  }
  return null;
}

const ERROR_TO_REASON = (field, key) => {
  if (key === 'err.too_long') return 'too_long';
  return { firm: 'invalid_firm', country: 'invalid_country', website: 'invalid_website', contactEmail: 'invalid_email', emailSourceUrl: 'email_source_invalid',
    nextActionDate: 'invalid_date', sourceVerifiedAt: 'invalid_date', nextAction: 'action_needed', budgetMonthly: 'invalid_budget', status: 'status_not_allowed' }[field]
    || (field === 'sourceUrl' ? (key === 'err.source_required' ? 'missing_source_url' : 'invalid_source_url') : 'too_long');
};

/**
 * Évalue chaque enregistrement. Retourne des lignes { line, raw, status:'valid'|'refused', reasons[], value?, duplicateOf? }.
 * @param {Array} records issus de parseImportFile
 * @param {Array} existing prospects déjà présents (jamais modifiés)
 * @param {string} today AAAA-MM-JJ (pour refuser une date de vérification future)
 */
export function evaluateRecords(records, existing, today) {
  const accepted = []; const out = [];
  for (const rec of records) {
    const reasons = []; let duplicateOf = null; let value = null;
    const raw = rec.raw;
    if (!raw) reasons.push('bad_column_count');
    else {
      const email = raw.contact_email || '';
      const input = {
        firm: raw.firm, country: countryOf(raw.country), city: raw.city, website: raw.website, contactName: raw.contact_name, contactRole: raw.contact_role,
        contactEmail: '', emailLegit: false, emailSourceUrl: '', sourceUrl: raw.source_url, sourceVerifiedAt: raw.source_verified_on,
        status: raw.status || 'to_research', notes: raw.notes, nextAction: raw.next_action, nextActionDate: raw.next_action_date, budgetMonthly: raw.budget_monthly_eur,
      };
      if (!IMPORT_STATUSES.includes(input.status)) reasons.push('status_not_allowed');
      if (raw.source_verified_on && isYmd(raw.source_verified_on) && raw.source_verified_on > today) reasons.push('invalid_date');
      // E-mail : jamais deviné, jamais accepté sans source publique ET vérification déclarée.
      if (email) {
        const domain = email.includes('@') ? email.split('@').pop().toLowerCase() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) reasons.push('invalid_email');
        else if (FREE_MAIL.has(domain)) reasons.push('email_free_provider');
        else if (!truthy(raw.email_verified)) reasons.push('email_unverified');
        else if (!isHttpUrl(raw.email_source_url || '')) reasons.push('email_source_invalid');
        else Object.assign(input, { contactEmail: email, emailLegit: true, emailSourceUrl: raw.email_source_url });
      }
      const v = validateProspect(input);
      for (const [field, key] of Object.entries(v.errors)) { if (field === 'emailLegit') continue; reasons.push(ERROR_TO_REASON(field, key)); }
      if (!reasons.length) {
        const dupEx = findDuplicate(v.value, existing);
        const dupFile = dupEx ? null : findDuplicate(v.value, accepted);
        if (dupEx) { reasons.push('duplicate_existing'); duplicateOf = { id: dupEx.id, firm: dupEx.firm }; }
        else if (dupFile) { reasons.push('duplicate_in_file'); duplicateOf = { line: dupFile.__line, firm: dupFile.firm }; }
        else { value = v.value; accepted.push({ ...v.value, __line: rec.line }); }
      }
    }
    out.push({ line: rec.line, raw, cells: rec.cells, status: reasons.length ? 'refused' : 'valid', reasons: [...new Set(reasons)], ...(value ? { value } : {}), ...(duplicateOf ? { duplicateOf } : {}) });
  }
  return out;
}

export const summarize = (rows) => ({ total: rows.length, valid: rows.filter((r) => r.status === 'valid').length, refused: rows.filter((r) => r.status === 'refused').length });

/** CSV d'import vide (en-têtes seulement). Aucune ligne d'exemple : rien ne peut être importé par erreur. */
export const templateCsv = () => `${IMPORT_COLUMNS.join(',')}\r\n`;

/** Rapport des lignes refusées : colonnes d'origine + motifs, pour corriger puis réimporter. */
export function refusalReportCsv(rows, reasonText = (c) => c) {
  const refused = rows.filter((r) => r.status === 'refused');
  const header = ['line_number', ...IMPORT_COLUMNS, 'refusal_reasons', 'refusal_text'];
  const lines = refused.map((r) => [r.line, ...IMPORT_COLUMNS.map((c) => r.raw?.[c] ?? (r.raw ? '' : '')), r.reasons.join('|'), r.reasons.map((x) => reasonText(x, r)).join(' ; ')]);
  return [header, ...lines].map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
