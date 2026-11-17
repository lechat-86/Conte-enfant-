import { h } from '../core/html.js';
import { t, getLang } from '../core/i18n.js';
import { icon } from './icons.js';
import { fmtDate, fmtDateTime } from '../core/format.js';
import { segmentOf } from '../domain/constants.js';

export const link = (p) => `#${p}`;
export const statusBadge = (s) => h`<span class="badge gs-${s}">${t(`status.${s}`)}</span>`;
export const segBadge = (country) => h`<span class="badge b-seg">${country} · ${t(`seg.${segmentOf(country)}`)}</span>`;
export const demoBadge = () => h`<span class="badge b-demo">${t('demo.badge')}</span>`;
export const tagList = (prefix, tags) => (tags?.length ? h`<span class="tags">${tags.map((x) => h`<span class="tag">${t(`${prefix}.${x}`)}</span>`)}</span>` : h`<span class="muted">—</span>`);

export function pageHeader({ title, sub, actions, back }) {
  return h`<header class="page-head"><div>${back ? h`<a class="crumb" href="${back.href}">${icon('back', 14)}${back.label}</a>` : ''}<h1>${title}</h1>${sub ? h`<p class="sub">${sub}</p>` : ''}</div>${actions ? h`<div class="head-actions">${actions}</div>` : ''}</header>`;
}
export function field({ id, label, error, hint, children }) {
  return h`<div class="field ${error ? 'has-error' : ''}"><label for="${id}">${label}</label>${children}${hint && !error ? h`<p class="hint">${hint}</p>` : ''}${error ? h`<p class="err" id="${id}-err" role="alert">${t(error)}</p>` : ''}</div>`;
}
export function langToggle() {
  const cur = getLang();
  return h`<div class="seg" role="group" aria-label="${t('common.language')}">${['fr', 'en'].map((l) => h`<button type="button" class="seg-btn" data-action="set-lang" data-lang="${l}" aria-pressed="${String(cur === l)}" lang="${l}">${l.toUpperCase()}</button>`)}</div>`;
}
export function emptyState({ iconName = 'inbox', title, text, action }) {
  return h`<div class="empty">${icon(iconName, 28)}<h3>${title}</h3>${text ? h`<p>${text}</p>` : ''}${action || ''}</div>`;
}
export const tagCheckboxes = (name, prefix, all, selected = []) => h`<div class="tag-pick" role="group">${all.map((x) => h`<label class="tag-opt"><input type="checkbox" name="${name}" value="${x}" ${selected.includes(x) ? 'checked' : ''}><span>${t(`${prefix}.${x}`)}</span></label>`)}</div>`;
export const selectOptions = (prefix, all, selected) => all.map((x) => h`<option value="${x}" ${String(selected) === String(x) ? 'selected' : ''}>${t(`${prefix}.${x}`)}</option>`);

const ACT_ICON = { note: 'note', message_sent: 'mail', reply: 'inbox', call: 'chat', meeting: 'users', demo_done: 'play', status: 'refresh' };
export function activityList(acts, { limit = 50 } = {}) {
  if (!acts.length) return h`<p class="muted">${t('common.no_activity')}</p>`;
  return h`<ol class="timeline">${acts.slice(0, limit).map((a) => h`<li class="tl-item"><span class="tl-dot">${icon(ACT_ICON[a.kind] || 'note', 14)}</span><div>
    <p><strong>${t(`kind.${a.kind}`)}</strong>${a.kind === 'status' ? h` — ${a.text.split(' → ').map((s) => t(`status.${s}`)).join(' → ')}` : a.text ? h` — ${a.text}` : ''}</p>
    <p class="meta">${fmtDateTime(a.at)}</p></div></li>`)}</ol>`;
}
export const dateText = fmtDate;
