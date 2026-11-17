import { esc, str } from '../core/html.js';
import { icon } from './icons.js';
export function toast(text, kind = 'info') {
  const root = document.getElementById('toast-root'); if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`; el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `${str(icon(kind === 'error' ? 'alert' : kind === 'success' ? 'check' : 'info'))}<span>${esc(text)}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 4200);
}
