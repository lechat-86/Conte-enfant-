// Point d'entrée : routeur par hash, coque d'application, rendu, langue.
import { h, str, raw } from './core/html.js';
import { t, getLang, setLang, onLangChange } from './core/i18n.js';
import { installDelegation, onClick } from './core/actions.js';
import { setRenderer, setStore, navigate } from './core/bus.js';
import { createStore } from './data/store.js';
import { icon, logoMark } from './ui/icons.js';
import { langToggle } from './ui/components.js';
import { refreshModal, closeModal } from './ui/modals.js';
import { needsIntervention, dossierStatus } from './domain/dossier.js';
import * as dashboard from './views/dashboard.js';
import * as clients from './views/clients.js';
import * as clientDetail from './views/clientDetail.js';
import * as dossiers from './views/dossiers.js';
import * as dossierDetail from './views/dossierDetail.js';
import * as followups from './views/followups.js';
import * as lab from './views/lab.js';
import * as portal from './views/portal.js';
import * as pricing from './views/pricing.js';
import * as settings from './views/settings.js';
import * as landing from './views/landing.js';
import * as tour from './views/tour.js';

const LANG_KEY = 'readyfile-lang';
const routes = [
  { re: /^\/$/, view: dashboard, nav: 'dashboard' },
  { re: /^\/clients$/, view: clients, nav: 'clients' },
  { re: /^\/clients\/([\w-]+)$/, keys: ['id'], view: clientDetail, nav: 'clients' },
  { re: /^\/dossiers$/, view: dossiers, nav: 'dossiers' },
  { re: /^\/dossiers\/([\w-]+)$/, keys: ['id'], view: dossierDetail, nav: 'dossiers' },
  { re: /^\/followups$/, view: followups, nav: 'followups' },
  { re: /^\/analysis$/, view: lab, nav: 'analysis' },
  { re: /^\/pricing$/, view: pricing, nav: 'pricing' },
  { re: /^\/settings$/, view: settings, nav: 'settings' },
  { re: /^\/portal\/([\w-]+)$/, keys: ['token'], view: portal, nav: null },
  { re: /^\/welcome$/, view: landing, nav: null },
];
const NAV = [
  ['dashboard', '/', 'dashboard'],
  ['clients', '/clients', 'users'],
  ['dossiers', '/dossiers', 'folder'],
  ['followups', '/followups', 'mail'],
  ['analysis', '/analysis', 'scan'],
  ['pricing', '/pricing', 'tag'],
  ['settings', '/settings', 'settings'],
];

const store = createStore();
setStore(store);
let drawerOpen = false;
let lastPath = null;

try {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved) setLang(saved);
} catch { /* stockage indisponible */ }

