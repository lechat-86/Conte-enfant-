// Gabarit HTML avec échappement automatique (protection XSS).
// h`<p>${valeur}</p>` échappe `valeur` ; raw() marque un fragment déjà sûr.
const RAW = Symbol('raw');

export const raw = (s) => ({ [RAW]: true, s: String(s) });

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);

export function str(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(str).join('');
  if (typeof v === 'object' && v[RAW]) return v.s;
  return esc(v);
}

export function h(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += str(vals[i]);
  });
  return raw(out);
}
