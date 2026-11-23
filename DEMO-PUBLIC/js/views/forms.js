// Formulaires modaux partagés : nouveau client, nouveau dossier.
import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { openModal, closeModal, refreshModal } from '../ui/modals.js';
import { field } from '../ui/components.js';
import { onSubmit } from '../core/actions.js';
import { getStore, navigate } from '../core/bus.js';
import { toast } from '../ui/toast.js';
import { TEMPLATE_IDS } from '../domain/docTypes.js';
import { monthOf } from '../domain/period.js';

import { COUNTRIES } from '../domain/countries.js';
export { COUNTRIES };

let clientForm = { values: {}, errors: {} };
let dossierForm = { values: {}, errors: {} };

export function openClientForm() {
  clientForm = { values: { language: 'fr', country: 'FR' }, errors: {} };
  openModal({
    title: () => t('clients.add'),
    body: () => {
      const { values: v, errors: e } = clientForm;
      return h`<form data-form="client" novalidate>
        <p class="note note-sim" role="note">${t('forms.fictive_only')}</p>
        ${field({ id: 'f-company', label: t('clients.company'), error: e.company, children: h`<input id="f-company" name="company" value="${v.company || ''}" maxlength="80" autocomplete="off" aria-invalid="${!!e.company}">` })}
        ${field({ id: 'f-contact', label: t('clients.contact'), error: e.contact, children: h`<input id="f-contact" name="contact" value="${v.contact || ''}" maxlength="80" autocomplete="off" aria-invalid="${!!e.contact}">` })}
        ${field({ id: 'f-email', label: t('clients.email'), error: e.email, hint: t('forms.email_hint'), children: h`<input id="f-email" name="email" type="email" value="${v.email || ''}" autocomplete="off" aria-invalid="${!!e.email}">` })}
        <div class="row-2">
          ${field({ id: 'f-country', label: t('clients.country'), error: e.country, children: h`<select id="f-country" name="country">${COUNTRIES.map((c) => h`<option value="${c}" ${v.country === c ? 'selected' : ''}>${t(`country.${c}`)}</option>`)}</select>` })}
          ${field({ id: 'f-language', label: t('clients.language'), error: e.language, children: h`<select id="f-language" name="language">${['fr', 'en'].map((l) => h`<option value="${l}" ${v.language === l ? 'selected' : ''}>${t(`lang.${l}`)}</option>`)}</select>` })}
        </div>
        <footer class="modal-foot"><button type="button" class="btn" data-action="modal-close">${t('common.cancel')}</button><button class="btn btn-primary" type="submit">${t('clients.create')}</button></footer>
      </form>`;
    },
  });
}

export function openDossierForm(clientId = '') {
  const store = getStore();
  dossierForm = { values: { clientId, template: TEMPLATE_IDS[0], period: monthOf(new Date()) }, errors: {} };
  openModal({
    title: () => t('dossiers.new'),
    body: () => {
      const { values: v, errors: e } = dossierForm;
      const clients = store.getState().clients;
      return h`<form data-form="dossier" novalidate>
        ${field({ id: 'd-client', label: t('dossiers.client'), error: e.clientId, children: h`<select id="d-client" name="clientId" aria-invalid="${!!e.clientId}"><option value="">${t('forms.choose')}</option>${clients.map((c) => h`<option value="${c.id}" ${v.clientId === c.id ? 'selected' : ''}>${c.company}</option>`)}</select>` })}
        ${field({ id: 'd-template', label: t('dossiers.template'), error: e.template, children: h`<select id="d-template" name="template">${TEMPLATE_IDS.map((x) => h`<option value="${x}" ${v.template === x ? 'selected' : ''}>${t(`tpl.${x}`)}</option>`)}</select>` })}
        ${field({ id: 'd-period', label: t('dossiers.period'), error: e.period, hint: t('forms.period_hint'), children: h`<input id="d-period" name="period" type="month" value="${v.period || ''}" placeholder="AAAA-MM" aria-invalid="${!!e.period}">` })}
        <footer class="modal-foot"><button type="button" class="btn" data-action="modal-close">${t('common.cancel')}</button><button class="btn btn-primary" type="submit">${t('dossiers.create')}</button></footer>
      </form>`;
    },
  });
}

const read = (form) => Object.fromEntries(new FormData(form).entries());

onSubmit({
  client(form) {
    const res = getStore().addClient(read(form));
    if (!res.ok) {
      clientForm = { values: read(form), errors: res.errors };
      refreshModal();
      document.querySelector('.has-error input, .has-error select')?.focus();
      return;
    }
    closeModal();
    toast(t('clients.created_toast', { name: res.client.company }), 'success');
    navigate(`/clients/${res.client.id}`);
  },
  dossier(form) {
    const res = getStore().addDossier(read(form));
    if (!res.ok) {
      dossierForm = { values: read(form), errors: res.errors };
      refreshModal();
      document.querySelector('.has-error input, .has-error select')?.focus();
      return;
    }
    closeModal();
    toast(t('dossiers.created_toast', { id: res.dossier.id }), 'success');
    navigate(`/dossiers/${res.dossier.id}`);
  },
});
