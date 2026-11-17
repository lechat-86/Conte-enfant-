import { h, raw } from '../core/html.js';
import { t, getLang } from '../core/i18n.js';
import { icon } from './icons.js';
import { fmtDateTime, fmtPeriod, fmtYear } from '../core/format.js';
import { DOC_TYPES } from '../domain/docTypes.js';

export const link = (path) => `#${path}`;

export const docName = (type, lang) => t(`doc.${type}`, {}, lang);

export const periodText = (type, period) => {
  const g = DOC_TYPES[type]?.granularity;
  if (!g) return '—';
  return g === 'year' ? fmtYear(period) : fmtPeriod(period);
};

const STATUS_ICON = { complete: 'check', pending: 'clock', to_fix: 'alert', analyzing: 'scan', valid: 'check', invalid: 'alert', missing: 'clock' };
const STATUS_CLASS = { valid: 'complete', invalid: 'to_fix', missing: 'pending' };

/** Badge de statut de dossier (complete|pending|to_fix|analyzing) ou d'état de document (valid|invalid|missing|analyzing). */
export function statusBadge(status, { doc = false } = {}) {
  const cls = STATUS_CLASS[status] || status;
  const label = doc ? t(`docstate.${status}`) : t(`status.${status}`);
  return h`<span class="badge b-${cls}" data-status="${status}">${icon(STATUS_ICON[status], 14)}<span>${label}</span></span>`;
}

export function issueBadge(code) {
  return h`<span class="badge b-to_fix">${icon('alert', 14)}<span>${t(`issue.${code}`)}</span></span>`;
}

export function progress(pct, status = 'analyzing', { label = true } = {}) {
  const cls = status === 'complete' ? 'complete' : status === 'to_fix' ? 'to_fix' : status === 'pending' ? 'pending' : 'analyzing';
  return h`<div class="progress-row"><div class="progress p-${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>${label ? h`<span class="pct">${pct}%</span>` : ''}</div>`;
}

export function avatar(name, size = 'md') {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  let n = 0;
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) % 360;
  return h`<span class="avatar av-${size}" style="--h:${n}" aria-hidden="true">${initials}</span>`;
}

export function pageHeader({ title, sub, actions, back }) {
  return h`<header class="page-head">
    <div>
      ${back ? h`<a class="crumb" href="${back.href}">${icon('back', 14)}${back.label}</a>` : ''}
      <h1>${title}</h1>
      ${sub ? h`<p class="sub">${sub}</p>` : ''}
    </div>
    ${actions ? h`<div class="head-actions">${actions}</div>` : ''}
  </header>`;
}

export function emptyState({ iconName = 'search', title, text, action }) {
  return h`<div class="empty">${icon(iconName, 28)}<h3>${title}</h3>${text ? h`<p>${text}</p>` : ''}${action || ''}</div>`;
}

export function field({ id, label, error, hint, children }) {
  return h`<div class="field ${error ? 'has-error' : ''}">
    <label for="${id}">${label}</label>
    ${children}
    ${hint && !error ? h`<p class="hint">${hint}</p>` : ''}
    ${error ? h`<p class="err" id="${id}-err" role="alert">${t(error)}</p>` : ''}
  </div>`;
}

export function langToggle() {
  const cur = getLang();
  return h`<div class="seg" role="group" aria-label="${t('common.language')}">
    ${['fr', 'en'].map((l) => h`<button type="button" class="seg-btn" data-action="set-lang" data-lang="${l}" aria-pressed="${cur === l}" lang="${l}">${l.toUpperCase()}</button>`)}
  </div>`;
}

export function simBanner(textKey = 'sim.banner') {
  return h`<div class="note note-sim" role="note">${icon('info', 18)}<p>${t(textKey)}</p></div>`;
}

const EV_ICON = { client_created: 'users', dossier_created: 'folder', document_received: 'upload', message_approved: 'mail' };

/** Texte traduit d'un évènement d'historique. */
export function eventText(ev, store) {
  const p = ev.params || {};
  const doc = p.docType ? docName(p.docType) : '';
  switch (ev.type) {
    case 'client_created':
      return t('event.client_created', { company: p.company });
    case 'dossier_created':
      return t('event.dossier_created', { dossier: ev.dossierId, template: t(`tpl.${p.template}`), period: fmtPeriod(p.period) });
    case 'document_received':
      return t('event.document_received', { doc, file: p.fileName });
    case 'analysis_done':
      return p.verdict === 'valid' ? t('event.analysis.ok', { doc }) : t(`event.analysis.${p.issue}`, { doc });
    case 'message_approved':
      return t('event.message_approved', { lang: String(p.lang || '').toUpperCase(), count: p.count });
    default:
      return ev.type;
  }
}

export function timeline(events, store, { limit = 10, showClient = false } = {}) {
  if (!events.length) return h`<p class="muted">${t('common.no_history')}</p>`;
  return h`<ol class="timeline">${events.slice(0, limit).map((ev) => {
    const bad = ev.type === 'analysis_done' && ev.params.verdict !== 'valid';
    const ok = ev.type === 'analysis_done' && ev.params.verdict === 'valid';
    const ic = ev.type === 'analysis_done' ? (ok ? 'check' : 'alert') : EV_ICON[ev.type] || 'file';
    const client = showClient && ev.clientId ? store.client(ev.clientId) : null;
    return h`<li class="tl-item ${bad ? 'tl-bad' : ''} ${ok ? 'tl-ok' : ''}">
      <span class="tl-dot">${icon(ic, 14)}</span>
      <div><p>${eventText(ev, store)}</p>
      <p class="meta">${client ? h`<a href="${link(`/clients/${client.id}`)}">${client.company}</a> · ` : ''}${ev.dossierId && !showClient ? h`<a href="${link(`/dossiers/${ev.dossierId}`)}">${ev.dossierId}</a> · ` : ''}${fmtDateTime(ev.at)}</p></div>
    </li>`;
  })}</ol>`;
}

export const rawIcon = (n, s) => icon(n, s);
export { raw };
