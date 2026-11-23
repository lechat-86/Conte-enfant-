import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtNumber, fmtDate } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { computeStats } from '../domain/stats.js';
import { completion, dossierStatus, counts } from '../domain/dossier.js';
import { pageHeader, statusBadge, progress, timeline, link, simBanner } from '../ui/components.js';
import { donut, hbars, columns } from '../ui/charts.js';
import { onClick } from '../core/actions.js';
import { openDossierForm } from './forms.js';

function kpi({ href, label, value, sub, tone, ic }) {
  return h`<a class="kpi tone-${tone}" href="${href}"><span class="kpi-ic">${icon(ic, 20)}</span><span class="kpi-label">${label}</span><strong class="kpi-val">${fmtNumber(value)}</strong><span class="kpi-sub">${sub}</span></a>`;
}

export function render({ store, state, now }) {
  const s = computeStats(state, now);
  const recent = store.eventsFor().slice(0, 8);
  const weekLabel = (i) => (i === 7 ? t('dash.this_week') : `−${7 - i}${t('dash.w')}`);
  const worst = [...state.dossiers].filter((d) => dossierStatus(d) !== 'complete').sort((a, b) => completion(a) - completion(b)).slice(0, 5);

  return h`
    ${pageHeader({
      title: t('dash.title'),
      sub: t('dash.sub'),
      actions: h`<button class="btn btn-primary" data-action="new-dossier">${icon('plus')}${t('dossiers.new')}</button>`,
    })}
    ${simBanner('sim.banner_short')}
    <section class="kpi-grid" aria-label="${t('dash.kpis')}">
      ${kpi({ href: link('/dossiers'), label: t('dash.total_dossiers'), value: s.totalDossiers, sub: t('dash.clients_n', { n: s.totalClients }), tone: 'neutral', ic: 'folder' })}
      ${kpi({ href: link('/dossiers'), label: t('dash.received'), value: s.received, sub: t('dash.of_expected', { n: s.expected }), tone: 'info', ic: 'upload' })}
      ${kpi({ href: link('/dossiers?status=complete'), label: t('dash.validated'), value: s.validated, sub: t('dash.pct_of_expected', { p: s.expected ? Math.round((s.validated / s.expected) * 100) : 0 }), tone: 'ok', ic: 'check' })}
      ${kpi({ href: link('/dossiers?status=to_fix'), label: t('dash.incorrect'), value: s.incorrect, sub: t('dash.to_fix_hint'), tone: 'bad', ic: 'alert' })}
      ${kpi({ href: link('/dossiers?status=pending'), label: t('dash.missing'), value: s.missing, sub: t('dash.missing_hint'), tone: 'warn', ic: 'clock' })}
      ${kpi({ href: link('/dossiers?status=attention'), label: t('dash.intervention'), value: s.attention.length, sub: t('dash.intervention_hint'), tone: 'bad', ic: 'bell' })}
      <div class="kpi kpi-wide tone-brand">
        <span class="kpi-label">${t('dash.global_progress')}</span>
        <strong class="kpi-val big">${s.globalProgress}%</strong>
        ${progress(s.globalProgress, 'complete', { label: false })}
        <span class="kpi-sub">${t('dash.progress_hint', { v: s.validated, e: s.expected })}</span>
      </div>
    </section>

    <section class="grid-3">
      <article class="card">
        <h2>${t('dash.chart_docs')}</h2>
        ${donut({
          total: s.expected,
          centerLabel: t('dash.expected'),
          aria: t('dash.chart_docs'),
          segments: [
            { key: 'valid', label: t('docstate.valid'), value: s.validated },
            { key: 'invalid', label: t('docstate.invalid'), value: s.incorrect },
            { key: 'analyzing', label: t('docstate.analyzing'), value: s.analyzing },
            { key: 'missing', label: t('docstate.missing'), value: s.missing },
          ],
        })}
      </article>
      <article class="card">
        <h2>${t('dash.chart_status')}</h2>
        ${hbars(['complete', 'pending', 'to_fix', 'analyzing'].map((k) => ({ key: k === 'complete' ? 'valid' : k === 'to_fix' ? 'invalid' : k === 'pending' ? 'missing' : 'analyzing', label: t(`status.${k}`), value: s.byStatus[k] })))}
        <h3 class="mt">${t('dash.least_advanced')}</h3>
        <ul class="mini-list">${worst.map((d) => h`<li><a href="${link(`/dossiers/${d.id}`)}"><span>${d.id} · ${store.client(d.clientId)?.company}</span></a>${progress(completion(d), dossierStatus(d))}</li>`)}</ul>
      </article>
      <article class="card">
        <h2>${t('dash.chart_weekly')}</h2>
        <p class="muted small">${t('dash.chart_weekly_sub')}</p>
        ${columns(s.weekly, weekLabel)}
      </article>
    </section>

    <section class="grid-2">
      <article class="card">
        <div class="card-head"><h2>${t('dash.attention')}</h2><a class="link-more" href="${link('/dossiers?status=attention')}">${t('common.see_all')}${icon('arrow', 14)}</a></div>
        ${s.attention.length === 0
          ? h`<p class="muted">${t('dash.attention_none')}</p>`
          : h`<ul class="attn-list">${s.attention.map(({ dossier: d, reasons }) => {
              const c = counts(d);
              return h`<li>
                <a class="attn-main" href="${link(`/dossiers/${d.id}`)}"><strong>${d.id}</strong><span>${store.client(d.clientId)?.company}</span></a>
                <span class="attn-tags">${reasons.map((r) => h`<span class="badge ${r === 'overdue' ? 'b-pending' : 'b-to_fix'}">${t(`reason.${r}`)}</span>`)}</span>
                <span class="attn-meta">${t('dash.invalid_missing', { i: c.invalid, m: c.missing })} · ${t('dossiers.due')} ${fmtDate(d.dueDate)}</span>
              </li>`;
            })}</ul>`}
      </article>
      <article class="card">
        <div class="card-head"><h2>${t('dash.recent')}</h2></div>
        ${timeline(recent, store, { limit: 8, showClient: true })}
      </article>
    </section>`;
}

onClick({ 'new-dossier': () => openDossierForm() });
