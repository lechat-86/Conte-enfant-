import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtDate, fmtEur } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, field, link, tagCheckboxes, selectOptions, emptyState } from '../ui/components.js';
import { METHOD_TAGS, PROBLEM_TAGS, FEATURE_TAGS, REFUSAL_TAGS, INTEREST_TAGS, FREQUENCIES, REACTIONS, WILLINGNESS, COMMITMENT_LEVELS } from '../domain/constants.js';
import { interviewsCsv, notesCsv, notesText } from '../domain/csv.js';
import { onClick, onSubmit } from '../core/actions.js';
import { getStore, navigate, rerender } from '../core/bus.js';
import { openModal, closeModal } from '../ui/modals.js';
import { toast } from '../ui/toast.js';
import { download } from '../ui/download.js';
import { ymd } from '../domain/dates.js';
import { readForm } from './prospectForm.js';

let form = { id: null, values: {}, errors: {} };

export function listRender({ store, state }) {
  const rows = [...state.interviews].sort((a, b) => b.date.localeCompare(a.date));
  return h`
    ${pageHeader({ title: t('interviews.title'), sub: t('interviews.sub'), actions: h`<button class="btn" data-action="export-interviews">${icon('download')}${t('export.interviews')}</button><a class="btn btn-primary" href="${link('/interviews/new')}">${icon('plus')}${t('interviews.new')}</a>` })}
    <div class="note note-sim" role="note">${icon('info', 18)}<p>${t('interviews.verbal_vs_real')}</p></div>
    <section class="card">${rows.length === 0 ? emptyState({ iconName: 'chat', title: t('interviews.none'), text: t('interviews.none_hint') }) : h`<div class="table-wrap"><table class="table stack" data-testid="interviews-table">
      <thead><tr><th>${t('interviews.date')}</th><th>${t('prospects.firm')}</th><th class="num">${t('iv.clients')}</th><th>${t('interviews.verbal')}</th><th>${t('interviews.level')}</th><th>${t('interviews.price_accepted')}</th><th>${t('iv.next_step')}</th></tr></thead>
      <tbody>${rows.map((i) => { const p = store.prospect(i.prospectId); return h`<tr>
        <td data-label="${t('interviews.date')}"><a class="strong" href="${link(`/interviews/${i.id}`)}">${fmtDate(i.date)}</a></td>
        <td data-label="${t('prospects.firm')}"><a href="${link(`/prospects/${i.prospectId}`)}">${p?.firm}</a></td>
        <td class="num" data-label="${t('iv.clients')}">${i.clientsManaged ?? '—'}</td>
        <td data-label="${t('interviews.verbal')}">${t(`reaction.${i.demoReaction}`)}</td>
        <td data-label="${t('interviews.level')}"><span class="badge lvl-${i.commitmentLevel}">${i.commitmentLevel}</span></td>
        <td data-label="${t('interviews.price_accepted')}">${i.priceAcceptedExplicit ? h`<strong>${fmtEur(i.priceAcceptedAmount)}</strong>` : h`<span class="muted">${t('common.no')}</span>`}</td>
        <td data-label="${t('iv.next_step')}">${i.nextStep || '—'}</td></tr>`; })}</tbody></table></div>`}</section>`;
}

export function enter({ params, query }) {
  const store = getStore();
  if (params.id) { const i = store.interview(params.id); form = { id: params.id, values: i ? { ...i, software: i.software.join(', '), competitorsCited: i.competitorsCited.join(', ') } : {}, errors: {} }; }
  else form = { id: null, values: { prospectId: store.prospect(query.prospect) ? query.prospect : '', date: ymd(), commitmentLevel: 0, incompleteFrequency: 'unknown', demoReaction: 'unknown', testWillingness: 'unknown' }, errors: {} };
}

