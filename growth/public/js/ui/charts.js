import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtDate } from '../core/format.js';
import { fmtNum } from '../core/format.js';

/** Entonnoir : comptes bruts (jamais de taux de conversion avec de petits échantillons). */
export function funnel(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return h`<ul class="funnel" data-testid="funnel">${rows.map((r) => h`<li data-key="${r.key}"><span class="f-label">${t(`funnel.${r.key}`)}</span><span class="f-track"><span class="f-fill f-${r.key}" style="width:${(r.value / max) * 100}%"></span></span><b>${fmtNum(r.value)}</b></li>`)}</ul>`;
}

/** Courbes cumulées hebdomadaires (SVG). Valeurs lisibles via un tableau alternatif pour l'accessibilité. */
export function lines({ ends, series }) {
  const W = 560, H = 190, P = { l: 34, r: 10, t: 12, b: 26 };
  const keys = Object.keys(series);
  const max = Math.max(1, ...keys.flatMap((k) => series[k]));
  const x = (i) => P.l + (i * (W - P.l - P.r)) / (ends.length - 1);
  const y = (v) => H - P.b - (v / max) * (H - P.t - P.b);
  const ticks = [0, Math.ceil(max / 2), max];
  return h`<figure class="lines" data-testid="weekly">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('dash.chart_weekly_aria')}">
      ${ticks.map((v) => h`<g><line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${v}</text></g>`)}
      ${ends.map((e, i) => (i % 2 === (ends.length - 1) % 2 ? h`<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="axis">${fmtDate(e).replace(/\s?\d{4}$/, '')}</text>` : ''))}
      ${keys.map((k) => h`<polyline class="ln ln-${k}" fill="none" stroke-width="2.4" stroke-linejoin="round" points="${series[k].map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>`)}
      ${keys.map((k) => h`<circle class="dt dt-${k}" cx="${x(ends.length - 1)}" cy="${y(series[k].at(-1))}" r="3.6"/>`)}
    </svg>
    <figcaption><ul class="legend-inline">${keys.map((k) => h`<li><i class="dot ld-${k}"></i>${t(`series.${k}`)} <b>${series[k].at(-1)}</b></li>`)}</ul></figcaption>
  </figure>`;
}
