import { h } from '../core/html.js';
import { t, getLang } from '../core/i18n.js';
import { fmtDate, fmtDateTime, fmtPeriod, fmtSize } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, statusBadge, progress, link, emptyState, timeline, docName, periodText, simBanner } from '../ui/components.js';
import { counts, completion, dossierStatus, slotState, isOverdue } from '../domain/dossier.js';
import { SCENARIOS } from '../engine/simulated.js';
import { DOC_TYPES } from '../domain/docTypes.js';
import { itemsFromDossier } from '../domain/messages.js';
import { onClick, onChange } from '../core/actions.js';
import { getStore, rerender } from '../core/bus.js';
import { toast } from '../ui/toast.js';
import { openAssistant } from './assistant.js';

const chosen = {}; // scénario choisi par emplacement (état d'interface)

export const portalUrl = (d) => `${location.origin}${location.pathname}#/portal/${d.token}`;

function result(slot) {
  const doc = slot.doc;
  if (!doc) return h`<span class="muted">—</span>`;
  if (doc.status === 'analyzing') return h`<span class="muted">${t('dossier.analysis_pending')}</span>`;
  const a = doc.analysis;
  const checks = a.checks.map((c) => h`<li class="chk chk-${c.status}"><span>${t(`check.${c.id}`)}</span><b>${t(`checkstatus.${c.status}`)}</b></li>`);
  const summary = doc.status === 'valid'
    ? h`<span class="ok-text">${t('dossier.all_checks_ok')}</span>`
    : h`<span class="badge b-to_fix">${t(`issue.${a.issue}`)}</span><small class="block">${t(`issue.${a.issue}.pro`, { found: a.details.pages.found, expected: a.details.pages.expected, detected: docName(a.details.detectedType), period: a.details.detectedPeriod ? periodText(slot.type, a.details.detectedPeriod) : '', file: a.details.duplicateOf?.fileName || '' })}</small>`;
  return h`${summary}<details class="checks"><summary>${t('dossier.show_checks')}</summary><ul>${checks}</ul><p class="sim-tag">${icon('info', 14)}${t('sim.result_tag')}</p></details>`;
}

export function render({ store, params, now }) {
  const d = store.dossier(params.id);
  if (!d) return emptyState({ iconName: 'folder', title: t('common.not_found'), text: t('dossiers.not_found'), action: h`<a class="btn" href="${link('/dossiers')}">${t('common.back')}</a>` });
  const client = store.client(d.clientId);
  const c = counts(d);
  const st = dossierStatus(d);
  const hasPoints = itemsFromDossier(d).length > 0;

  return h`
    ${pageHeader({
      back: { href: link('/dossiers'), label: t('dossiers.title') },
      title: h`<span class="mono">${d.id}</span> · ${t(`tpl.${d.template}`)}`,
      sub: h`<a href="${link(`/clients/${client.id}`)}">${client.company}</a> · ${fmtPeriod(d.period)} · ${t('dossiers.created')} ${fmtDate(d.createdAt)} · ${t('dossiers.due')} ${fmtDate(d.dueDate)}${isOverdue(d, now) ? h` <span class="badge b-pending">${t('reason.overdue')}</span>` : ''}`,
      actions: h`
        <button class="btn" data-action="copy-portal" data-id="${d.id}">${icon('link')}${t('dossier.copy_link')}</button>
        <a class="btn" href="${link(`/portal/${d.token}`)}">${icon('external')}${t('dossier.open_portal')}</a>
        <button class="btn btn-primary" data-action="open-assistant" data-id="${d.id}" ${hasPoints ? '' : 'disabled'}>${icon('mail')}${t('dossier.prepare_message')}</button>`,
    })}
    ${simBanner()}
    <section class="summary-bar card">
      <div><span class="lbl">${t('dossiers.status')}</span>${statusBadge(st)}</div>
      <div class="grow"><span class="lbl">${t('dossiers.completion')}</span>${progress(completion(d), st)}</div>
      <div><span class="lbl">${t('dossier.received')}</span><strong>${c.received}/${c.expected}</strong></div>
      <div><span class="lbl">${t('docstate.valid')}</span><strong class="ok-text">${c.valid}</strong></div>
      <div><span class="lbl">${t('docstate.invalid')}</span><strong class="bad-text">${c.invalid}</strong></div>
      <div><span class="lbl">${t('docstate.missing')}</span><strong class="warn-text">${c.missing}</strong></div>
    </section>
    <section class="grid-main">
      <article class="card">
        <div class="card-head"><h2>${t('dossier.documents')}</h2></div>
        <div class="table-wrap"><table class="table stack docs-table" data-testid="slots-table">
          <thead><tr><th>${t('dossier.expected_doc')}</th><th>${t('dossier.state')}</th><th>${t('dossier.file')}</th><th>${t('dossier.analysis')}</th><th>${t('dossier.actions')}</th></tr></thead>
          <tbody>${d.slots.map((s) => {
            const state = slotState(s);
            const gran = DOC_TYPES[s.type].granularity;
            const scenarios = SCENARIOS.filter((x) => x !== 'wrong_period' || gran);
            const sel = chosen[s.id] || 'ok';
            return h`<tr data-slot="${s.id}" data-state="${state}">
              <td data-label="${t('dossier.expected_doc')}"><strong>${docName(s.type)}</strong><small class="block muted">${t('dossier.period_label')} : ${periodText(s.type, d.period)}</small></td>
              <td data-label="${t('dossier.state')}">${statusBadge(state, { doc: true })}</td>
              <td data-label="${t('dossier.file')}">${s.doc ? h`<span class="mono small">${s.doc.fileName}</span><small class="block muted">${fmtSize(s.doc.sizeKB)} · ${fmtDateTime(s.doc.receivedAt)} · ${t(`via.${s.doc.via}`)}${s.doc.attempts > 1 ? ` · ${t('dossier.attempt', { n: s.doc.attempts })}` : ''}</small>` : h`<span class="muted">—</span>`}</td>
              <td data-label="${t('dossier.analysis')}">${result(s)}</td>
              <td data-label="${t('dossier.actions')}">${
                state === 'analyzing'
                  ? h`<button class="btn btn-sm btn-primary" data-action="run-analysis" data-dossier="${d.id}" data-slot="${s.id}">${icon('play', 14)}${t('dossier.run_analysis')}</button>`
                  : state === 'valid' ? h`<span class="muted">—</span>`
                  : h`<div class="sim-deposit"><select data-change="slot-scenario" data-slot="${s.id}" aria-label="${t('dossier.scenario')}">${scenarios.map((x) => h`<option value="${x}" ${sel === x ? 'selected' : ''}>${t(`scenario.${x}`)}</option>`)}</select>
                    <button class="btn btn-sm" data-action="sim-deposit" data-dossier="${d.id}" data-slot="${s.id}">${icon('upload', 14)}${t('dossier.simulate_deposit')}</button>
                    ${state === 'invalid' ? h`<button class="btn btn-sm" data-action="open-assistant" data-id="${d.id}" data-slot="${s.id}">${icon('mail', 14)}${t('dossier.message')}</button>` : ''}</div>`
              }</td>
            </tr>`;
          })}</tbody></table></div>
      </article>
      <article class="card">
        <div class="card-head"><h2>${t('dossier.history')}</h2></div>
        ${timeline(store.eventsFor({ dossierId: d.id }), store, { limit: 16 })}
      </article>
    </section>`;
}

