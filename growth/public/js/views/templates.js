// Bibliothèque de messages. L'outil ne SAIT PAS envoyer : il prépare, l'utilisateur copie et envoie lui-même.
import { h } from '../core/html.js';
import { t, getLang } from '../core/i18n.js';
import { icon } from '../ui/icons.js';
import { pageHeader, link } from '../ui/components.js';
import { TEMPLATE_IDS, renderTemplate } from '../domain/templates.js';
import { onClick, onChange, onInput } from '../core/actions.js';
import { getStore, rerender } from '../core/bus.js';
import { toast } from '../ui/toast.js';
import { openActivityModal } from './prospectDetail.js';

const S = { id: 'first_contact', lang: null, prospectId: '', subject: '', body: '', unresolved: [], dirty: false };
const msgLang = () => S.lang || getLang();

function regen() {
  const store = getStore();
  const p = S.prospectId ? store.prospect(S.prospectId) : null;
  const out = renderTemplate(S.id, msgLang(), { contact: p?.contactName, firm: p?.firm, sender: store.getState().settings.senderName, city: p?.city });
  Object.assign(S, { subject: out.subject, body: out.body, unresolved: out.unresolved, dirty: false });
}

export function enter({ query }) {
  if (query.prospect && getStore().prospect(query.prospect)) S.prospectId = query.prospect;
  regen();
}

export function render({ state }) {
  return h`
    ${pageHeader({ title: t('tpl.title'), sub: t('tpl.sub') })}
    <div class="note note-warn" role="note">${icon('shield', 18)}<p>${t('tpl.no_send')}</p></div>
    <section class="tpl-layout">
      <nav class="card tpl-list" aria-label="${t('tpl.title')}"><ul>${TEMPLATE_IDS.map((id) => h`<li><button class="tpl-item" data-action="tpl-pick" data-id="${id}" aria-pressed="${String(S.id === id)}"><strong>${t(`tplname.${id}`)}</strong><small>${t(`tplwhen.${id}`)}</small></button></li>`)}</ul></nav>
      <article class="card">
        <div class="tpl-controls">
          <div class="field"><span class="label">${t('tpl.lang')}</span><div class="seg" role="group">${['fr', 'en'].map((l) => h`<button type="button" class="seg-btn" data-action="tpl-lang" data-lang="${l}" aria-pressed="${String(msgLang() === l)}">${t(`lang.${l}`)}</button>`)}</div></div>
          <div class="field grow"><label for="tpl-prospect">${t('tpl.prospect')}</label><select id="tpl-prospect" data-change="tpl-prospect"><option value="">${t('tpl.no_prospect')}</option>${state.prospects.map((p) => h`<option value="${p.id}" ${S.prospectId === p.id ? 'selected' : ''}>${p.firm}</option>`)}</select></div>
        </div>
        ${!state.settings.senderName ? h`<p class="hint">${t('tpl.sender_hint')} <a href="${link('/settings')}">${t('nav.settings')}</a></p>` : ''}
        <div class="field"><label for="tpl-subject">${t('tpl.subject')}</label><input id="tpl-subject" data-input="tpl-subject" value="${S.subject}"></div>
        <div class="field"><label for="tpl-body">${t('tpl.body')}</label><textarea id="tpl-body" data-input="tpl-body" rows="14">${S.body}</textarea></div>
        ${S.unresolved.length ? h`<p class="hint warn-text" data-testid="unresolved">${icon('alert', 14)} ${t('tpl.unresolved')} ${S.unresolved.map((u) => h`<code>${u}</code> `)}</p>` : h`<p class="hint">${t('tpl.edit_hint')}</p>`}
        <div class="btn-row">
          <button class="btn btn-primary" data-action="tpl-copy-body">${icon('copy')}${t('tpl.copy_message')}</button>
          <button class="btn" data-action="tpl-copy-subject">${icon('copy')}${t('tpl.copy_subject')}</button>
          <button class="btn" data-action="tpl-reset">${icon('refresh')}${t('tpl.reset')}</button>
          <button class="btn" data-action="tpl-log" ${S.prospectId ? '' : 'disabled'} title="${t('tpl.log_hint')}">${icon('check')}${t('tpl.log_sent')}</button>
        </div>
        <p class="hint">${t('tpl.log_hint')}</p>
      </article>
    </section>`;
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* indisponible */ } ta.remove(); return ok;
  }
}

onClick({
  'tpl-pick': (el) => { S.id = el.dataset.id; regen(); rerender(); },
  'tpl-lang': (el) => { S.lang = el.dataset.lang; regen(); rerender(); },
  'tpl-reset': () => { regen(); rerender(); },
  'tpl-copy-body': async () => toast((await copy(document.getElementById('tpl-body')?.value ?? S.body)) ? t('tpl.copied') : t('tpl.copy_failed'), 'success'),
  'tpl-copy-subject': async () => toast((await copy(document.getElementById('tpl-subject')?.value ?? S.subject)) ? t('tpl.copied') : t('tpl.copy_failed'), 'success'),
  'tpl-log': () => openActivityModal(S.prospectId, 'message_sent', { text: t('tpl.log_text', { name: t(`tplname.${S.id}`), lang: msgLang().toUpperCase() }) }),
});
onChange({ 'tpl-prospect': (el) => { S.prospectId = el.value; regen(); rerender(); } });
onInput({ 'tpl-subject': (el) => { S.subject = el.value; S.dirty = true; }, 'tpl-body': (el) => { S.body = el.value; S.dirty = true; } });
