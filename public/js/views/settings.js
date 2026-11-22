import { h } from '../core/html.js';
import { t, getLang } from '../core/i18n.js';
import { icon } from '../ui/icons.js';
import { pageHeader, field, langToggle, simBanner } from '../ui/components.js';
import { listEngines } from '../engine/index.js';
import { onSubmit, onClick, onChange } from '../core/actions.js';
import { getStore, rerender } from '../core/bus.js';
import { toast } from '../ui/toast.js';
import { openModal, closeModal, refreshModal } from '../ui/modals.js';
import { fmtDate } from '../core/format.js';
import { downloadFile } from '../ui/download.js';
import { buildCsv, csvSeparator, parseBackup, summarize, MAX_BYTES } from '../domain/backup.js';

let errors = {};
let draft = null;
let backupError = null; // {code, where?} : erreur affichée dans la carte Sauvegarde
let pending = null; // restauration en attente de confirmation : {state, meta, backedUp, ack, error}

const ROADMAP = ['encryption', 'access', 'isolation', 'deletion', 'audit_log', 'retention', 'gdpr', 'hosting'];

export function render({ store, state }) {
  const s = state.settings;
  const v = draft || s;
  return h`
    ${pageHeader({ title: t('settings.title'), sub: t('settings.sub') })}
    <section class="grid-2">
      <article class="card">
        <h2>${t('settings.general')}</h2>
        <div class="field"><span class="label">${t('common.language')}</span>${langToggle()}<p class="hint">${t('settings.lang_hint')}</p></div>
        <form data-form="settings" novalidate>
          ${field({ id: 's-firm', label: t('settings.firm'), error: errors.firmName, hint: t('settings.firm_hint'), children: h`<input id="s-firm" name="firmName" value="${v.firmName}" maxlength="80">` })}
          ${field({ id: 's-ret', label: t('settings.retention'), error: errors.retentionDays, hint: t('settings.retention_hint'), children: h`<input id="s-ret" name="retentionDays" type="number" min="30" max="3650" value="${v.retentionDays}">` })}
          <button class="btn btn-primary" type="submit">${t('common.save')}</button>
        </form>
      </article>
      <article class="card">
        <h2>${t('settings.engine')}</h2>
        <ul class="plain-list">${listEngines().map((e) => h`<li><strong>${t('engine.simulated_name')}</strong> <code>${e.id}</code> ${e.active ? h`<span class="badge b-complete">${t('settings.active')}</span>` : ''} ${e.simulated ? h`<span class="badge b-analyzing">${t('sim.tag')}</span>` : ''}</li>`)}</ul>
        <p class="muted">${t('settings.engine_text')}</p>
        <h2 class="mt">${t('settings.demo_data')}</h2>
        <p class="muted">${t('settings.demo_data_text')}</p>
        <button class="btn btn-danger" data-action="reset-demo">${icon('refresh')}${t('settings.reset')}</button>
      </article>
    </section>
    <section class="card" data-testid="backup-card">
      <h2>${t('settings.backup_title')}</h2>
      <p class="muted">${t('settings.backup_sub')}</p>
      <p class="note note-warn" role="note">${icon('shield', 18)}<span>${t('settings.backup_privacy')}</span></p>
      ${backupError ? h`<p class="note note-error" role="alert" data-testid="backup-error">${icon('alert', 18)}<span>${backupErrorText(backupError)}</span></p>` : ''}
      <div class="btn-row">
        <button class="btn btn-primary" data-action="backup-download">${icon('download')}${t('settings.backup_download')}</button>
        <label class="btn file-btn">${icon('upload')}${t('settings.backup_restore')}<input type="file" accept=".json,application/json" data-change="backup-file" aria-label="${t('backup.file_aria')}" data-testid="backup-file"></label>
        <button class="btn" data-action="csv-export">${icon('download')}${t('settings.csv_export')}</button>
      </div>
      <p class="hint">${t('settings.csv_hint', { sep: csvSeparator(getLang()), lang: getLang().toUpperCase() })}</p>
    </section>
    <section class="card">
      <h2>${t('settings.roadmap')}</h2>
      <p class="muted">${t('settings.roadmap_sub')}</p>
      <div class="table-wrap"><table class="table stack"><thead><tr><th>${t('settings.rm_item')}</th><th>${t('settings.rm_target')}</th><th>${t('settings.rm_status')}</th></tr></thead>
      <tbody>${ROADMAP.map((k) => h`<tr><td data-label="${t('settings.rm_item')}"><strong>${t(`rm.${k}`)}</strong></td><td data-label="${t('settings.rm_target')}">${t(`rm.${k}.target`)}</td><td data-label="${t('settings.rm_status')}"><span class="badge b-pending">${t('settings.not_implemented')}</span></td></tr>`)}</tbody></table></div>
    </section>`;
}

onSubmit({
  settings(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    errors = {}; draft = null; // avant l'écriture : le rendu déclenché par le store doit lire l'état à jour
    const res = getStore().updateSettings(data);
    if (!res.ok) { errors = res.errors; draft = data; rerender(); return; }
    toast(t('settings.saved'), 'success');
  },
});

