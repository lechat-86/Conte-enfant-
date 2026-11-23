// Page de présentation commerciale locale. Aucun témoignage, client, chiffre de résultat ou promesse chiffrée.
import { h } from '../core/html.js';
import { t, getLang } from '../core/i18n.js';
import { fmtMoney } from '../core/format.js';
import { icon, logoMark } from '../ui/icons.js';
import { langToggle, statusBadge } from '../ui/components.js';
import { SCENARIOS, simulateAnalysis } from '../engine/simulated.js';
import { buildMessage } from '../domain/messages.js';
import { monthOf, shiftMonths } from '../domain/period.js';
import { PLANS, toUsd } from '../domain/pricing.js';
import { isPublicDemo } from '../core/edition.js';
import { onClick } from '../core/actions.js';
import { rerender, navigate } from '../core/bus.js';

export const layout = 'landing';
const state = { scenario: 'incomplete' };

export function topbar() {
  return h`<header class="portal-top landing-top">
    <a class="brand brand-light" href="#/welcome">${logoMark(28)}<span><strong>READYFILE</strong><em>AI</em></span></a>
    <nav class="l-nav" aria-label="${t('nav.main')}">
      ${[['problem', 'landing.nav_problem'], ['how', 'landing.nav_how'], ['demo', 'landing.nav_demo'], ['pricing', 'landing.nav_pricing']].filter(([id]) => !(isPublicDemo() && id === 'pricing')).map(([id, k]) => h`<button type="button" class="l-link" data-action="landing-scroll" data-target="l-${id}">${t(k)}</button>`)}
    </nav>
    <span class="grow"></span>
    <a class="btn btn-sm" href="#/">${t('landing.open_app')}${icon('arrow', 14)}</a>
    ${langToggle()}
  </header>`;
}

function demo(store) {
  const period = shiftMonths(monthOf(new Date()), -1);
  const a = simulateAnalysis({ fileName: 'releve.pdf', expected: { type: 'bank_statement', period }, scenario: state.scenario }, []);
  const msg = a.verdict === 'valid'
    ? t('landing.demo_ok')
    : buildMessage({ lang: getLang(), clientName: t('landing.demo_client'), firmName: store.getState().settings.firmName, period, items: [{ kind: 'issue', type: 'bank_statement', code: a.issue, details: a.details }] });
  return h`
    <div class="demo-chips" role="group" aria-label="${t('landing.demo_title')}">${SCENARIOS.map((s) => h`<button type="button" class="chip-btn" data-action="landing-scenario" data-scenario="${s}" aria-pressed="${state.scenario === s}">${t(`scenario.${s}`)}</button>`)}</div>
    <div class="demo-out">
      <div class="demo-card-res" data-testid="landing-result" data-issue="${a.issue || 'none'}">
        <h3>${t('landing.demo_result')} <span class="badge b-analyzing">${t('sim.tag')}</span></h3>
        <p>${statusBadge(a.verdict === 'valid' ? 'valid' : 'invalid', { doc: true })} ${a.issue ? h`<strong>${t(`issue.${a.issue}`)}</strong>` : ''}</p>
        <ul class="check-grid">${a.checks.map((c) => h`<li class="chk chk-${c.status}"><span>${t(`check.${c.id}`)}</span><b>${t(`checkstatus.${c.status}`)}</b></li>`)}</ul>
      </div>
      <div class="demo-card-msg"><h3>${t('landing.demo_msg')}</h3><pre data-testid="landing-message">${msg}</pre></div>
    </div>`;
}

