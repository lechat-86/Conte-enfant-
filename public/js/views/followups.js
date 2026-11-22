// Page « Relances » : dossiers à relancer par ordre de priorité. N'envoie RIEN :
// le bouton ouvre l'assistant existant (message modifiable, relecture humaine obligatoire).
import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtDate, fmtDateTime, fmtPeriod } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, emptyState, link, simBanner } from '../ui/components.js';
import { buildFollowups, filterFollowups, countByTier, TIERS, PREP_FILTERS } from '../domain/followups.js';
import { onInput, onChange } from '../core/actions.js';
import { rerender } from '../core/bus.js';

const filters = { q: '', tier: 'all', prep: 'all' };
const TIER_CLASS = { overdue: 'pending', to_fix: 'to_fix', missing: 'analyzing' };
const TIER_ICON = { overdue: 'clock', to_fix: 'alert', missing: 'mail' };

export function enter({ query }) {
  filters.tier = TIERS.includes(query.tier) ? query.tier : 'all';
  if (query.tier !== undefined || query.reset) { filters.q = ''; filters.prep = 'all'; }
}

function reasons(f) {
  const parts = [];
  if (f.overdue) parts.push(t('followups.late_days', { n: f.daysLate }));
  if (f.invalid) parts.push(t('followups.n_to_fix', { n: f.invalid }));
  if (f.missing) parts.push(t('followups.n_missing', { n: f.missing }));
  return parts.join(' · ');
}

export function render({ store, state, now }) {
  const all = buildFollowups(state, now);
  const rows = filterFollowups(all, filters, (id) => store.client(id)?.company);
  const byTier = countByTier(all);
  const filtered = filters.q.trim() || filters.tier !== 'all' || filters.prep !== 'all';

  return h`
    ${pageHeader({ title: t('followups.title'), sub: t('followups.sub') })}
    ${simBanner('followups.notice')}
    <section class="card">
      <div class="toolbar">
        <label class="search">${icon('search', 16)}<input id="followup-q" type="search" data-input="followup-q" value="${filters.q}" placeholder="${t('followups.search')}" aria-label="${t('followups.search')}"></label>
        <select data-change="followup-tier" aria-label="${t('followups.priority')}">
          <option value="all">${t('followups.all_priorities')} (${all.length})</option>
          ${TIERS.map((x) => h`<option value="${x}" ${filters.tier === x ? 'selected' : ''}>${t(`followups.tier.${x}`)} (${byTier[x]})</option>`)}
        </select>
        <select data-change="followup-prep" aria-label="${t('followups.last')}">
          ${PREP_FILTERS.map((x) => h`<option value="${x}" ${filters.prep === x ? 'selected' : ''}>${t(`followups.prep.${x}`)}</option>`)}
        </select>
        <span class="result-count" role="status" data-testid="followups-count">${t('common.results', { n: rows.length })}</span>
      </div>
      ${rows.length === 0
        ? (all.length === 0 || !filtered
          ? emptyState({ iconName: 'check', title: t('followups.empty_title'), text: t('followups.empty_text'), action: h`<a class="btn" href="${link('/dossiers')}">${t('followups.see_dossiers')}</a>` })
          : emptyState({ iconName: 'search', title: t('followups.none'), text: t('common.try_filters') }))
        : h`<div class="table-wrap"><table class="table stack" data-testid="followups-table">
        <thead><tr><th>${t('followups.priority')}</th><th>${t('dossiers.client')}</th><th>${t('followups.what')}</th><th>${t('dossiers.due')}</th><th>${t('followups.last')}</th><th></th></tr></thead>
        <tbody>${rows.map((f) => {
          const d = store.dossier(f.dossierId);
          return h`<tr data-dossier="${f.dossierId}" data-tier="${f.tier}">
            <td data-label="${t('followups.priority')}"><span class="badge b-${TIER_CLASS[f.tier]}">${icon(TIER_ICON[f.tier], 14)}<span>${t(`followups.tier.${f.tier}`)}</span></span></td>
            <td data-label="${t('dossiers.client')}"><a href="${link(`/clients/${f.clientId}`)}">${store.client(f.clientId)?.company}</a>
              <small class="block muted"><a class="mono" href="${link(`/dossiers/${f.dossierId}`)}">${f.dossierId}</a> · ${t(`tpl.${d.template}`)} · ${fmtPeriod(d.period)}</small></td>
            <td data-label="${t('followups.what')}">${reasons(f)}</td>
            <td data-label="${t('dossiers.due')}">${fmtDate(f.dueDate)}</td>
            <td data-label="${t('followups.last')}" data-testid="last-prepared">${f.lastPreparedAt ? fmtDateTime(f.lastPreparedAt) : h`<span class="muted">${t('followups.never')}</span>`}</td>
            <td><button class="btn btn-primary" data-action="open-assistant" data-id="${f.dossierId}">${icon('mail', 16)}${t('followups.prepare')}</button></td>
          </tr>`;
        })}</tbody></table></div>`}
    </section>`;
}

onInput({ 'followup-q': (el) => { filters.q = el.value; rerender(); } });
onChange({
  'followup-tier': (el) => { filters.tier = el.value; rerender(); },
  'followup-prep': (el) => { filters.prep = el.value; rerender(); },
});
