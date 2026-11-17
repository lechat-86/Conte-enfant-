// Graphiques légers (SVG / CSS), accessibles : valeurs toujours affichées en texte.
import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtNumber } from '../core/format.js';

/** @param {{segments:Array<{key:string,label:string,value:number}>, total:number, centerLabel:string, aria:string}} p */
export function donut({ segments, total, centerLabel, aria }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = (s.value / sum) * C;
      const gap = segments.filter((x) => x.value > 0).length > 1 ? 2.5 : 0;
      const el = h`<circle class="seg-${s.key}" cx="70" cy="70" r="${R}" fill="none" stroke-width="16" stroke-dasharray="${Math.max(len - gap, 0.1)} ${C - Math.max(len - gap, 0.1)}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`;
      offset += len;
      return el;
    });
  return h`<div class="donut-wrap">
    <svg viewBox="0 0 140 140" class="donut" role="img" aria-label="${aria}">
      <circle cx="70" cy="70" r="${R}" fill="none" stroke-width="16" class="donut-track"/>
      ${arcs}
      <text x="70" y="68" text-anchor="middle" class="donut-num">${fmtNumber(total)}</text>
      <text x="70" y="84" text-anchor="middle" class="donut-lbl">${centerLabel}</text>
    </svg>
    <ul class="legend">${segments.map((s) => h`<li><i class="dot seg-bg-${s.key}"></i><span>${s.label}</span><b>${fmtNumber(s.value)}</b><em>${Math.round((s.value / sum) * 100)}%</em></li>`)}</ul>
  </div>`;
}

export function hbars(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return h`<ul class="hbars">${rows.map((r) => h`<li><span class="hb-label">${r.label}</span><span class="hb-track"><span class="hb-fill seg-bg-${r.key}" style="width:${(r.value / max) * 100}%"></span></span><b>${fmtNumber(r.value)}</b></li>`)}</ul>`;
}

export function columns(values, labelFn) {
  const max = Math.max(1, ...values);
  return h`<div class="cols" role="img" aria-label="${t('dash.weekly_aria', { values: values.join(', ') })}">
    ${values.map((v, i) => h`<div class="col"><span class="col-val">${v}</span><span class="col-bar" style="height:${(v / max) * 100}%"></span><span class="col-lbl">${labelFn(i)}</span></div>`)}
  </div>`;
}
