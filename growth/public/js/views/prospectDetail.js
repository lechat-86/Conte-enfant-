import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtDate, fmtEur } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, statusBadge, segBadge, demoBadge, link, field, tagList, activityList, emptyState, selectOptions } from '../ui/components.js';
import { STATUSES, USER_ACTIVITY_KINDS } from '../domain/constants.js';
import { onClick, onChange, onSubmit } from '../core/actions.js';
import { openModal, closeModal, refreshModal } from '../ui/modals.js';
import { getStore, navigate, rerender } from '../core/bus.js';
import { toast } from '../ui/toast.js';
import { addDays, ymd } from '../domain/dates.js';
import { readForm } from './prospectForm.js';

let act = { prospectId: null, values: {}, errors: {} };

export function render({ store, params, today }) {
  const p = store.prospect(params.id);
  if (!p) return emptyState({ title: t('common.not_found'), text: t('prospects.not_found'), action: h`<a class="btn" href="${link('/prospects')}">${t('common.back')}</a>` });
  const acts = store.activitiesOf(p.id);
  const ivs = store.interviewsOf(p.id);
  const late = p.nextActionDate && p.nextActionDate < today && !['paying', 'refused'].includes(p.status);
  const dl = (k, v) => h`<dt>${t(k)}</dt><dd>${v || h`<span class="muted">—</span>`}</dd>`;
  return h`
    ${pageHeader({
      back: { href: link('/prospects'), label: t('prospects.title') },
      title: h`${p.firm} ${p.demo ? demoBadge() : ''}`,
      sub: h`${statusBadge(p.status)} ${segBadge(p.country)} · ${p.city || '—'}`,
      actions: h`<a class="btn" href="${link(`/templates?prospect=${p.id}`)}">${icon('mail')}${t('prospect.prepare_message')}</a><a class="btn" href="${link(`/prospects/${p.id}/edit`)}">${icon('edit')}${t('common.edit')}</a><button class="btn btn-danger" data-action="delete-prospect" data-id="${p.id}">${icon('trash')}${t('common.delete')}</button>`,
    })}
    <section class="grid-main">
      <div class="stack-col">
        <article class="card next-card ${late ? 'late' : ''}" data-testid="next-action">
          <div class="card-head"><h2>${t('prospects.next_action')}</h2>${late ? h`<span class="badge b-to_fix">${t('rem.late_badge')}</span>` : ''}</div>
          ${p.nextAction || p.nextActionDate ? h`<p class="na-text"><strong>${p.nextAction}</strong> <span class="muted">· ${fmtDate(p.nextActionDate)}</span></p>` : h`<p class="muted">${t('prospect.no_next')}</p>`}
          <div class="btn-row">
            <button class="btn btn-sm btn-primary" data-action="act-open" data-id="${p.id}" data-kind="message_sent">${icon('mail', 14)}${t('prospect.log_sent')}</button>
            <button class="btn btn-sm" data-action="act-open" data-id="${p.id}" data-kind="reply">${icon('inbox', 14)}${t('prospect.log_reply')}</button>
            <button class="btn btn-sm" data-action="act-open" data-id="${p.id}" data-kind="demo_done">${icon('play', 14)}${t('prospect.log_demo')}</button>
            <button class="btn btn-sm" data-action="act-open" data-id="${p.id}" data-kind="note">${icon('note', 14)}${t('prospect.add_note')}</button>
          </div>
          <p class="hint">${t('prospect.manual_notice')}</p>
        </article>
        <article class="card">
          <div class="card-head"><h2>${t('prospect.details')}</h2><label class="inline-select">${t('prospects.status')} <select data-change="quick-status" data-id="${p.id}" aria-label="${t('prospects.status')}">${STATUSES.map((s) => h`<option value="${s}" ${p.status === s ? 'selected' : ''}>${t(`status.${s}`)}</option>`)}</select></label></div>
          <dl class="kv">
            ${dl('prospects.contact_name', p.contactName)}${dl('prospects.contact_role', p.contactRole)}
            ${dl('prospects.contact_email', p.contactEmail ? h`${p.contactEmail} ${p.emailLegit ? h`<span class="badge b-complete">${t('prospect.email_ok')}</span>` : ''}` : '')}
            ${dl('prospects.website', p.website ? h`<a href="${p.website}" rel="noopener noreferrer nofollow" target="_blank">${p.website}</a>` : '')}
            ${dl('prospects.source_url', p.sourceUrl ? h`<a href="${p.sourceUrl}" rel="noopener noreferrer nofollow" target="_blank">${p.sourceUrl}</a>` : '')}
            ${dl('prospects.email_source', p.emailSourceUrl ? h`<a href="${p.emailSourceUrl}" rel="noopener noreferrer nofollow" target="_blank">${p.emailSourceUrl}</a>` : '')}${dl('prospects.source_verified', p.sourceVerifiedAt ? fmtDate(p.sourceVerifiedAt) : '')}
            ${dl('prospects.added', fmtDate(p.addedAt))}${dl('prospects.first_contact', p.firstContactAt ? fmtDate(p.firstContactAt) : '')}
            ${dl('prospects.budget_full', p.budgetMonthly != null ? fmtEur(p.budgetMonthly) : '')}
            ${dl('prospects.problems', h`${tagList('problem', p.problems)} ${p.problemsText ? h`<span class="block">${p.problemsText}</span>` : ''}`)}
            ${dl('prospects.notes', p.notes ? h`<span class="pre">${p.notes}</span>` : '')}
          </dl>
        </article>
        <article class="card">
          <div class="card-head"><h2>${t('prospect.interviews')}</h2><a class="btn btn-sm" href="${link(`/interviews/new?prospect=${p.id}`)}">${icon('plus', 14)}${t('interviews.new')}</a></div>
          ${ivs.length ? h`<ul class="plain-list">${ivs.map((i) => h`<li><a href="${link(`/interviews/${i.id}`)}"><strong>${fmtDate(i.date)}</strong></a> — ${t('interviews.level')} <span class="badge lvl-${i.commitmentLevel}">${i.commitmentLevel}</span> · ${t('interviews.verbal')} : ${t(`reaction.${i.demoReaction}`)}${i.priceAcceptedExplicit ? h` · <strong>${t('interviews.price_accepted')} ${fmtEur(i.priceAcceptedAmount)}</strong>` : ''}</li>`)}</ul>` : h`<p class="muted">${t('prospect.no_interview')}</p>`}
        </article>
      </div>
      <article class="card"><div class="card-head"><h2>${t('prospect.history')}</h2></div>${activityList(acts)}</article>
    </section>`;
}