function parseHash() {
  if (!location.hash) location.replace('#/welcome'); // première ouverture : présentation commerciale
  const raw = location.hash.replace(/^#/, '') || '/welcome';
  const [path, qs = ''] = raw.split('?');
  return { path: path.replace(/(.)\/$/, '$1'), query: Object.fromEntries(new URLSearchParams(qs)) };
}

function match(path) {
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) return { route: r, params: Object.fromEntries((r.keys || []).map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

function focusKey(el) {
  if (!el || el === document.body) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const k = ['data-input', 'data-change', 'data-action'].find((a) => el.hasAttribute(a));
  if (!k) return null;
  let sel = `${el.tagName.toLowerCase()}[${k}="${el.getAttribute(k)}"]`;
  for (const extra of ['data-slot', 'data-key', 'data-plan', 'data-lang', 'data-id']) if (el.hasAttribute(extra)) sel += `[${extra}="${el.getAttribute(extra)}"]`;
  return sel;
}

function shell(content, { nav, attention }) {
  const sample = store.getState().dossiers.find((d) => dossierStatus(d) === 'to_fix') || store.getState().dossiers[0];
  return h`
    <div class="shell ${drawerOpen ? 'drawer-open' : ''}">
      <aside class="sidebar" aria-label="${t('nav.main')}">
        <a class="brand" href="#/">${logoMark(32)}<span><strong>READYFILE</strong><em>AI</em></span></a>
        <nav>${NAV.map(([key, path, ic]) => h`<a class="nav-link" href="#${path}" ${nav === key ? raw('aria-current="page"') : ''}>${icon(ic, 19)}<span>${t(`nav.${key}`)}</span></a>`)}</nav>
        <div class="side-foot">
          <a class="nav-link" href="#/welcome">${icon('globe', 18)}<span>${t('nav.welcome')}</span></a>
          ${sample ? h`<a class="nav-link nav-portal" href="#/portal/${sample.token}">${icon('external', 18)}<span>${t('nav.portal_demo')}</span></a>` : ''}
          <div class="demo-card"><span class="dot-live"></span><div><strong>${t('demo.mode')}</strong><small>${t('demo.mode_text')}</small></div></div>
        </div>
      </aside>
      <div class="scrim" data-action="drawer-close"></div>
      <div class="main-col">
        <header class="topbar">
          <button class="icon-btn menu-btn" data-action="drawer-open" aria-label="${t('nav.open_menu')}">${icon('menu', 22)}</button>
          <span class="chip chip-demo">${icon('shield', 14)}${t('demo.chip')}</span>
          <span class="grow"></span>
          <a class="icon-btn bell" href="#/dossiers?status=attention" aria-label="${t('nav.notifications')} : ${attention}" title="${t('nav.notifications')}">${icon('bell', 20)}${attention ? h`<span class="bell-n" data-testid="bell-count">${attention}</span>` : ''}</a>
          ${langToggle()}
        </header>
        <main id="main" tabindex="-1">${content}</main>
      </div>
    </div>`;
}

function portalShell(content) {
  return h`<div class="portal-shell">
    <header class="portal-top">
      <a class="brand brand-light" href="#/">${logoMark(28)}<span><strong>READYFILE</strong><em>AI</em></span></a>
      <span class="chip chip-demo">${icon('shield', 14)}${t('portal.chip')}</span>
      <span class="grow"></span>
      <a class="btn btn-sm" href="#/dossiers">${icon('back', 14)}${t('portal.back_to_app')}</a>
      ${langToggle()}
    </header>
    <main id="main" class="portal-main" tabindex="-1">${content}</main>
  </div>`;
}

function landingShell(content) {
  return h`<div class="portal-shell">${landing.topbar()}<main id="main" tabindex="-1">${content}</main></div>`;
}

function render() {
  const { path, query } = parseHash();
  const root = document.getElementById('app');
  const hit = match(path);
  const now = new Date();
  const state = store.getState();
  const navigated = path !== lastPath || JSON.stringify(query) !== lastQuery;
  if (navigated && hit?.route.view.enter) hit.route.view.enter({ query, params: hit.params });
  const prev = focusKey(document.activeElement);
  const sel = document.activeElement?.selectionStart != null ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  const scroll = window.scrollY;

  let content;
  if (!hit) {
    content = h`<div class="empty"><h3>${t('common.not_found')}</h3><p>${t('common.not_found_text')}</p><a class="btn btn-primary" href="#/">${t('nav.dashboard')}</a></div>`;
  } else {
    content = hit.route.view.render({ store, state, params: hit.params, query, now });
  }
  const attention = state.dossiers.filter((d) => needsIntervention(d, now)).length;
  const layoutName = hit?.route.view.layout;
  const isPortal = layoutName === 'portal';
  root.innerHTML = str(layoutName === 'landing' ? landingShell(content) : isPortal ? portalShell(content) : shell(content, { nav: hit?.route.nav, attention }));
  root.insertAdjacentHTML('beforeend', str(tour.panel()));
  document.body.classList.toggle('tour-on', tour.tourActive());
  root.querySelector('#main')?.classList.toggle('enter', navigated);

  const label = hit?.route.nav ? t(`nav.${hit.route.nav}`) : isPortal ? t('portal.title') : layoutName === 'landing' ? t('nav.welcome') : t('common.not_found');
  document.title = `${label} · READYFILE AI`;

  if (navigated) {
    window.scrollTo(0, 0);
    drawerOpen = false;
    root.querySelector('.shell')?.classList.remove('drawer-open');
  } else {
    window.scrollTo(0, scroll);
    if (prev) {
      const el = root.querySelector(prev);
      if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) try { el.setSelectionRange(...sel); } catch { /* type sans sélection */ } }
    }
  }
  lastPath = path;
  lastQuery = JSON.stringify(query);
}
let lastQuery = '';

setRenderer(render);
installDelegation();

onClick({
  'set-lang': (el) => {
    setLang(el.dataset.lang);
    try { localStorage.setItem(LANG_KEY, el.dataset.lang); } catch { /* ignoré */ }
  },
  'drawer-open': () => { drawerOpen = true; document.querySelector('.shell')?.classList.add('drawer-open'); },
  'drawer-close': () => { drawerOpen = false; document.querySelector('.shell')?.classList.remove('drawer-open'); },
});

onLangChange(() => { render(); refreshModal(); });
store.subscribe(() => render());
window.addEventListener('hashchange', () => { closeModal(); render(); });
window.addEventListener('error', (e) => console.error('[readyfile]', e.message));

render();
