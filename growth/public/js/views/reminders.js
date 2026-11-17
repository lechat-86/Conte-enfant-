import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtDate } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, statusBadge, link, emptyState } from '../ui/components.js';
import { computeReminders } from '../domain/reminders.js';
import { addDays, ymd } from '../domain/dates.js';
import { onClick } from '../core/actions.js';
import { getStore } from '../core/bus.js';
import { toast } from '../ui/toast.js';
import { openActivityModal } from './prospectDetail.js';

function card(p, { today, lateDays }) {
  const late = p.nextActionDate && p.nextActionDate < today;
  return h`<li class="rem-card" data-id="${p.id}">
    <div class="rem-main"><a href="${link(`/prospects/${p.id}`)}"><strong>${p.firm}</strong></a> ${statusBadge(p.status)}
      <p>${p.nextAction || h`<span class="muted">${t('rem.no_action_text')}</span>`}</p>
      <p class="meta ${late ? 'bad-text' : ''}">${p.nextActionDate ? fmtDate(p.nextActionDate) : '—'}${late ? ` · ${t('rem.days_late', { n: lateDays(p) })}` : ''}${p.contactName ? ` · ${p.contactName}` : ''}</p></div>
    <div class="rem-actions">
      <button class="btn btn-sm btn-primary" data-action="act-open" data-id="${p.id}" data-kind="note">${icon('note', 14)}${t('rem.note')}</button>
      <a class="btn btn-sm" href="${link(`/templates?prospect=${p.id}`)}">${icon('mail', 14)}${t('rem.message')}</a>
      <span class="snooze" role="group" aria-label="${t('rem.snooze')}">${[1, 3, 7].map((n) => h`<button class="btn btn-sm" data-action="snooze" data-id="${p.id}" data-days="${n}" title="${t('rem.snooze')}">+${n}${t('rem.d')}</button>`)}</span>
    </div></li>`;
}

function section(key, list, ctx, extra = '') {
  return h`<section class="card rem-section" data-testid="rem-${key}" data-count="${list.length}">
    <div class="card-head"><h2>${t(`rem.${key}`)} <span class="count-pill">${list.length}</span></h2></div>
    <p class="muted small">${t(`rem.${key}_hint`)}</p>
    ${list.length ? h`<ul class="rem-list">${list.map((p) => card(p, ctx))}</ul>` : h`<p class="muted">${t('rem.none')}</p>`}${extra}</section>`;
}

export function render({ state, today }) {
  const r = computeReminders(state, today);
  const ctx = { today, lateDays: r.lateDays };
  return h`
    ${pageHeader({ title: t('rem.title'), sub: t('rem.sub') })}
    <div class="note note-warn" role="note">${icon('shield', 18)}<p>${t('rem.no_auto')}</p></div>
    <div class="rem-grid">
      ${section('overdue', r.overdue, ctx)}
      ${section('today', r.today, ctx)}
      ${section('replies', r.replies, ctx)}
      ${section('demos', r.demos, ctx)}
      ${section('unplanned', r.unplanned, ctx)}
    </div>`;
}

onClick({
  snooze: (el) => {
    const store = getStore();
    const p = store.prospect(el.dataset.id);
    const today = ymd();
    const base = p.nextActionDate && p.nextActionDate > today ? p.nextActionDate : today; // jamais dans le passé
    store.snooze(p.id, addDays(base, Number(el.dataset.days)));
    toast(t('rem.snoozed'), 'success');
  },
});
export const _o = openActivityModal;
