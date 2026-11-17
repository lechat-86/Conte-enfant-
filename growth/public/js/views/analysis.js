import { h } from '../core/html.js';
import { t, has } from '../core/i18n.js';
import { fmtEur, fmtDate } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, link, tagList, emptyState } from '../ui/components.js';
import { analyze } from '../domain/analysis.js';

function tallyCard(title, items, label = (x) => x.label, key) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return h`<article class="card tally" data-testid="tally-${key}"><h2>${title}</h2>${items.length ? h`<ul class="hbars">${items.slice(0, 8).map((i) => h`<li><span class="hb-label">${label(i)}</span><span class="hb-track"><span class="hb-fill seg-bg-analyzing" style="width:${(i.count / max) * 100}%"></span></span><b>${i.count}</b></li>`)}</ul><p class="hint">${t('an.counts_note')}</p>` : h`<p class="muted">${t('an.nothing')}</p>`}</article>`;
}

export function render({ state }) {
  const a = analyze(state);
  const tagLabel = (prefix) => (x) => (has(`${prefix}.${x.key}`) ? t(`${prefix}.${x.key}`) : x.label);
  const withIv = a.rows.filter((r) => r.last);
  return h`
    ${pageHeader({ title: t('an.title'), sub: t('an.sub') })}
    <div class="note ${a.sufficient ? 'note-sim' : 'note-warn'}" role="note" data-testid="sample-note" data-sufficient="${String(a.sufficient)}">${icon(a.sufficient ? 'info' : 'alert', 18)}<p>${a.sufficient ? t('an.sample_ok', { n: a.n }) : t('an.sample_small', { n: a.n, min: a.minSample })}</p></div>
    ${a.n === 0 ? emptyState({ iconName: 'chart', title: t('an.empty'), text: t('an.empty_hint'), action: h`<a class="btn btn-primary" href="${link('/interviews/new')}">${t('interviews.new')}</a>` }) : h`
    <section class="card" data-testid="verbal-real">
      <h2>${t('an.verbal_title')}</h2><p class="muted">${t('an.verbal_sub')}</p>
      <div class="vr">
        <div><strong>${a.verbalVsReal.verbalPositive}</strong><span>${t('an.v_positive')}</span><small>${t('an.v_positive_hint')}</small></div>
        <div><strong>${a.verbalVsReal.commitment3}</strong><span>${t('an.v_l3')}</span><small>${t('an.v_l3_hint')}</small></div>
        <div class="real"><strong>${a.verbalVsReal.commitment4}</strong><span>${t('an.v_l4')}</span><small>${t('an.v_l4_hint')}</small></div>
        <div class="real"><strong>${a.verbalVsReal.priceAccepted}</strong><span>${t('an.v_price')}</span><small>${t('an.v_price_hint')}</small></div>
      </div>
    </section>
    <section class="card"><h2>${t('an.compare')}</h2>
      <div class="table-wrap"><table class="table stack compare" data-testid="compare-table"><thead><tr>
        <th>${t('prospects.firm')}</th><th class="num">${t('iv.clients')}</th><th>${t('iv.methods')}</th><th>${t('iv.software')}</th><th class="num">${t('iv.hours_short')}</th><th>${t('iv.frequency')}</th><th class="num">${t('iv.budget_short')}</th><th>${t('interviews.verbal')}</th><th>${t('interviews.level')}</th><th>${t('interviews.price_accepted')}</th><th>${t('iv.next_step')}</th></tr></thead>
        <tbody>${withIv.map(({ prospect: p, last: i, interviews }) => h`<tr data-id="${p.id}">
          <td data-label="${t('prospects.firm')}"><a class="strong" href="${link(`/prospects/${p.id}`)}">${p.firm}</a><small class="block muted">${p.country} · ${fmtDate(i.date)}</small></td>
          <td class="num" data-label="${t('iv.clients')}">${i.clientsManaged ?? '—'}</td>
          <td data-label="${t('iv.methods')}">${tagList('method', i.collectionMethods)}</td>
          <td data-label="${t('iv.software')}">${i.software.join(', ') || '—'}</td>
          <td class="num" data-label="${t('iv.hours_short')}">${i.hoursPerWeek ?? '—'}</td>
          <td data-label="${t('iv.frequency')}">${t(`freq.${i.incompleteFrequency}`)}</td>
          <td class="num" data-label="${t('iv.budget_short')}">${fmtEur(i.budgetEnvisaged)}</td>
          <td data-label="${t('interviews.verbal')}">${t(`reaction.${i.demoReaction}`)}</td>
          <td data-label="${t('interviews.level')}"><span class="badge lvl-${Math.max(...interviews.map((x) => x.commitmentLevel))}">${Math.max(...interviews.map((x) => x.commitmentLevel))}</span></td>
          <td data-label="${t('interviews.price_accepted')}">${interviews.some((x) => x.priceAcceptedExplicit) ? h`<strong>${fmtEur(interviews.find((x) => x.priceAcceptedExplicit).priceAcceptedAmount)}</strong>` : h`<span class="muted">${t('common.no')}</span>`}</td>
          <td data-label="${t('iv.next_step')}">${i.nextStep || '—'}</td></tr>`)}</tbody></table></div>
      <p class="hint">${t('iv.declared_note')}</p>
    </section>
    <section class="grid-3 tallies">
      ${tallyCard(t('an.problems'), a.problems, tagLabel('problem'), 'problems')}
      ${tallyCard(t('an.features'), a.features, tagLabel('feature'), 'features')}
      ${tallyCard(t('an.competitors'), a.competitors, (x) => x.label, 'competitors')}
      ${tallyCard(t('an.software'), a.software, (x) => x.label, 'software')}
      ${tallyCard(t('an.refusals'), a.refusals, tagLabel('refusal'), 'refusals')}
      ${tallyCard(t('an.interests'), a.interests, tagLabel('interest'), 'interests')}
    </section>
    <section class="card" data-testid="budgets">
      <h2>${t('an.budgets')}</h2>
      ${a.budgets.count ? h`<p>${a.budgets.list.map((b) => h`<span class="tag">${fmtEur(b.value)}</span> `)}</p>
        <p class="muted">${t('an.budget_range', { n: a.budgets.count, min: fmtEur(a.budgets.min), max: fmtEur(a.budgets.max) })}${a.budgets.median != null ? ` · ${t('an.budget_median', { m: fmtEur(a.budgets.median) })}` : ` · ${t('an.no_median', { min: a.minSample })}`}</p>` : h`<p class="muted">${t('an.nothing')}</p>`}
    </section>`}`;
}
