import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtDate, fmtPeriod } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, statusBadge, progress, link, emptyState } from '../ui/components.js';
import { counts, completion, dossierStatus, needsIntervention, isOverdue, STATUSES } from '../domain/dossier.js';
import { TEMPLATE_IDS } from '../domain/docTypes.js';
import { onClick, onInput, onChange } from '../core/actions.js';
import { rerender } from '../core/bus.js';
import { openDossierForm } from './forms.js';

const filters = { q: '', status: 'all', template: 'all' };

export function filterDossiers(state, f, store, now = new Date()) {
  const q = f.q.trim().toLowerCase();
  return state.dossiers.filter((d) => {
    const client = state.clients.find((c) => c.id === d.clientId);
    if (q && ![d.id, client?.company || '', t(`tpl.${d.template}`), d.period].some((x) => x.toLowerCase().includes(q))) return false;
    if (f.status === 'attention' ? !needsIntervention(d, now) : f.status !== 'all' && dossierStatus(d) !== f.status) return false;
    if (f.template !== 'all' && d.template !== f.template) return false;
    return true;
  });
}

export function enter({ query }) {
  filters.status = ['all', 'attention', ...STATUSES].includes(query.status) ? query.status : 'all';
  if (query.status !== undefined || query.reset) { filters.q = ''; filters.template = 'all'; }
}

export function render({ store, state, now }) {
  const rows = filterDossiers(state, filters, store, now);
  return h`
    ${pageHeader({
      title: t('dossiers.title'),
      sub: t('dossiers.sub'),
      actions: h`<button class="btn btn-primary" data-action="new-dossier-list">${icon('plus')}${t('dossiers.new')}</button>`,
    })}
    <section class="card">
      <div class="toolbar">
        <label class="search">${icon('search', 16)}<input id="dossier-q" type="search" data-input="dossier-q" value="${filters.q}" placeholder="${t('dossiers.search')}" aria-label="${t('dossiers.search')}"></label>
        <select data-change="dossier-status" aria-label="${t('dossiers.status')}">
          <option value="all">${t('common.all_statuses')}</option>
          ${STATUSES.map((s) => h`<option value="${s}" ${filters.status === s ? 'selected' : ''}>${t(`status.${s}`)}</option>`)}
          <option value="attention" ${filters.status === 'attention' ? 'selected' : ''}>${t('dossiers.attention')}</option>
        </select>
        <select data-change="dossier-template" aria-label="${t('dossiers.template')}">
          <option value="all">${t('common.all_templates')}</option>
          ${TEMPLATE_IDS.map((x) => h`<option value="${x}" ${filters.template === x ? 'selected' : ''}>${t(`tpl.${x}`)}</option>`)}
        </select>
        <span class="result-count" role="status">${t('common.results', { n: rows.length })}</span>
      </div>
      ${rows.length === 0
        ? emptyState({ iconName: 'folder', title: t('dossiers.none'), text: t('common.try_filters') })
        : h`<div class="table-wrap"><table class="table stack" data-testid="dossiers-table">
        <thead><tr><th>${t('dossiers.id')}</th><th>${t('dossiers.client')}</th><th>${t('dossiers.template')}</th><th>${t('dossiers.status')}</th><th>${t('dossiers.completion')}</th><th class="num">${t('dossiers.docs')}</th><th>${t('dossiers.due')}</th></tr></thead>
        <tbody>${rows.map((d) => {
          const c = counts(d);
          const st = dossierStatus(d);
          return h`<tr>
            <td data-label="${t('dossiers.id')}"><a class="mono strong" href="${link(`/dossiers/${d.id}`)}">${d.id}</a></td>
            <td data-label="${t('dossiers.client')}"><a href="${link(`/clients/${d.clientId}`)}">${store.client(d.clientId)?.company}</a></td>
            <td data-label="${t('dossiers.template')}">${t(`tpl.${d.template}`)}<small class="block muted">${fmtPeriod(d.period)}</small></td>
            <td data-label="${t('dossiers.status')}">${statusBadge(st)}</td>
            <td data-label="${t('dossiers.completion')}">${progress(completion(d), st)}</td>
            <td class="num" data-label="${t('dossiers.docs')}">${c.received}/${c.expected}</td>
            <td data-label="${t('dossiers.due')}">${fmtDate(d.dueDate)}${isOverdue(d, now) ? h` <span class="badge b-pending">${t('reason.overdue')}</span>` : ''}</td>
          </tr>`;
        })}</tbody></table></div>`}
    </section>`;
}

onClick({ 'new-dossier-list': () => openDossierForm() });
onInput({ 'dossier-q': (el) => { filters.q = el.value; rerender(); } });
onChange({
  'dossier-status': (el) => { filters.status = el.value; rerender(); },
  'dossier-template': (el) => { filters.template = el.value; rerender(); },
});
