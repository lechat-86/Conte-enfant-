// Démo guidée : 7 étapes qui pilotent l'application réelle (états, calculs et écrans réels).
// Ce qui est simulé (analyse, dépôt, envoi) est rappelé à CHAQUE étape.
import { h } from '../core/html.js';
import { t, has, getLang } from '../core/i18n.js';
import { icon } from '../ui/icons.js';
import { onClick } from '../core/actions.js';
import { getStore, navigate, rerender } from '../core/bus.js';
import { DOC_TYPES } from '../domain/docTypes.js';
import { monthOf, shiftMonths } from '../domain/period.js';
import { slotState } from '../domain/dossier.js';
import { assistantFor } from './dossierDetail.js';
import { toast } from '../ui/toast.js';

export const TOTAL = 7;
const T = { active: false, step: 0, dossierId: null };
// Scénarios du dépôt initial (modèle « comptabilité mensuelle » : relevé, ventes, achats, paie)
const FIRST_DEPOSIT = ['ok', 'incomplete', 'ok', 'unreadable'];

export const tourActive = () => T.active;
export const tourState = () => ({ ...T });

function ensureDossier() {
  const store = getStore();
  const existing = T.dossierId && store.dossier(T.dossierId);
  if (existing) return existing;
  const lang = getLang();
  const c = store.addClient({ company: t('tour.demo_client'), contact: 'Claire Démo', email: 'claire@atelier-demo.example', country: lang === 'en' ? 'GB' : 'FR', language: lang });
  const d = store.addDossier({ clientId: c.client.id, template: 'monthly_bookkeeping', period: shiftMonths(monthOf(new Date()), -1) });
  T.dossierId = d.dossier.id;
  return d.dossier;
}

const dossierPath = () => `/dossiers/${ensureDossier().id}`;
const portalPath = () => `/portal/${ensureDossier().token}`;
const ROUTES = [() => '/welcome', () => '/dossiers', dossierPath, portalPath, dossierPath, dossierPath, portalPath];

function deposit(d, slot, scenario, suffix) {
  const stamp = DOC_TYPES[slot.type].granularity === 'year' ? d.period.slice(0, 4) : d.period;
  return getStore().submitDocument(d.id, slot.id, { fileName: `${DOC_TYPES[slot.type].stem}_${stamp}_${suffix}.pdf`, scenario, via: 'portal' });
}

const ACTIONS = {
  1: () => {},
  2: () => { const d = ensureDossier(); navigate(`/dossiers/${d.id}`); },
  3: () => assistantFor(ensureDossier().id),
  4: () => {
    const d = ensureDossier();
    d.slots.forEach((s, i) => { if (slotState(s) === 'missing') deposit(d, s, FIRST_DEPOSIT[i], 'demo'); });
    toast(t('toast.deposit_sim'), 'info');
  },
  5: () => {},
  6: () => assistantFor(ensureDossier().id),
  7: () => {
    const d = ensureDossier();
    d.slots.forEach((s) => { if (slotState(s) === 'invalid') deposit(d, s, 'ok', 'v2'); });
    toast(t('toast.deposit_sim'), 'info');
  },
};

function go(step) {
  T.step = Math.max(0, Math.min(TOTAL - 1, step));
  navigate(ROUTES[T.step]());
  rerender();
}

export function panel() {
  if (!T.active) return '';
  const n = T.step + 1;
  const doKey = `tour.s${n}.do`;
  return h`<aside class="tour" role="complementary" aria-label="${t('tour.step', { n, total: TOTAL })}" data-testid="tour" data-step="${n}">
    <div class="tour-top"><span class="tour-step">${t('tour.step', { n, total: TOTAL })}</span>
      <button class="icon-btn" data-action="tour-quit" aria-label="${t('tour.quit')}" title="${t('tour.quit')}">${icon('x', 18)}</button></div>
    <div class="tour-dots" aria-hidden="true">${Array.from({ length: TOTAL }, (_, i) => h`<i class="${i <= T.step ? 'on' : ''}"></i>`)}</div>
    <h2>${t(`tour.s${n}.title`)}</h2>
    <p>${t(`tour.s${n}.text`)}</p>
    <p class="tour-sim">${icon('info', 14)}<span>${t(`tour.s${n}.sim`)}</span></p>
    <div class="tour-btns">
      <button class="btn btn-sm" data-action="tour-back" ${T.step === 0 ? 'disabled' : ''}>${t('tour.back')}</button>
      ${has(doKey) ? h`<button class="btn btn-sm btn-primary" data-action="tour-do">${icon('play', 14)}${t(doKey)}</button>` : ''}
      <button class="btn btn-sm ${has(doKey) ? '' : 'btn-primary'}" data-action="tour-next">${T.step === TOTAL - 1 ? t('tour.finish') : t('tour.next')}</button>
    </div></aside>`;
}

onClick({
  'tour-start': () => {
    getStore().resetDemo(); // état de départ connu et reproductible
    Object.assign(T, { active: true, step: 0, dossierId: null });
    navigate('/welcome');
    rerender();
    document.getElementById('l-problem')?.scrollIntoView({ behavior: 'smooth' });
  },
  'tour-do': () => ACTIONS[T.step + 1](),
  'tour-next': () => {
    if (T.step === TOTAL - 1) { T.active = false; navigate('/'); rerender(); return; }
    go(T.step + 1);
  },
  'tour-back': () => go(T.step - 1),
  'tour-quit': () => { T.active = false; rerender(); },
});
