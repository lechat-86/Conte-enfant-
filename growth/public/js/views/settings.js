import { h } from '../core/html.js';
import { t, getLang } from '../core/i18n.js';
import { icon } from '../ui/icons.js';
import { pageHeader, langToggle, field } from '../ui/components.js';
import { prospectsCsv, interviewsCsv, notesCsv, notesText } from '../domain/csv.js';
import { onClick, onChange, onSubmit } from '../core/actions.js';
import { getStore } from '../core/bus.js';
import { openModal, closeModal } from '../ui/modals.js';
import { toast } from '../ui/toast.js';
import { download } from '../ui/download.js';
import { ymd } from '../domain/dates.js';

const LIMITS = ['no_send', 'no_scrape', 'no_linkedin', 'no_network', 'local_only', 'no_auth', 'no_encrypt', 'gdpr'];

export function render({ store, state }) {
  const n = state.prospects.filter((p) => p.demo).length;
  return h`
    ${pageHeader({ title: t('set.title'), sub: t('set.sub') })}
    <section class="grid-2">
      <article class="card">
        <h2>${t('set.general')}</h2>
        <div class="field"><span class="label">${t('common.language')}</span>${langToggle()}</div>
        <form data-form="settings" novalidate>
          ${field({ id: 's-sender', label: t('set.sender'), hint: t('set.sender_hint'), children: h`<input id="s-sender" name="senderName" value="${state.settings.senderName}" maxlength="100" autocomplete="off">` })}
          <button class="btn btn-primary" type="submit">${t('common.save')}</button>
        </form>
        <h2 class="mt">${t('set.demo_title')}</h2>
        <p class="muted">${n ? t('set.demo_present', { n }) : t('set.demo_none')}</p>
        <div class="btn-row">
          <button class="btn btn-primary" data-action="clear-demo" ${n ? '' : 'disabled'}>${t('set.clear_demo')}</button>
          <button class="btn" data-action="load-demo" ${state.prospects.length ? 'disabled' : ''}>${t('set.load_demo')}</button>
        </div>
      </article>
      <article class="card">
        <h2>${t('set.export_title')}</h2>
        <p class="muted">${t('set.export_sub')}</p>
        <div class="btn-col">
          <button class="btn" data-action="set-export" data-what="prospects">${icon('download')}${t('export.prospects')}</button>
          <button class="btn" data-action="set-export" data-what="interviews">${icon('download')}${t('export.interviews')}</button>
          <button class="btn" data-action="set-export" data-what="notes-csv">${icon('download')}${t('export.notes_csv')}</button>
          <button class="btn" data-action="set-export" data-what="notes-txt">${icon('download')}${t('export.notes_txt')}</button>
          <button class="btn btn-primary" data-action="set-export" data-what="backup">${icon('download')}${t('export.backup')}</button>
        </div>
        <h3 class="mini-title">${t('set.import_title')}</h3>
        <label class="btn file-btn">${icon('upload')}${t('set.import')}<input type="file" accept=".json,application/json" data-change="import-backup"></label>
        <p class="hint">${t('set.import_hint')}</p>
        <h3 class="mini-title">${t('set.danger')}</h3>
        <button class="btn btn-danger" data-action="reset-all">${icon('trash')}${t('set.reset_all')}</button>
      </article>
    </section>
    <section class="card">
      <h2>${t('set.limits_title')}</h2>
      <ul class="limits-list" data-testid="limits">${LIMITS.map((k) => h`<li>${icon(k.startsWith('no_') ? 'x' : 'alert', 16)}<span>${t(`limit.${k}`)}</span></li>`)}</ul>
    </section>`;
}

const exporters = {
  prospects: (s) => ['prospects.csv', prospectsCsv(s)], interviews: (s) => ['interviews.csv', interviewsCsv(s)], 'notes-csv': (s) => ['notes.csv', notesCsv(s)],
};
onClick({
  'set-export': (el) => {
    const st = getStore().getState(); const w = el.dataset.what; const d = ymd();
    if (w === 'notes-txt') download(`readyfile-growth-notes-${d}.txt`, notesText(st), 'text/plain;charset=utf-8');
    else if (w === 'backup') download(`readyfile-growth-backup-${d}.json`, getStore().exportBackup(), 'application/json;charset=utf-8');
    else { const [name, csv] = exporters[w](st); download(`readyfile-growth-${name.replace('.csv', '')}-${d}.csv`, csv); }
  },
  'clear-demo': () => openModal({ title: () => t('set.clear_demo'), body: () => h`<p>${t('set.clear_confirm')}</p><footer class="modal-foot"><button class="btn" data-action="modal-close">${t('common.cancel')}</button><button class="btn btn-primary" data-action="clear-demo-ok">${t('set.clear_demo')}</button></footer>` }),
  'clear-demo-ok': () => { const n = getStore().clearDemo(); closeModal(); toast(t('set.cleared', { n }), 'success'); },
  'load-demo': () => { getStore().loadDemo(); toast(t('set.demo_loaded'), 'success'); },
  'reset-all': () => openModal({ title: () => t('set.reset_all'), body: () => h`<p>${t('set.reset_confirm')}</p><footer class="modal-foot"><button class="btn" data-action="modal-close">${t('common.cancel')}</button><button class="btn btn-danger" data-action="reset-all-ok">${icon('trash')}${t('set.reset_all')}</button></footer>` }),
  'reset-all-ok': () => { getStore().resetAll(); closeModal(); toast(t('set.reset_done'), 'success'); },
});
onSubmit({ settings(form) { getStore().updateSettings({ senderName: new FormData(form).get('senderName') }); toast(t('set.saved'), 'success'); } });
onChange({
  'import-backup': async (el) => {
    const f = el.files?.[0]; el.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return toast(t('err.import_size'), 'error');
    const r = getStore().importBackup(await f.text());
    r.ok ? toast(t('set.imported', { n: r.prospects }), 'success') : toast(t(r.error), 'error');
  },
});
export const _l = getLang;