onClick({
  'reset-demo': () => {
    openModal({
      title: () => t('settings.reset'),
      body: () => h`<p>${t('settings.reset_confirm')}</p><footer class="modal-foot"><button class="btn" data-action="modal-close">${t('common.cancel')}</button><button class="btn btn-danger" data-action="reset-confirm">${t('settings.reset')}</button></footer>`,
    });
  },
  'reset-confirm': () => { getStore().resetDemo(); closeModal(); toast(t('settings.reset_done'), 'success'); },
});

// ───────────── Sauvegarde, restauration, export CSV ─────────────

const stamp = () => new Date().toISOString().slice(0, 10);

function backupErrorText(e) {
  if (e.code === 'download') return t('backup.download_failed', { reason: e.where || '?' });
  return t(`backup.err.${e.code}`, { where: e.where || '' });
}

/** Génère la sauvegarde de l'état courant, vérifie qu'elle est relisible, puis déclenche le téléchargement. */
function downloadBackup() {
  const text = getStore().exportBackup();
  const check = parseBackup(text);
  if (!check.ok) return { ok: false, error: `${check.error}${check.where ? ` ${check.where}` : ''}` };
  return downloadFile(`readyfile-ai-sauvegarde-${stamp()}.json`, text, 'application/json;charset=utf-8');
}

function restoreBody() {
  const cur = summarize(getStore().getState());
  const f = pending.meta.counts;
  const canReplace = pending.backedUp && pending.ack;
  return h`
    <p>${t('backup.confirm_intro')}</p>
    <ul class="plain-list">
      <li data-testid="restore-file-info">${t('backup.file_info', { ...f, date: fmtDate(pending.meta.exportedAt) })}</li>
      <li data-testid="restore-current-info">${t('backup.current_info', cur)}</li>
    </ul>
    <h3 class="mini-title">${t('backup.step1_title')}</h3>
    <p class="muted">${t('backup.step1_text')}</p>
    <button class="btn ${pending.backedUp ? '' : 'btn-primary'}" data-action="restore-step1">${icon('download')}${t('backup.step1_btn')}</button>
    ${pending.backedUp ? h`<p class="ok-text" role="status" data-testid="restore-step1-done">${icon('check', 16)} ${t('backup.step1_done')}</p>` : ''}
    ${pending.dlError ? h`<p class="note note-error" role="alert" data-testid="restore-dl-error">${icon('alert', 18)}<span>${t('backup.download_failed', { reason: pending.dlError })} ${t('backup.blocked')}</span></p>` : ''}
    <h3 class="mini-title mt">${t('backup.step2_title')}</h3>
    <label class="check-list"><span style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" data-change="restore-ack" ${pending.ack ? 'checked' : ''} ${pending.backedUp ? '' : 'disabled'}><span>${t('backup.step2_ack')}</span></span></label>
    ${pending.error ? h`<p class="note note-error" role="alert">${icon('alert', 18)}<span>${t('backup.err.storage')}</span></p>` : ''}
    <footer class="modal-foot">
      <button class="btn" data-action="modal-close">${t('common.cancel')}</button>
      <button class="btn btn-danger" data-action="restore-confirm" ${canReplace ? '' : 'disabled'}>${icon('refresh')}${t('backup.replace_btn')}</button>
    </footer>`;
}

onClick({
  'backup-download': () => {
    backupError = null;
    const r = downloadBackup();
    if (r.ok) toast(t('backup.downloaded'), 'success');
    else { backupError = { code: 'download', where: r.error }; rerender(); }
  },
  'csv-export': () => {
    backupError = null;
    const lang = getLang();
    const r = downloadFile(`readyfile-ai-suivi-${stamp()}.csv`, buildCsv(getStore().getState(), { lang, now: new Date() }), 'text/csv;charset=utf-8');
    if (r.ok) toast(t('backup.csv_downloaded'), 'success');
    else { backupError = { code: 'download', where: r.error }; rerender(); }
  },
  'restore-step1': () => {
    const r = downloadBackup();
    pending.backedUp = r.ok;
    pending.ack = r.ok ? pending.ack : false;
    pending.dlError = r.ok ? null : r.error;
    refreshModal();
  },
  'restore-confirm': () => {
    // Garde-fou : même si le bouton était activé de force, rien n'est remplacé sans sauvegarde téléchargée + case cochée.
    if (!pending || !pending.backedUp || !pending.ack) return;
    const next = pending.state;
    const r = getStore().replaceState(next);
    if (!r.ok) { pending.error = r.error; refreshModal(); return; }
    const c = summarize(next);
    closeModal();
    backupError = null;
    toast(t('backup.restored', c), 'success');
    rerender();
  },
});

onChange({
  'restore-ack': (el) => { if (pending?.backedUp) { pending.ack = el.checked; refreshModal(); } },
  async 'backup-file'(el) {
    const file = el.files?.[0];
    el.value = ''; // permet de re-sélectionner le même fichier
    if (!file) return;
    backupError = null;
    let result;
    if (file.size > MAX_BYTES) result = { ok: false, error: 'too_large' };
    else {
      try { result = parseBackup(await file.text()); } catch { result = { ok: false, error: 'read' }; }
    }
    if (!result.ok) { backupError = { code: result.error, where: result.where }; rerender(); return; }
    pending = { state: result.state, meta: result.meta, backedUp: false, ack: false, error: null, dlError: null };
    rerender();
    openModal({ title: () => t('backup.confirm_title'), wide: true, body: restoreBody, onClose: () => { pending = null; } });
  },
});
