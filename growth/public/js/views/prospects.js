import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtDate, fmtEur } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, statusBadge, segBadge, demoBadge, link, emptyState } from '../ui/components.js';
import { STATUSES, segmentOf } from '../domain/constants.js';
import { prospectsCsv } from '../domain/csv.js';
import { onClick, onInput, onChange } from '../core/actions.js';
import { rerender, getStore } from '../core/bus.js';
import { download } from '../ui/download.js';

const F = { q: '', status: 'all', segment: 'all', action: 'all', sort: 'added' };
export const filters = F;

export function filterProspects(state, f, today) {
  const q = f.q.trim().toLowerCase();
  let rows = state.prospects.filter((p) => {
    if (q && ![p.firm, p.city, p.contactName, p.contactRole, p.notes, p.nextAction, p.id].some((x) => String(x || '').toLowerCase().includes(q))) return false;
    if (f.status !== 'all' && p.status !== f.status) return false;
    if (f.segment !== 'all' && segmentOf(p.country) !== f.segment) return false;
    if (f.action === 'overdue' && !(p.nextActionDate && p.nextActionDate < today && !['paying', 'refused'].includes(p.status))) return false;
    if (f.action === 'today' && p.nextActionDate !== today) return false;
    if (f.action === 'none' && p.nextActionDate) return false;
    return true;
  });
  const cmp = {
    added: (a, b) => b.addedAt.localeCompare(a.addedAt) || b.id.localeCompare(a.id),
    firm: (a, b) => a.firm.localeCompare(b.firm),
    next: (a, b) => (a.nextActionDate || '9999').localeCompare(b.nextActionDate || '9999'),
    status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status),
  }[f.sort] || (() => 0);
  return rows.sort(cmp);
}

export function enter({ query }) {
  if (query.status !== undefined || query.segment !== undefined) {
    F.status = STATUSES.includes(query.status) ? query.status : 'all';
    F.segment = ['fr', 'en', 'other'].includes(query.segment) ? query.segment : 'all';
    F.q = ''; F.action = 'all';
  }
}

export function render({ state, today }) {
  const rows = filterProspects(state, F, today);
  return h`
    ${pageHeader({ title: t('prospects.title'), sub: t('prospects.sub'), actions: h`<a class="btn" href="${link('/import')}" data-testid="import-btn">${icon('upload')}${t('imp.button')}</a><button class="btn" data-action="export-prospects">${icon('download')}${t('export.prospects')}</button><a class="btn btn-primary" href="${link('/prospects/new')}">${icon('plus')}${t('prospects.add')}</a>` })}
    <section class="card">
      <div class="toolbar">
        <label class="search">${icon('search', 16)}<input id="p-q" type="search" data-input="p-q" value="${F.q}" placeholder="${t('prospects.search')}" aria-label="${t('prospects.search')}"></label>
        <select data-change="p-status" aria-label="${t('prospects.status')}"><option value="all">${t('common.all_statuses')}</option>${STATUSES.map((s) => h`<option value="${s}" ${F.status === s ? 'selected' : ''}>${t(`status.${s}`)}</option>`)}</select>
        <select data-change="p-segment" aria-label="${t('prospects.segment')}">${['all', 'fr', 'en', 'other'].map((s) => h`<option value="${s}" ${F.segment === s ? 'selected' : ''}>${t(`segf.${s}`)}</option>`)}</select>
        <select data-change="p-action" aria-label="${t('prospects.next_action')}">${['all', 'overdue', 'today', 'none'].map((s) => h`<option value="${s}" ${F.action === s ? 'selected' : ''}>${t(`actf.${s}`)}</option>`)}</select>
        <select data-change="p-sort" aria-label="${t('common.sort')}">${['added', 'firm', 'next', 'status'].map((s) => h`<option value="${s}" ${F.sort === s ? 'selected' : ''}>${t('common.sort')} : ${t(`sort.${s}`)}</option>`)}</select>
        <span class="result-count" role="status">${t('common.results', { n: rows.length })}</span>
      </div>
      ${rows.length === 0
        ? emptyState({ title: t('prospects.none'), text: state.prospects.length ? t('common.try_filters') : t('prospects.none_hint'), action: state.prospects.length ? '' : h`<a class="btn btn-primary" href="${link('/prospects/new')}">${t('prospects.add')}</a>` })
        : h`<div class="table-wrap"><table class="table stack" data-testid="prospects-table">
        <thead><tr><th>${t('prospects.firm')}</th><th>${t('prospects.contact')}</th><th>${t('prospects.country')}</th><th>${t('prospects.status')}</th><th>${t('prospects.next_action')}</th><th class="num">${t('prospects.budget')}</th><th>${t('prospects.added')}</th></tr></thead>
        <tbody>${rows.map((p) => {
          const late = p.nextActionDate && p.nextActionDate < today && !['paying', 'refused'].includes(p.status);
          return h`<tr data-id="${p.id}">
            <td data-label="${t('prospects.firm')}"><a class="strong" href="${link(`/prospects/${p.id}`)}">${p.firm}</a> ${p.demo ? demoBadge() : ''}<small class="block muted">${p.city || '—'}</small></td>
            <td data-label="${t('prospects.contact')}">${p.contactName || '—'}<small class="block muted">${p.contactRole || ''}</small></td>
            <td data-label="${t('prospects.country')}">${segBadge(p.country)}</td>
            <td data-label="${t('prospects.status')}">${statusBadge(p.status)}</td>
            <td data-label="${t('prospects.next_action')}">${p.nextActionDate ? h`<span class="${late ? 'bad-text strong' : ''}">${fmtDate(p.nextActionDate)}</span><small class="block muted">${p.nextAction}</small>` : h`<span class="muted">—</span>`}</td>
            <td class="num" data-label="${t('prospects.budget')}">${fmtEur(p.budgetMonthly)}</td>
            <td data-label="${t('prospects.added')}">${fmtDate(p.addedAt)}</td></tr>`;
        })}</tbody></table></div>`}
    </section>`;
}

onClick({ 'export-prospects': () => download('readyfile-growth-prospects.csv', prospectsCsv(getStore().getState())) });
onInput({ 'p-q': (el) => { F.q = el.value; rerender(); } });
onChange({
  'p-status': (el) => { F.status = el.value; rerender(); },
  'p-segment': (el) => { F.segment = el.value; rerender(); },
  'p-action': (el) => { F.action = el.value; rerender(); },
  'p-sort': (el) => { F.sort = el.value; rerender(); },
});
