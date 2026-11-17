// READYFILE GROWTH — outil INTERNE de prospection (local, manuel, sans réseau).
import { h, str } from './core/html.js';
import { t, getLang, setLang, onLangChange } from './core/i18n.js';
import { installDelegation, onClick } from './core/actions.js';
import { setRenderer, setStore } from './core/bus.js';
import { createStore } from './data/store.js';
import { icon, logoMark } from './ui/icons.js';
import { langToggle } from './ui/components.js';
import { refreshModal, closeModal } from './ui/modals.js';
import { computeReminders } from './domain/reminders.js';
import { ymd } from './domain/dates.js';
import * as dashboard from './views/dashboard.js';
import * as prospects from './views/prospects.js';
import * as prospectForm from './views/prospectForm.js';
import * as prospectDetail from './views/prospectDetail.js';
import * as reminders from './views/reminders.js';
import * as templates from './views/templates.js';
import * as interviews from './views/interviews.js';
import * as analysis from './views/analysis.js';
import * as settings from './views/settings.js';
import * as importer from './views/import.js';

const routes = [
  { re: /^\/$/, view: dashboard, nav: 'dashboard' },
  { re: /^\/prospects$/, view: prospects, nav: 'prospects' },
  { re: /^\/prospects\/new$/, view: prospectForm, nav: 'prospects' },
  { re: /^\/prospects\/([\w-]+)\/edit$/, keys: ['id'], view: prospectForm, nav: 'prospects' },
  { re: /^\/prospects\/([\w-]+)$/, keys: ['id'], view: prospectDetail, nav: 'prospects' },
  { re: /^\/import$/, view: importer, nav: 'prospects' },
  { re: /^\/reminders$/, view: reminders, nav: 'reminders' },
  { re: /^\/templates$/, view: templates, nav: 'templates' },
  { re: /^\/interviews$/, view: { render: interviews.listRender }, nav: 'interviews' },
  { re: /^\/interviews\/new$/, view: { render: interviews.formRender, enter: interviews.enter }, nav: 'interviews' },
  { re: /^\/interviews\/([\w-]+)$/, keys: ['id'], view: { render: interviews.formRender, enter: interviews.enter }, nav: 'interviews' },
  { re: /^\/analysis$/, view: analysis, nav: 'analysis' },
  { re: /^\/settings$/, view: settings, nav: 'settings' },
];
const NAV = [['dashboard', '/', 'dashboard'], ['prospects', '/prospects', 'users'], ['reminders', '/reminders', 'bell'], ['templates', '/templates', 'mail'], ['interviews', '/interviews', 'chat'], ['analysis', '/analysis', 'chart'], ['settings', '/settings', 'settings']];
const LANG_KEY = 'readyfile-growth-lang';

const store = createStore();
setStore(store);
setLang(store.getState().settings.lang);
try { const l = localStorage.getItem(LANG_KEY); if (l) setLang(l); } catch { /* ignoré */ }
let drawerOpen = false; let lastPath = null; let lastQuery = '';

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path.replace(/(.)\/$/, '$1'), query: Object.fromEntries(new URLSearchParams(qs)) };
}
function match(path) {
  for (const r of routes) { const m = r.re.exec(path); if (m) return { route: r, params: Object.fromEntries((r.keys || []).map((k, i) => [k, decodeURIComponent(m[i + 1])])) }; }
  return null;
}
function focusKey(el) {
  if (!el || el === document.body) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const k = ['data-input', 'data-change', 'data-action'].find((a) => el.hasAttribute(a));
  if (!k) return null;
  let sel = `${el.tagName.toLowerCase()}[${k}="${el.getAttribute(k)}"]`;
  for (const x of ['data-id', 'data-lang', 'data-key']) if (el.hasAttribute(x)) sel += `[${x}="${el.getAttribute(x)}"]`;
  return sel;
}

function shell(content, nav, remCount, demo) {
  return h`<div class="shell ${drawerOpen ? 'drawer-open' : ''}">
    <aside class="sidebar" aria-label="${t('nav.main')}">
      <a class="brand" href="#/">${logoMark(32)}<span><strong>READYFILE</strong><em>GROWTH</em></span></a>
      <nav>${NAV.map(([k, p, ic]) => h`<a class="nav-link" href="#${p}" ${nav === k ? 'aria-current="page"' : ''}>${icon(ic, 19)}<span>${t(`nav.${k}`)}</span>${k === 'reminders' && remCount ? h`<span class="nav-count" data-testid="nav-rem">${remCount}</span>` : ''}</a>`)}</nav>
      <div class="side-foot"><div class="demo-card"><span class="dot-live"></span><div><strong>${t('internal.title')}</strong><small>${t('internal.text')}</small></div></div></div>
    </aside>
    <div class="scrim" data-action="drawer-close"></div>
    <div class="main-col">
      <header class="topbar"><button class="icon-btn menu-btn" data-action="drawer-open" aria-label="${t('nav.open_menu')}">${icon('menu', 22)}</button>
        <span class="chip chip-internal">${icon('lock', 14)}${t('internal.chip')}</span><span class="grow"></span>${langToggle()}</header>
      <main id="main" tabindex="-1">${demo ? h`<div class="demo-banner" role="status" data-testid="demo-banner">${icon('alert', 18)}<p>${t('demo.banner')} <a href="#/settings">${t('demo.banner_link')}</a></p></div>` : ''}${content}</main>
    </div></div>`;
}

function render() {
  const { path, query } = parseHash();
  const root = document.getElementById('app');
  const hit = match(path);
  const state = store.getState();
  const today = ymd();
  const sig = JSON.stringify(query);
  const navigated = path !== lastPath || sig !== lastQuery;
  if (navigated) drawerOpen = false; // fermer le tiroir mobile avant de rendre la coque
  if (navigated && hit?.route.view.enter) hit.route.view.enter({ query, params: hit.params });
  const prev = focusKey(document.activeElement);
  const sel = document.activeElement?.selectionStart != null ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  const scroll = window.scrollY;
  const content = hit ? hit.route.view.render({ store, state, params: hit.params, query, today }) : h`<div class="empty"><h3>${t('common.not_found')}</h3><a class="btn btn-primary" href="#/">${t('nav.dashboard')}</a></div>`;
  root.innerHTML = str(shell(content, hit?.route.nav, computeReminders(state, today).count, store.hasDemo()));
  root.querySelector('#main')?.classList.toggle('enter', navigated);
  document.title = `${hit?.route.nav ? t(`nav.${hit.route.nav}`) : t('common.not_found')} · READYFILE GROWTH`;
  if (navigated) { window.scrollTo(0, 0); drawerOpen = false; }
  else {
    window.scrollTo(0, scroll);
    const el = prev && root.querySelector(prev);
    if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) try { el.setSelectionRange(...sel); } catch { /* sans sélection */ } }
  }
  lastPath = path; lastQuery = sig;
}

setRenderer(render);
installDelegation();
onClick({
  'set-lang': (el) => { setLang(el.dataset.lang); store.updateSettings({ lang: el.dataset.lang }); try { localStorage.setItem(LANG_KEY, el.dataset.lang); } catch { /* ignoré */ } },
  'drawer-open': () => { drawerOpen = true; document.querySelector('.shell')?.classList.add('drawer-open'); },
  'drawer-close': () => { drawerOpen = false; document.querySelector('.shell')?.classList.remove('drawer-open'); },
});
onLangChange(() => { render(); refreshModal(); });
store.subscribe(() => render());
window.addEventListener('hashchange', () => { closeModal(); render(); });
window.addEventListener('error', (e) => console.error('[growth]', e.message));
render();
export const _g = getLang;
