import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { icon } from '../ui/icons.js';
import { pageHeader, field, link, tagCheckboxes, selectOptions } from '../ui/components.js';
import { COUNTRIES, STATUSES, PROBLEM_TAGS } from '../domain/constants.js';
import { onSubmit } from '../core/actions.js';
import { getStore, navigate, rerender } from '../core/bus.js';
import { toast } from '../ui/toast.js';
import { ymd } from '../domain/dates.js';

let form = { id: null, values: {}, errors: {} };

export function readForm(el) {
  const out = {};
  for (const [k, v] of new FormData(el).entries()) out[k] = k in out ? [].concat(out[k], v) : (['problems', 'collectionMethods', 'difficulties', 'featuresWanted', 'refusalReasons', 'interestReasons'].includes(k) ? [v] : v);
  return out;
}

export function enter({ params }) {
  const store = getStore();
  if (params.id) { const p = store.prospect(params.id); form = { id: params.id, values: p ? { ...p } : {}, errors: {} }; }
  else form = { id: null, values: { country: 'FR', status: 'to_research' }, errors: {} };
}

export function render({ store, params }) {
  if (params.id && !store.prospect(params.id)) return h`<div class="empty"><h3>${t('common.not_found')}</h3><a class="btn" href="${link('/prospects')}">${t('common.back')}</a></div>`;
  const { values: v, errors: e } = form;
  const input = (name, type = 'text', extra = '') => h`<input id="f-${name}" name="${name}" type="${type}" value="${v[name] ?? ''}" ${extra} aria-invalid="${String(!!e[name])}">`;
  return h`
    ${pageHeader({ back: { href: form.id ? link(`/prospects/${form.id}`) : link('/prospects'), label: form.id ? t('common.back') : t('prospects.title') }, title: form.id ? t('prospects.edit') : t('prospects.add'), sub: t('form.privacy') })}
    <form data-form="prospect" novalidate class="card form-card">
      <h2>${t('form.firm_section')}</h2>
      <div class="row-2">
        ${field({ id: 'f-firm', label: t('prospects.firm'), error: e.firm, children: input('firm', 'text', 'maxlength="120" autocomplete="off"') })}
        ${field({ id: 'f-website', label: t('prospects.website'), error: e.website, hint: 'https://…', children: input('website', 'url') })}
        ${field({ id: 'f-country', label: t('prospects.country'), error: e.country, children: h`<select id="f-country" name="country">${COUNTRIES.map((c) => h`<option value="${c}" ${v.country === c ? 'selected' : ''}>${c} — ${t(`country.${c}`)}</option>`)}</select>` })}
        ${field({ id: 'f-city', label: t('prospects.city'), error: e.city, children: input('city', 'text', 'maxlength="80"') })}
      </div>
      ${field({ id: 'f-sourceUrl', label: t('prospects.source_url'), error: e.sourceUrl, hint: t('form.source_hint'), children: input('sourceUrl', 'url', 'placeholder="https://…"') })}
      <h2>${t('form.contact_section')}</h2>
      <div class="row-2">
        ${field({ id: 'f-contactName', label: t('prospects.contact_name'), error: e.contactName, children: input('contactName', 'text', 'maxlength="100" autocomplete="off"') })}
        ${field({ id: 'f-contactRole', label: t('prospects.contact_role'), error: e.contactRole, children: input('contactRole', 'text', 'maxlength="100"') })}
      </div>
      ${field({ id: 'f-contactEmail', label: t('prospects.contact_email'), error: e.contactEmail, hint: t('form.email_hint'), children: input('contactEmail', 'email', 'autocomplete="off"') })}
      <div class="field ${e.emailLegit ? 'has-error' : ''}"><label class="check"><input type="checkbox" name="emailLegit" ${v.emailLegit ? 'checked' : ''}><span>${t('form.email_legit')}</span></label>${e.emailLegit ? h`<p class="err" role="alert">${t(e.emailLegit)}</p>` : ''}</div>
      <h2>${t('form.pipeline_section')}</h2>
      <div class="row-2">
        ${field({ id: 'f-status', label: t('prospects.status'), error: e.status, children: h`<select id="f-status" name="status">${STATUSES.map((s) => h`<option value="${s}" ${v.status === s ? 'selected' : ''}>${t(`status.${s}`)}</option>`)}</select>` })}
        ${field({ id: 'f-firstContactAt', label: t('prospects.first_contact'), error: e.firstContactAt, hint: t('form.first_contact_hint'), children: input('firstContactAt', 'date') })}
        ${field({ id: 'f-nextAction', label: t('prospects.next_action'), error: e.nextAction, children: input('nextAction', 'text', 'maxlength="200"') })}
        ${field({ id: 'f-nextActionDate', label: t('prospects.next_action_date'), error: e.nextActionDate, children: input('nextActionDate', 'date') })}
        ${field({ id: 'f-budgetMonthly', label: t('prospects.budget_full'), error: e.budgetMonthly, hint: t('form.budget_hint'), children: input('budgetMonthly', 'number', 'min="0" max="100000" step="1" inputmode="numeric"') })}
      </div>
      <h2>${t('prospects.problems')}</h2>
      ${tagCheckboxes('problems', 'problem', PROBLEM_TAGS, v.problems || [])}
      ${field({ id: 'f-problemsText', label: t('prospects.problems_text'), error: e.problemsText, children: h`<textarea id="f-problemsText" name="problemsText" rows="2">${v.problemsText || ''}</textarea>` })}
      ${field({ id: 'f-notes', label: t('prospects.notes'), error: e.notes, children: h`<textarea id="f-notes" name="notes" rows="4">${v.notes || ''}</textarea>` })}
      <footer class="form-foot"><a class="btn" href="${form.id ? link(`/prospects/${form.id}`) : link('/prospects')}">${t('common.cancel')}</a><button class="btn btn-primary" type="submit">${icon('check')}${t('common.save')}</button></footer>
    </form>`;
}

onSubmit({
  prospect(el) {
    const data = readForm(el);
    data.emailLegit = data.emailLegit === 'on';
    const store = getStore();
    const r = form.id ? store.updateProspect(form.id, data) : store.addProspect(data);
    if (!r.ok) { form.values = data; form.errors = r.errors; rerender(); document.querySelector('.has-error input, .has-error select, .has-error textarea')?.focus(); return; }
    toast(t(form.id ? 'prospects.updated' : 'prospects.created'), 'success');
    navigate(`/prospects/${r.prospect.id}`);
  },
});
export const _today = ymd;