export function formRender({ store, state, params }) {
  if (params.id && !store.interview(params.id)) return emptyState({ title: t('common.not_found'), action: h`<a class="btn" href="${link('/interviews')}">${t('common.back')}</a>` });
  const { values: v, errors: e } = form;
  const inp = (name, type = 'text', extra = '') => h`<input id="i-${name}" name="${name}" type="${type}" value="${v[name] ?? ''}" ${extra} aria-invalid="${String(!!e[name])}">`;
  const area = (name, rows = 2) => h`<textarea id="i-${name}" name="${name}" rows="${rows}">${v[name] || ''}</textarea>`;
  return h`
    ${pageHeader({ back: { href: link('/interviews'), label: t('interviews.title') }, title: form.id ? t('interviews.edit') : t('interviews.new'), sub: t('interviews.form_sub'),
      actions: form.id ? h`<button class="btn btn-danger" data-action="delete-interview" data-id="${form.id}">${icon('trash')}${t('common.delete')}</button>` : '' })}
    <form data-form="interview" novalidate class="card form-card">
      <h2>${t('iv.s_firm')}</h2>
      <div class="row-2">
        ${field({ id: 'i-prospectId', label: t('prospects.firm'), error: e.prospectId, children: h`<select id="i-prospectId" name="prospectId"><option value="">${t('forms.choose')}</option>${state.prospects.map((p) => h`<option value="${p.id}" ${v.prospectId === p.id ? 'selected' : ''}>${p.firm}</option>`)}</select>` })}
        ${field({ id: 'i-date', label: t('interviews.date'), error: e.date, children: inp('date', 'date') })}
      </div>
      <h2>${t('iv.s_today')}</h2>
      <div class="row-2">
        ${field({ id: 'i-clientsManaged', label: t('iv.clients'), error: e.clientsManaged, children: inp('clientsManaged', 'number', 'min="0" step="1" inputmode="numeric"') })}
        ${field({ id: 'i-hoursPerWeek', label: t('iv.hours'), error: e.hoursPerWeek, hint: t('iv.declared'), children: inp('hoursPerWeek', 'number', 'min="0" max="168" step="0.5" inputmode="decimal"') })}
        ${field({ id: 'i-incompleteFrequency', label: t('iv.frequency'), error: e.incompleteFrequency, hint: t('iv.declared'), children: h`<select id="i-incompleteFrequency" name="incompleteFrequency">${selectOptions('freq', FREQUENCIES, v.incompleteFrequency)}</select>` })}
        ${field({ id: 'i-software', label: t('iv.software'), error: e.software, hint: t('iv.list_hint'), children: inp('software') })}
      </div>
      <p class="label strong">${t('iv.methods')}</p>${tagCheckboxes('collectionMethods', 'method', METHOD_TAGS, v.collectionMethods || [])}
      <p class="label strong">${t('iv.difficulties')}</p>${tagCheckboxes('difficulties', 'problem', PROBLEM_TAGS, v.difficulties || [])}
      ${field({ id: 'i-difficultiesText', label: t('iv.difficulties_text'), error: e.difficultiesText, children: area('difficultiesText') })}
      ${field({ id: 'i-solutionsUsed', label: t('iv.solutions'), error: e.solutionsUsed, children: area('solutionsUsed') })}
      ${field({ id: 'i-competitorsCited', label: t('iv.competitors'), error: e.competitorsCited, hint: t('iv.list_hint'), children: inp('competitorsCited') })}
      <h2>${t('iv.s_needs')}</h2>
      <p class="label strong">${t('iv.features')}</p>${tagCheckboxes('featuresWanted', 'feature', FEATURE_TAGS, v.featuresWanted || [])}
      <h2>${t('iv.s_verbal')}</h2>
      <div class="row-2">
        ${field({ id: 'i-demoReaction', label: t('iv.reaction'), error: e.demoReaction, children: h`<select id="i-demoReaction" name="demoReaction">${selectOptions('reaction', REACTIONS, v.demoReaction)}</select>` })}
        ${field({ id: 'i-testWillingness', label: t('iv.willingness'), error: e.testWillingness, children: h`<select id="i-testWillingness" name="testWillingness">${selectOptions('will', WILLINGNESS, v.testWillingness)}</select>` })}
      </div>
      ${field({ id: 'i-demoReactionText', label: t('iv.reaction_text'), error: e.demoReactionText, children: area('demoReactionText') })}
      <div class="callout" role="note"><strong>${icon('alert', 16)} ${t('iv.s_real')}</strong><p>${t('iv.real_note')}</p></div>
      <div class="row-2">
        ${field({ id: 'i-budgetEnvisaged', label: t('iv.budget'), error: e.budgetEnvisaged, hint: t('iv.declared'), children: inp('budgetEnvisaged', 'number', 'min="0" step="1" inputmode="numeric"') })}
        ${field({ id: 'i-commitmentLevel', label: t('iv.level'), error: e.commitmentLevel, children: h`<select id="i-commitmentLevel" name="commitmentLevel">${COMMITMENT_LEVELS.map((l) => h`<option value="${l}" ${Number(v.commitmentLevel) === l ? 'selected' : ''}>${l} — ${t(`level.${l}`)}</option>`)}</select>` })}
      </div>
      <div class="field ${e.priceAcceptedExplicit ? 'has-error' : ''}"><label class="check"><input type="checkbox" name="priceAcceptedExplicit" ${v.priceAcceptedExplicit ? 'checked' : ''}><span>${t('iv.price_explicit')}</span></label>${e.priceAcceptedExplicit ? h`<p class="err" role="alert">${t(e.priceAcceptedExplicit)}</p>` : ''}</div>
      ${field({ id: 'i-priceAcceptedAmount', label: t('iv.price_amount'), error: e.priceAcceptedAmount, children: inp('priceAcceptedAmount', 'number', 'min="0" step="1" inputmode="numeric"') })}
      <h2>${t('iv.s_reasons')}</h2>
      <p class="label strong">${t('iv.interest_reasons')}</p>${tagCheckboxes('interestReasons', 'interest', INTEREST_TAGS, v.interestReasons || [])}
      <p class="label strong">${t('iv.refusal_reasons')}</p>${tagCheckboxes('refusalReasons', 'refusal', REFUSAL_TAGS, v.refusalReasons || [])}
      <h2>${t('iv.s_next')}</h2>
      ${field({ id: 'i-nextStep', label: t('iv.next_step'), error: e.nextStep, children: inp('nextStep') })}
      ${field({ id: 'i-notes', label: t('prospects.notes'), error: e.notes, children: area('notes', 3) })}
      <footer class="form-foot"><a class="btn" href="${link('/interviews')}">${t('common.cancel')}</a><button class="btn btn-primary" type="submit">${icon('check')}${t('common.save')}</button></footer>
    </form>`;
}

