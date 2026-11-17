import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtDate } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, statusBadge, progress, link, avatar, emptyState, timeline, docName } from '../ui/components.js';
import { counts, completion, dossierStatus, missingSlots, invalidSlots } from '../domain/dossier.js';
import { fmtPeriod } from '../core/format.js';
import { onClick } from '../core/actions.js';
import { openDossierForm } from './forms.js';

export function render({ store, params }) {
  const c = store.client(params.id);
  if (!c) return emptyState({ title: t('common.not_found'), text: t('clients.not_found'), action: h`<a class="btn" href="${link('/clients')}">${t('common.back')}</a>` });
  const ds = store.getState().dossiers.filter((d) => d.clientId === c.id);
  const agg = ds.reduce((a, d) => { const k = counts(d); a.missing += k.missing; a.invalid += k.invalid; a.valid += k.valid; a.expected += k.expected; return a; }, { missing: 0, invalid: 0, valid: 0, expected: 0 });

  return h`
    ${pageHeader({
      back: { href: link('/clients'), label: t('clients.title') },
      title: h`<span class="title-with-av">${avatar(c.company, 'lg')}${c.company}</span>`,
      sub: `${c.contact} · ${c.email} · ${t(`country.${c.country}`)} · ${t(`lang.${c.language}`)}`,
      actions: h`<button class="btn btn-primary" data-action="new-dossier-for" data-client="${c.id}">${icon('plus')}${t('dossiers.new')}</button>`,
    })}
    <section class="mini-kpis">
      <div class="mini-kpi"><span>${t('clients.dossiers')}</span><strong>${ds.length}</strong></div>
      <div class="mini-kpi"><span>${t('dash.validated')}</span><strong>${agg.valid}/${agg.expected}</strong></div>
      <div class="mini-kpi tone-bad"><span>${t('clients.to_fix')}</span><strong>${agg.invalid}</strong></div>
      <div class="mini-kpi tone-warn"><span>${t('clients.missing')}</span><strong>${agg.missing}</strong></div>
    </section>
    <section class="grid-main">
      <div class="stack-col">
        <article class="card">
          <div class="card-head"><h2>${t('clients.client_dossiers')}</h2></div>
          ${ds.length === 0 ? h`<p class="muted">${t('clients.no_dossiers')}</p>` : h`<div class="table-wrap"><table class="table stack" data-testid="client-dossiers">
            <thead><tr><th>${t('dossiers.id')}</th><th>${t('dossiers.template')}</th><th>${t('dossiers.status')}</th><th>${t('dossiers.completion')}</th><th>${t('dossiers.due')}</th></tr></thead>
            <tbody>${ds.map((d) => h`<tr>
              <td data-label="${t('dossiers.id')}"><a class="mono strong" href="${link(`/dossiers/${d.id}`)}">${d.id}</a></td>
              <td data-label="${t('dossiers.template')}">${t(`tpl.${d.template}`)}<small class="block muted">${fmtPeriod(d.period)}</small></td>
              <td data-label="${t('dossiers.status')}">${statusBadge(dossierStatus(d))}</td>
              <td data-label="${t('dossiers.completion')}">${progress(completion(d), dossierStatus(d))}</td>
              <td data-label="${t('dossiers.due')}">${fmtDate(d.dueDate)}</td></tr>`)}</tbody></table></div>`}
        </article>
        <article class="card">
          <div class="card-head"><h2>${t('clients.missing_docs')}</h2></div>
          ${(() => {
            const items = ds.flatMap((d) => [...missingSlots(d).map((s) => ({ d, s, kind: 'missing' })), ...invalidSlots(d).map((s) => ({ d, s, kind: 'invalid' }))]);
            if (!items.length) return h`<p class="muted">${t('clients.nothing_missing')}</p>`;
            return h`<ul class="plain-list">${items.map(({ d, s, kind }) => h`<li><a href="${link(`/dossiers/${d.id}`)}"><strong>${docName(s.type)}</strong><small class="muted"> · ${d.id}</small></a> ${kind === 'missing' ? statusBadge('missing', { doc: true }) : h`<span class="badge b-to_fix">${t(`issue.${s.doc.analysis.issue}`)}</span>`}</li>`)}</ul>`;
          })()}
        </article>
      </div>
      <article class="card">
        <div class="card-head"><h2>${t('clients.history')}</h2></div>
        ${timeline(store.eventsFor({ clientId: c.id }), store, { limit: 14 })}
      </article>
    </section>`;
}

onClick({ 'new-dossier-for': (el) => openDossierForm(el.dataset.client) });
