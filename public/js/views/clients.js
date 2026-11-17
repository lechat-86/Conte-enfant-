import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtDate, fmtNumber } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, avatar, progress, link, emptyState } from '../ui/components.js';
import { counts, completion, dossierStatus } from '../domain/dossier.js';
import { onClick, onInput, onChange } from '../core/actions.js';
import { rerender } from '../core/bus.js';
import { openClientForm, COUNTRIES } from './forms.js';

const filters = { q: '', country: 'all', health: 'all' };

export function clientRows(store) {
  const { clients, dossiers } = store.getState();
  return clients.map((c) => {
    const ds = dossiers.filter((d) => d.clientId === c.id);
    const agg = ds.reduce((a, d) => { const k = counts(d); a.missing += k.missing; a.invalid += k.invalid; a.expected += k.expected; a.valid += k.valid; return a; }, { missing: 0, invalid: 0, expected: 0, valid: 0 });
    const last = store.eventsFor({ clientId: c.id })[0];
    return { client: c, dossiers: ds, ...agg, progress: agg.expected ? Math.round((agg.valid / agg.expected) * 100) : 0, last: last?.at };
  });
}

export function filterClients(rows, f) {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    const c = r.client;
    if (q && ![c.company, c.contact, c.email, c.id].some((x) => x.toLowerCase().includes(q))) return false;
    if (f.country !== 'all' && c.country !== f.country) return false;
    if (f.health === 'missing' && r.missing === 0) return false;
    if (f.health === 'issues' && r.invalid === 0) return false;
    if (f.health === 'ok' && (r.missing > 0 || r.invalid > 0 || r.dossiers.length === 0)) return false;
    return true;
  });
}

export function render({ store }) {
  const all = clientRows(store);
  const rows = filterClients(all, filters);
  const countries = [...new Set(store.getState().clients.map((c) => c.country))].sort();
  return h`
    ${pageHeader({
      title: t('clients.title'),
      sub: t('clients.sub'),
      actions: h`<button class="btn btn-primary" data-action="new-client">${icon('plus')}${t('clients.add')}</button>`,
    })}
    <section class="card">
      <div class="toolbar">
        <label class="search">${icon('search', 16)}<input id="client-q" type="search" data-input="client-q" value="${filters.q}" placeholder="${t('clients.search')}" aria-label="${t('clients.search')}"></label>
        <select data-change="client-country" aria-label="${t('clients.country')}"><option value="all">${t('common.all_countries')}</option>${countries.map((c) => h`<option value="${c}" ${filters.country === c ? 'selected' : ''}>${t(`country.${c}`)}</option>`)}</select>
        <select data-change="client-health" aria-label="${t('clients.health')}">${['all', 'missing', 'issues', 'ok'].map((x) => h`<option value="${x}" ${filters.health === x ? 'selected' : ''}>${t(`clients.health.${x}`)}</option>`)}</select>
        <span class="result-count" role="status">${t('common.results', { n: rows.length })}</span>
      </div>
      ${rows.length === 0
        ? emptyState({ title: t('clients.none'), text: t('common.try_filters') })
        : h`<div class="table-wrap"><table class="table stack" data-testid="clients-table">
        <thead><tr><th>${t('clients.client')}</th><th>${t('clients.country')}</th><th class="num">${t('clients.dossiers')}</th><th>${t('clients.progress')}</th><th class="num">${t('clients.missing')}</th><th class="num">${t('clients.to_fix')}</th><th>${t('clients.last_activity')}</th></tr></thead>
        <tbody>${rows.map((r) => h`<tr>
          <td data-label="${t('clients.client')}"><a class="cell-client" href="${link(`/clients/${r.client.id}`)}">${avatar(r.client.company)}<span><strong>${r.client.company}</strong><small>${r.client.contact} · ${r.client.id}</small></span></a></td>
          <td data-label="${t('clients.country')}">${t(`country.${r.client.country}`)}</td>
          <td class="num" data-label="${t('clients.dossiers')}">${fmtNumber(r.dossiers.length)}</td>
          <td data-label="${t('clients.progress')}">${r.dossiers.length ? progress(r.progress, r.invalid ? 'to_fix' : r.missing ? 'pending' : 'complete') : '—'}</td>
          <td class="num" data-label="${t('clients.missing')}">${r.missing ? h`<span class="badge b-pending">${r.missing}</span>` : '0'}</td>
          <td class="num" data-label="${t('clients.to_fix')}">${r.invalid ? h`<span class="badge b-to_fix">${r.invalid}</span>` : '0'}</td>
          <td data-label="${t('clients.last_activity')}">${fmtDate(r.last)}</td>
        </tr>`)}</tbody></table></div>`}
    </section>`;
}

onClick({ 'new-client': () => openClientForm() });
onInput({ 'client-q': (el) => { filters.q = el.value; rerender(); } });
onChange({
  'client-country': (el) => { filters.country = el.value; rerender(); },
  'client-health': (el) => { filters.health = el.value; rerender(); },
});
export const _countries = COUNTRIES;
export const resetClientFilters = () => Object.assign(filters, { q: '', country: 'all', health: 'all' });