function actBody() {
  const { values: v, errors: e } = act;
  const p = getStore().prospect(act.prospectId);
  return h`<form data-form="activity" novalidate>
    <p class="note note-sim" role="note">${icon('shield', 18)}<span>${t('prospect.manual_notice')}</span></p>
    ${field({ id: 'a-kind', label: t('activity.kind'), error: e.kind, children: h`<select id="a-kind" name="kind">${USER_ACTIVITY_KINDS.map((k) => h`<option value="${k}" ${v.kind === k ? 'selected' : ''}>${t(`kind.${k}`)}</option>`)}</select>` })}
    ${field({ id: 'a-text', label: t('activity.text'), error: e.text, hint: t('activity.text_hint'), children: h`<textarea id="a-text" name="text" rows="4">${v.text || ''}</textarea>` })}
    ${field({ id: 'a-status', label: t('activity.status'), error: e.status, children: h`<select id="a-status" name="status"><option value="">${t('activity.status_keep', { s: t(`status.${p.status}`) })}</option>${STATUSES.filter((s) => s !== p.status).map((s) => h`<option value="${s}" ${v.status === s ? 'selected' : ''}>${t(`status.${s}`)}</option>`)}</select>` })}
    <div class="row-2">
      ${field({ id: 'a-nextAction', label: t('prospects.next_action'), error: e.nextAction, children: h`<input id="a-nextAction" name="nextAction" value="${v.nextAction || ''}" maxlength="200">` })}
      ${field({ id: 'a-nextActionDate', label: t('prospects.next_action_date'), error: e.nextActionDate, children: h`<input id="a-nextActionDate" name="nextActionDate" type="date" value="${v.nextActionDate || ''}">` })}
    </div>
    <footer class="modal-foot"><button type="button" class="btn" data-action="modal-close">${t('common.cancel')}</button><button class="btn btn-primary" type="submit">${t('common.save')}</button></footer></form>`;
}

export function openActivityModal(prospectId, kind = 'note', preset = {}) {
  act = { prospectId, values: { kind, ...preset }, errors: {} };
  openModal({ title: () => t('activity.title', { firm: getStore().prospect(prospectId)?.firm || '' }), body: actBody });
}

onClick({
  'act-open': (el) => openActivityModal(el.dataset.id, el.dataset.kind),
  'delete-prospect': (el) => {
    const id = el.dataset.id; const store = getStore(); const p = store.prospect(id);
    openModal({
      title: () => t('delete.title'),
      body: () => h`<p>${t('delete.text', { firm: p.firm, a: store.activitiesOf(id).length, i: store.interviewsOf(id).length })}</p><p class="hint">${t('delete.irreversible')}</p>
        <footer class="modal-foot"><button class="btn" data-action="modal-close">${t('common.cancel')}</button><button class="btn btn-danger" data-action="confirm-delete" data-id="${id}">${icon('trash')}${t('delete.confirm')}</button></footer>`,
    });
  },
  'confirm-delete': (el) => { getStore().deleteProspect(el.dataset.id); closeModal(); toast(t('prospects.deleted'), 'success'); navigate('/prospects'); },
});
onChange({ 'quick-status': (el) => { getStore().updateProspect(el.dataset.id, { status: el.value }); toast(t('prospects.updated'), 'success'); } });
onSubmit({
  activity(form) {
    const data = readForm(form);
    const r = getStore().addActivity(act.prospectId, data);
    if (!r.ok) { act.values = data; act.errors = r.errors; refreshModal(); return; }
    closeModal(); toast(t('activity.saved'), 'success');
  },
});
export const _x = [addDays, ymd, rerender];