onClick({
  'export-interviews': () => download('readyfile-growth-interviews.csv', interviewsCsv(getStore().getState())),
  'export-notes-csv': () => download('readyfile-growth-notes.csv', notesCsv(getStore().getState())),
  'export-notes-txt': () => download('readyfile-growth-notes.txt', notesText(getStore().getState()), 'text/plain;charset=utf-8'),
  'delete-interview': (el) => openModal({
    title: () => t('delete.iv_title'),
    body: () => h`<p>${t('delete.iv_text')}</p><footer class="modal-foot"><button class="btn" data-action="modal-close">${t('common.cancel')}</button><button class="btn btn-danger" data-action="confirm-delete-iv" data-id="${el.dataset.id}">${icon('trash')}${t('delete.confirm')}</button></footer>`,
  }),
  'confirm-delete-iv': (el) => { getStore().deleteInterview(el.dataset.id); closeModal(); toast(t('interviews.deleted'), 'success'); navigate('/interviews'); },
});
onSubmit({
  interview(el) {
    const data = readForm(el);
    data.priceAcceptedExplicit = data.priceAcceptedExplicit === 'on';
    const r = getStore().saveInterview(data, form.id);
    if (!r.ok) { form.values = data; form.errors = r.errors; rerender(); document.querySelector('.has-error input, .has-error select, .has-error textarea')?.focus(); return; }
    toast(t('interviews.saved'), 'success'); navigate(`/prospects/${r.interview.prospectId}`);
  },
});
