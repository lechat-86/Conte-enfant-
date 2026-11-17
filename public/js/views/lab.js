import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtPeriod, fmtYear } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, simBanner, docName, statusBadge, periodText } from '../ui/components.js';
import { DOC_TYPE_IDS, DOC_TYPES } from '../domain/docTypes.js';
import { monthOf, shiftMonths } from '../domain/period.js';
import { SCENARIOS } from '../engine/simulated.js';
import { analyzeDocument, getEngine } from '../engine/index.js';
import { onClick, onChange, onInput } from '../core/actions.js';
import { rerender } from '../core/bus.js';
import { openAssistant } from './assistant.js';

const S = { type: 'bank_statement', period: shiftMonths(monthOf(new Date()), -1), scenario: 'incomplete', fileName: 'exemple.pdf', result: null, all: null, running: false };
const input = () => ({ fileName: S.fileName || 'exemple.pdf', expected: { type: S.type, period: S.period }, scenario: S.scenario });

export const labState = S;

function explain(a) {
  const d = a.details;
  return t(`issue.${a.issue}.pro`, {
    found: d.pages.found, expected: d.pages.expected, detected: docName(d.detectedType),
    period: d.detectedPeriod ? periodText(S.type, d.detectedPeriod) : '', file: d.duplicateOf?.fileName || '',
  });
}

function resultPanel(a) {
  const d = a.details;
  const gran = DOC_TYPES[S.type].granularity;
  return h`<div class="result ${a.verdict === 'valid' ? 'res-ok' : 'res-bad'}" data-testid="lab-result" data-verdict="${a.verdict}" data-issue="${a.issue || 'none'}">
    <div class="verdict">${a.verdict === 'valid' ? h`<span class="v-ic ok">${icon('check', 22)}</span><div><h3>${t('lab.verdict_ok')}</h3><p>${t('issue.ok.pro')}</p></div>`
      : h`<span class="v-ic bad">${icon('alert', 22)}</span><div><h3>${t('lab.verdict_bad')} — ${t(`issue.${a.issue}`)}</h3><p>${explain(a)}</p></div>`}</div>
    <h4 class="mini-title">${t('lab.checks')}</h4>
    <ul class="check-grid">${a.checks.map((c) => h`<li class="chk chk-${c.status}"><span>${t(`check.${c.id}`)}</span><b>${t(`checkstatus.${c.status}`)}</b></li>`)}</ul>
    <h4 class="mini-title">${t('lab.extraction')}</h4>
    <dl class="kv">
      <dt>${t('lab.f_type')}</dt><dd>${docName(d.detectedType)}</dd>
      <dt>${t('lab.f_period')}</dt><dd>${d.detectedPeriod ? (gran === 'year' ? fmtYear(d.detectedPeriod) : fmtPeriod(d.detectedPeriod)) : '—'}</dd>
      <dt>${t('lab.f_pages')}</dt><dd>${d.pages.found}/${d.pages.expected}</dd>
      <dt>${t('lab.f_legibility')}</dt><dd>${Math.round(d.legibility * 100)}%</dd>
      <dt>${t('lab.f_fingerprint')}</dt><dd class="mono small">${a.extraction.fingerprint}</dd>
      <dt>${t('lab.f_engine')}</dt><dd>${t('engine.simulated_name')} <span class="badge b-analyzing">${t('sim.tag')}</span></dd>
    </dl>
    ${a.verdict === 'invalid' ? h`<button class="btn btn-primary" data-action="lab-message">${icon('mail')}${t('dossier.prepare_message')}</button>` : ''}
  </div>`;
}

