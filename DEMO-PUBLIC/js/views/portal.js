// Portail client de démonstration : le client ne voit QUE son dossier (jeton) — jamais ceux des autres.
import { isPublicDemo } from '../core/edition.js';
import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtDate, fmtDateTime, fmtPeriod, fmtSize } from '../core/format.js';
import { icon, logoMark } from '../ui/icons.js';
import { statusBadge, progress, docName, periodText, langToggle, link, emptyState } from '../ui/components.js';
import { counts, completion, dossierStatus, slotState } from '../domain/dossier.js';
import { DOC_TYPES } from '../domain/docTypes.js';
import { SCENARIOS } from '../engine/simulated.js';
import { onClick, onChange } from '../core/actions.js';
import { getStore, rerender } from '../core/bus.js';
import { toast } from '../ui/toast.js';

export const layout = 'portal';
let scenario = 'auto';
const MAX_MB = 10;
const OK_EXT = /\.(pdf|jpe?g|png)$/i;

export function render({ store, params }) {
  const d = store.dossierByToken(params.token);
  if (!d) {
    return h`<div class="portal-card">${emptyState({ iconName: 'lock', title: t('portal.invalid_title'), text: t('portal.invalid_text') })}</div>`;
  }
  const client = store.client(d.clientId);
  const c = counts(d);
  const st = dossierStatus(d);
  const pct = completion(d);
  const todo = d.slots.filter((s) => ['missing', 'invalid'].includes(slotState(s)));

  return h`
    <div class="portal-hero">
      <p class="eyebrow">${t('portal.welcome', { name: client.contact })}</p>
      <h1>${t(`tpl.${d.template}`)} — ${fmtPeriod(d.period)}</h1>
      <p class="sub">${store.getState().settings.firmName} · ${t('portal.deadline')} <strong>${fmtDate(d.dueDate)}</strong></p>
      <div class="portal-progress">
        <div class="pp-top"><span>${t('portal.progress')}</span>${statusBadge(st)}</div>
        ${progress(pct, st)}
        <p class="muted small">${t('portal.progress_detail', { v: c.valid, e: c.expected })}${todo.length ? ` · ${t('portal.todo', { n: todo.length })}` : ` · ${t('portal.all_done')}`}</p>
      </div>
    </div>

    <div class="note note-sim" role="note">${icon('info', 18)}<p>${t(isPublicDemo() ? 'portal.demo_notice_public' : 'portal.demo_notice')}</p></div>

    <section class="portal-test card">
      <label for="portal-scenario"><strong>${t('portal.test_scenario')}</strong><small class="block muted">${t('portal.test_hint')}</small></label>
      <select id="portal-scenario" data-change="portal-scenario">${['auto', ...SCENARIOS].map((x) => h`<option value="${x}" ${scenario === x ? 'selected' : ''}>${t(`scenario.${x}`)}</option>`)}</select>
    </section>

    <ul class="portal-docs" data-testid="portal-docs">${d.slots.map((s) => {
      const state = slotState(s);
      const a = s.doc?.analysis;
      return h`<li class="p-doc p-${state}" data-slot="${s.id}" data-state="${state}">
        <div class="p-head">
          <span class="p-ic">${icon(DOC_TYPES[s.type].icon, 20)}</span>
          <div class="p-title"><strong>${docName(s.type)}</strong><small class="muted">${periodText(s.type, d.period) !== '—' ? periodText(s.type, d.period) : t('portal.no_period')}</small></div>
          ${statusBadge(state, { doc: true })}
        </div>
        ${s.doc ? h`<p class="small muted mono">${s.doc.fileName} · ${fmtSize(s.doc.sizeKB)} · ${fmtDateTime(s.doc.receivedAt)}</p>` : ''}
        ${state === 'invalid' ? h`<div class="p-reason"><strong>${t('portal.why')}</strong> ${t(`issue.${a.issue}.client`, { found: a.details.pages.found, expected: a.details.pages.expected, detected: docName(a.details.detectedType), period: a.details.detectedPeriod ? periodText(s.type, a.details.detectedPeriod) : '' })}<br><strong>${t('portal.what_to_do')}</strong> ${t(`issue.${a.issue}.action`)}</div>` : ''}
        ${state === 'analyzing' ? h`<p class="small muted"><span class="spinner" aria-hidden="true"></span>${t('portal.analyzing')}</p>` : ''}
        ${state === 'valid' ? h`<p class="small ok-text">${icon('check', 14)} ${t('portal.valid_msg')}</p>` : ''}
        ${state === 'missing' || state === 'invalid' ? h`<div class="p-actions">
          ${isPublicDemo() ? '' : h`<label class="btn btn-primary btn-sm file-btn">${icon('upload', 14)}${state === 'invalid' ? t('portal.upload_new') : t('portal.upload')}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-change="portal-file" data-dossier="${d.id}" data-slot="${s.id}"></label>`}
          <button class="btn btn-sm ${isPublicDemo() ? 'btn-primary' : ''}" data-action="portal-fake" data-dossier="${d.id}" data-slot="${s.id}">${icon('file', 14)}${t('portal.fake_file')}</button>
        </div>` : ''}
      </li>`;
    })}</ul>
    <p class="small muted center">${icon('lock', 14)} ${t('portal.privacy')}</p>`;
}

async function deposit(dossierId, slotId, fileName, sizeKB) {
  const store = getStore();
  const out = store.submitDocument(dossierId, slotId, { fileName, sizeKB, scenario, via: 'portal' });
  toast(t('portal.received_toast'), 'info');
  const res = await out;
  const a = res.analysis;
  if (a) toast(a.verdict === 'valid' ? t('portal.result_ok') : t('portal.result_bad', { issue: t(`issue.${a.issue}`) }), a.verdict === 'valid' ? 'success' : 'error');
}

onChange({
  'portal-scenario': (el) => { scenario = el.value; rerender(); },
  'portal-file': (el) => {
    const f = el.files?.[0];
    el.value = '';
    if (!f || isPublicDemo()) return; // démo publique : aucun fichier réel n'est jamais lu, même nom ou taille
    if (!OK_EXT.test(f.name)) return toast(t('err.file_type'), 'error');
    if (f.size > MAX_MB * 1048576) return toast(t('err.file_size', { n: MAX_MB }), 'error');
    // Seuls le nom et la taille sont lus : le contenu du fichier n'est jamais lu, transmis ni stocké.
    deposit(el.dataset.dossier, el.dataset.slot, f.name, Math.max(1, Math.round(f.size / 1024)));
  },
});

onClick({
  'portal-fake': (el) => {
    const d = getStore().dossier(el.dataset.dossier);
    const s = d.slots.find((x) => x.id === el.dataset.slot);
    const suffix = { ok: '', auto: '', unreadable: '_flou', wrong_type: '_autre', duplicate: '_copie', wrong_period: '_ancienne', incomplete: '_partiel' }[scenario] ?? '';
    const stamp = DOC_TYPES[s.type].granularity === 'year' ? d.period.slice(0, 4) : d.period;
    deposit(d.id, s.id, `${DOC_TYPES[s.type].stem}_${stamp}${suffix}_demo.pdf`, 312);
  },
});

export const backLink = link('/dossiers');
