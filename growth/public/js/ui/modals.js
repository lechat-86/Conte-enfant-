import { h, str } from '../core/html.js';
import { t } from '../core/i18n.js';
import { icon } from './icons.js';
import { onClick } from '../core/actions.js';
let current = null; let lastFocus = null;
const root = () => document.getElementById('modal-root');
export function openModal(spec) { lastFocus = document.activeElement; current = spec; paint(true); }
export const refreshModal = () => current && paint(false);
export function closeModal() { if (!current) return; const { onClose } = current; current = null; root().innerHTML = ''; document.body.classList.remove('modal-open'); onClose?.(); lastFocus?.focus?.(); }
export const isModalOpen = () => !!current;
function paint(focus) {
  const m = current;
  root().innerHTML = str(h`<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal ${m.wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <header class="modal-head"><h2 id="modal-title">${m.title()}</h2><button class="icon-btn" type="button" data-action="modal-close" aria-label="${t('common.close')}">${icon('x')}</button></header>
    <div class="modal-body">${m.body()}</div></div></div>`);
  document.body.classList.add('modal-open');
  if (focus) root().querySelector('input:not([type=hidden]), select, textarea, button.btn')?.focus();
}
onClick({ 'modal-close': () => closeModal(), 'modal-backdrop': (el, e) => { if (e.target === el) closeModal(); } });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && current) closeModal();
  if (e.key === 'Tab' && current) {
    const f = [...root().querySelectorAll('button, [href], input, select, textarea')].filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) (e.preventDefault(), f.at(-1).focus());
    else if (!e.shiftKey && document.activeElement === f.at(-1)) (e.preventDefault(), f[0].focus());
  }
});