export function render() {
  const gran = DOC_TYPES[S.type].granularity;
  return h`
    ${pageHeader({ title: t('lab.title'), sub: t('lab.sub') })}
    ${simBanner('sim.banner_lab')}
    <section class="grid-lab">
      <article class="card">
        <h2>${t('lab.setup')}</h2>
        <div class="field"><label for="lab-type">${t('lab.expected_type')}</label>
          <select id="lab-type" data-change="lab-type">${DOC_TYPE_IDS.map((x) => h`<option value="${x}" ${S.type === x ? 'selected' : ''}>${docName(x)}</option>`)}</select></div>
        <div class="field"><label for="lab-period">${t('dossiers.period')}</label>
          <input id="lab-period" type="month" value="${S.period}" data-change="lab-period" ${gran ? '' : 'disabled'}>
          ${gran ? '' : h`<p class="hint">${t('lab.no_period')}</p>`}</div>
        <fieldset class="scenarios"><legend>${t('lab.scenario')}</legend>
          ${['auto', ...SCENARIOS].map((x) => h`<label class="sc ${S.scenario === x ? 'on' : ''} ${x === 'wrong_period' && !gran ? 'off' : ''}">
            <input type="radio" name="scenario" value="${x}" data-change="lab-scenario" ${S.scenario === x ? 'checked' : ''} ${x === 'wrong_period' && !gran ? 'disabled' : ''}>
            <span><strong>${t(`scenario.${x}`)}</strong><small>${t(`scenario.${x}.desc`)}</small></span></label>`)}
        </fieldset>
        <div class="field"><label for="lab-file">${t('lab.file_name')}</label>
          <input id="lab-file" data-input="lab-file" value="${S.fileName}" maxlength="100" autocomplete="off"><p class="hint">${t('lab.file_hint')}</p></div>
        <div class="btn-row"><button class="btn btn-primary" data-action="lab-run" ${S.running ? 'disabled' : ''}>${icon('play')}${S.running ? t('lab.running') : t('lab.run')}</button>
        <button class="btn" data-action="lab-all">${t('lab.run_all')}</button></div>
      </article>
      <div class="stack-col">
        <article class="card"><h2>${t('lab.result')}</h2>
          ${S.result ? resultPanel(S.result) : h`<p class="muted">${t('lab.no_result')}</p>`}
        </article>
        ${S.all ? h`<article class="card"><h2>${t('lab.all_title')}</h2>
          <div class="table-wrap"><table class="table stack" data-testid="lab-all-table"><thead><tr><th>${t('lab.scenario')}</th><th>${t('lab.verdict')}</th><th>${t('lab.detected_issue')}</th></tr></thead>
          <tbody>${S.all.map(({ scenario, a }) => h`<tr><td data-label="${t('lab.scenario')}">${t(`scenario.${scenario}`)}</td><td data-label="${t('lab.verdict')}">${statusBadge(a.verdict === 'valid' ? 'valid' : 'invalid', { doc: true })}</td><td data-label="${t('lab.detected_issue')}">${a.issue ? t(`issue.${a.issue}`) : '—'}</td></tr>`)}</tbody></table></div></article>` : ''}
      </div>
    </section>`;
}

onChange({
  'lab-type': (el) => { S.type = el.value; if (!DOC_TYPES[S.type].granularity && S.scenario === 'wrong_period') S.scenario = 'ok'; S.result = null; rerender(); },
  'lab-period': (el) => { if (el.value) S.period = el.value; },
  'lab-scenario': (el) => { S.scenario = el.value; rerender(); },
});
onInput({ 'lab-file': (el) => { S.fileName = el.value; } });
onClick({
  'lab-run': async () => {
    S.running = true; rerender();
    S.result = await analyzeDocument(input(), []);
    S.running = false; rerender();
  },
  'lab-all': async () => {
    S.all = [];
    for (const scenario of SCENARIOS) {
      if (scenario === 'wrong_period' && !DOC_TYPES[S.type].granularity) continue;
      S.all.push({ scenario, a: await analyzeDocument({ ...input(), fileName: `exemple_${scenario}.pdf`, scenario }, []) });
    }
    rerender();
  },
  'lab-message': () => {
    const a = S.result;
    openAssistant({
      clientName: t('lab.sample_client'),
      clientLang: 'fr',
      period: S.period,
      items: [{ key: 'lab', kind: 'issue', type: S.type, code: a.issue, details: a.details }],
    });
  },
});
export const _engine = getEngine;