export function render({ store }) {
  return h`
    <div class="landing">
      <section class="l-hero">
        <p class="eyebrow">${t('landing.eyebrow')}</p>
        <h1>${t('landing.h1')}</h1>
        <p class="l-sub">${t('landing.sub')}</p>
        <div class="btn-row l-cta">
          <button class="btn btn-primary btn-lg" data-action="tour-start">${icon('play')}${t('landing.cta_tour')}</button>
          <a class="btn btn-lg" href="#/">${t('landing.cta_app')}</a>
        </div>
        <p class="hint">${t('landing.tour_note')}</p>
        <div class="note note-sim l-honest" role="note">${icon('info', 18)}<p>${t('landing.honest')}</p></div>
      </section>

      <section class="l-section" id="l-problem">
        <h2>${t('landing.problem_title')}</h2>
        <p class="muted">${t('landing.problem_sub')}</p>
        <ul class="l-problems">${[1, 2, 3, 4].map((n) => h`<li>${icon('alert', 18)}<span>${t(`landing.p${n}`)}</span></li>`)}</ul>
        <p class="l-ask">${t('landing.problem_ask')}</p>
      </section>

      <section class="l-section">
        <h2>${t('landing.benefits_title')}</h2>
        <div class="l-grid">${[['b1', 'dashboard'], ['b2', 'scan'], ['b3', 'mail'], ['b4', 'upload']].map(([k, ic]) => h`<article class="l-card"><span class="l-ic">${icon(ic, 22)}</span><h3>${t(`landing.${k}_t`)}</h3><p>${t(`landing.${k}_d`)}</p></article>`)}</div>
      </section>

      <section class="l-section" id="l-how">
        <h2>${t('landing.how_title')}</h2>
        <ol class="l-steps">${[1, 2, 3, 4].map((n) => h`<li><span class="l-num">${n}</span><div><h3>${t(`landing.h${n}_t`)}</h3><p>${t(`landing.h${n}_d`)}</p></div></li>`)}</ol>
      </section>

      <section class="l-section l-demo" id="l-demo">
        <h2>${t('landing.demo_title')}</h2>
        <p class="muted">${t('landing.demo_sub')}</p>
        ${demo(store)}
      </section>

      ${isPublicDemo() ? '' : h`<section class="l-section" id="l-pricing">
        <h2>${t('landing.pricing_title')}</h2>
        <div class="note note-warn" role="note">${icon('alert', 18)}<p>${t('landing.pricing_note')}</p></div>
        <div class="l-prices">${PLANS.map((p) => h`<div class="l-price ${p.highlight ? 'hl' : ''}"><strong>${t(`plan.${p.id}`)}</strong><span class="amt">${fmtMoney(p.eur, 'EUR')}<small>${t('pricing.per_month')}</small></span><span class="muted">≈ ${fmtMoney(toUsd(p.eur), 'USD')} (${t('pricing.indicative')})</span></div>`)}</div>
        <a class="link-more" href="#/pricing">${t('landing.pricing_more')}${icon('arrow', 14)}</a>
      </section>`}

      <section class="l-section">
        <h2>${t('landing.limits_title')}</h2>
        <div class="l-two">
          <div class="l-box l-yes"><h3>${icon('check', 18)}${t('landing.is_t')}</h3><ul>${[1, 2, 3].map((n) => h`<li>${t(`landing.is${n}`)}</li>`)}</ul></div>
          <div class="l-box l-no"><h3>${icon('alert', 18)}${t('landing.isnt_t')}</h3><ul>${[1, 2, 3].map((n) => h`<li>${t(`landing.isnt${n}`)}</li>`)}</ul></div>
        </div>
      </section>

      <section class="l-final">
        <h2>${t('landing.final_title')}</h2>
        <p>${t('landing.final_text')}</p>
        <button class="btn btn-primary btn-lg" data-action="tour-start">${icon('play')}${t('landing.cta_tour')}</button>
      </section>
      <footer class="l-footer">${t(isPublicDemo() ? 'landing.footer_public' : 'landing.footer')}</footer>
    </div>`;
}

onClick({
  'landing-scenario': (el) => { state.scenario = el.dataset.scenario; rerender(); },
  'landing-scroll': (el) => document.getElementById(el.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
});
export const _nav = navigate;
