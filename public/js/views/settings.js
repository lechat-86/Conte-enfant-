import { h } from '../core/html.js';
import { t, getLang } from '../core/i18n.js';
import { icon } from '../ui/icons.js';
import { pageHeader, field, langToggle, simBanner } from '../ui/components.js';
import { listEngines } from '../engine/index.js';
import { onSubmit, onClick } from '../core/actions.js';
import { getStore, rerender } from '../core/bus.js';
import { toast } from '../ui/toast.js';
import { openModal, closeModal } from '../ui/modals.js';

let errors = {};
let draft = null;

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