export function assistantFor(dossierId, onlySlot) {
  const store = getStore();
  const d = store.dossier(dossierId);
  const client = store.client(d.clientId);
  const items = itemsFromDossier(d).map((i) => ({ ...i, key: i.slotId }));
  openAssistant({
    dossierId,
    token: d.token,
    clientName: client.contact,
    clientLang: client.language,
    period: d.period,
    items,
    preselect: onlySlot ? [onlySlot] : items.map((i) => i.key),
  });
}

async function resolveWithToast(dossierId, slotId) {
  const a = await getStore().resolveAnalysis(dossierId, slotId);
  if (a) toast(a.verdict === 'valid' ? t('toast.analysis_ok') : t('toast.analysis_issue', { issue: t(`issue.${a.issue}`) }), a.verdict === 'valid' ? 'success' : 'error');
}

onClick({
  'copy-portal': async (el) => {
    const d = getStore().dossier(el.dataset.id);
    try { await navigator.clipboard.writeText(portalUrl(d)); toast(t('dossier.link_copied'), 'success'); }
    catch { toast(portalUrl(d), 'info'); }
  },
  'open-assistant': (el) => assistantFor(el.dataset.id, el.dataset.slot),
  'run-analysis': (el) => resolveWithToast(el.dataset.dossier, el.dataset.slot),
  'sim-deposit': async (el) => {
    const store = getStore();
    const d = store.dossier(el.dataset.dossier);
    const slot = d.slots.find((s) => s.id === el.dataset.slot);
    const scenario = chosen[slot.id] || 'ok';
    const suffix = { ok: '', unreadable: '_flou', wrong_type: '_autre', duplicate: '_copie', wrong_period: '_ancienne', incomplete: '_partiel' }[scenario];
    const stamp = DOC_TYPES[slot.type].granularity === 'year' ? d.period.slice(0, 4) : d.period;
    const res = store.submitDocument(d.id, slot.id, { fileName: `${DOC_TYPES[slot.type].stem}_${stamp}${suffix}_v${(slot.doc?.attempts || 0) + 1}.pdf`, scenario, via: 'manual' });
    toast(t('toast.deposit_sim'), 'info');
    const out = await res;
    if (out.analysis) toast(out.analysis.verdict === 'valid' ? t('toast.analysis_ok') : t('toast.analysis_issue', { issue: t(`issue.${out.analysis.issue}`) }), out.analysis.verdict === 'valid' ? 'success' : 'error');
  },
});
onChange({ 'slot-scenario': (el) => { chosen[el.dataset.slot] = el.value; rerender(); } });
