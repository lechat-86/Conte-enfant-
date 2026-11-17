import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtMoney, fmtNumber } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, progress } from '../ui/components.js';
import { PLANS, toUsd, mrr, TARGET_MRR_EUR, customersNeeded, USD_PER_EUR } from '../domain/pricing.js';
import { onClick, onInput } from '../core/actions.js';
import { rerender } from '../core/bus.js';
import { toast } from '../ui/toast.js';

const mix = { starter: 45, pro: 50, business: 15 };

export function render() {
  const total = mrr(mix);
  const pct = Math.min(100, Math.round((total / TARGET_MRR_EUR) * 100));
  return h`
    ${pageHeader({ title: t('pricing.title'), sub: t('pricing.sub') })}
    <div class="note note-warn" role="note">${icon('alert', 18)}<p>${t('pricing.disclaimer', { rate: USD_PER_EUR })}</p></div>
    <section class="plans">${PLANS.map((p) => h`<article class="plan ${p.highlight ? 'plan-hl' : ''}" data-plan="${p.id}">
      ${p.highlight ? h`<span class="plan-flag">${t('pricing.recommended')}</span>` : ''}
      <h2>${t(`plan.${p.id}`)}</h2>
      <p class="plan-tag">${t(`plan.${p.id}.tag`)}</p>
      <p class="price"><strong>${fmtMoney(p.eur, 'EUR')}</strong><span>${t('pricing.per_month')}</span></p>
      <p class="usd">≈ ${fmtMoney(toUsd(p.eur), 'USD')} ${t('pricing.per_month')} <em>(${t('pricing.indicative')})</em></p>
      <ul class="limits">
        <li><b>${p.limits.users}</b> ${t('pricing.users')}</li>
        ${p.limits.clients == null ? h`<li><b>${t('pricing.clients_unlimited')}</b></li>` : h`<li><b>${p.limits.clients}</b> ${t('pricing.clients')}</li>`}
        <li><b>${fmtNumber(p.limits.docs)}</b> ${t('pricing.docs')}</li>
      </ul>
      <ul class="feat">${p.features.map((f) => h`<li>${icon('check', 16)}${t(`feat.${f}`)}</li>`)}</ul>
      <button class="btn ${p.highlight ? 'btn-primary' : ''}" data-action="plan-pick" data-plan="${p.id}">${t('pricing.cta')}</button>
      <p class="hint">${t('pricing.no_payment')}</p>
    </article>`)}</section>

    <section class="card calc">
      <h2>${t('pricing.calc_title')}</h2>
      <p class="muted">${t('pricing.calc_sub', { target: fmtMoney(TARGET_MRR_EUR, 'EUR') })}</p>
      <div class="calc-grid">
        ${PLANS.map((p) => h`<div class="field"><label for="mix-${p.id}">${t(`plan.${p.id}`)} (${fmtMoney(p.eur, 'EUR')})</label>
          <input id="mix-${p.id}" type="number" min="0" max="9999" step="1" value="${mix[p.id]}" data-input="mix" data-plan="${p.id}" inputmode="numeric"></div>`)}
        <div class="calc-out"><span>${t('pricing.mrr')}</span><strong data-testid="mrr">${fmtMoney(total, 'EUR')}</strong>${progress(pct, pct >= 100 ? 'complete' : 'analyzing', { label: false })}<small>${t('pricing.mrr_pct', { p: Math.round((total / TARGET_MRR_EUR) * 100) })}</small></div>
      </div>
      <p class="muted small">${t('pricing.only_pro', { n: customersNeeded('pro') })} · ${t('pricing.only_business', { n: customersNeeded('business') })}</p>
      <p class="hint">${t('pricing.calc_warn')}</p>
    </section>`;
}

onInput({
  mix: (el) => {
    const n = Math.max(0, Math.min(9999, Math.floor(Number(el.value) || 0)));
    mix[el.dataset.plan] = n;
    rerender();
  },
});
onClick({ 'plan-pick': () => toast(t('pricing.picked_toast'), 'info') });
