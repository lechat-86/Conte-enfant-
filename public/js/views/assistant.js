// Assistant de correction : prépare un message client (FR/EN). N'ENVOIE RIEN.
import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { icon } from '../ui/icons.js';
import { openModal, refreshModal } from '../ui/modals.js';
import { buildMessage } from '../domain/messages.js';
import { docName, statusBadge } from '../ui/components.js';
import { onClick, onChange, onInput } from '../core/actions.js';
import { getStore } from '../core/bus.js';
import { toast } from '../ui/toast.js';

let st = null;

const portalLink = (token) => (token ? `${location.origin}${location.pathname}#/portal/${token}` : '');
const selected = () => st.items.filter((i) => st.picked.has(i.key));

function generate() {
  st.text = buildMessage({
    lang: st.lang,
    clientName: st.clientName,
    firmName: getStore().getState().settings.firmName,
    period: st.period,
    items: selected(),
    link: st.link,
    dossierId: st.dossierId,
  });
  st.edited = false;
  st.approved = false;
  st.reviewed = false;
}

/**
 * @param {{dossierId?:string, token?:string, clientName:string, clientLang:'fr'|'en', period:string, items:Array<{key:string,kind:string,type:string,code?:string,details?:object}>, preselect?:string[]}} p
 */
export function openAssistant(p) {
  st = {
    dossierId: p.dossierId || null,
    clientName: p.clientName,
    period: p.period,
    link: portalLink(p.token),
    lang: p.clientLang || 'fr',
    items: p.items,
    picked: new Set(p.preselect || p.items.map((i) => i.key)),
    text: '',
    edited: false,
    reviewed: false,
    approved: false,
  };
  generate();
  openModal({ title: () => t('assistant.title'), wide: true, body });
}

function body() {
  const canApprove = st.reviewed && st.text.trim().length > 0 && !st.approved;
  return h`
    <p class="note note-sim" role="note">${icon('shield', 18)}<span>${t('assistant.notice')}</span></p>
    <div class="assistant">
      <div>
        <h3 class="mini-title">${t('assistant.points')}</h3>
        ${st.items.length === 0 ? h`<p class="muted">${t('assistant.no_points')}</p>` : h`<ul class="check-list">${st.items.map((it) => h`<li><label><input type="checkbox" data-change="msg-item" data-key="${it.key}" ${st.picked.has(it.key) ? 'checked' : ''}>
          <span><strong>${docName(it.type)}</strong>${it.kind === 'missing' ? h` ${statusBadge('missing', { doc: true })}` : h` <span class="badge b-to_fix">${t(`issue.${it.code}`)}</span>`}</span></label></li>`)}</ul>`}
        <h3 class="mini-title">${t('assistant.language')}</h3>
        <div class="seg" role="group" aria-label="${t('assistant.language')}">${['fr', 'en'].map((l) => h`<button type="button" class="seg-btn" data-action="msg-lang" data-lang="${l}" aria-pressed="${st.lang === l}">${t(`lang.${l}`)}</button>`)}</div>
        <p class="hint">${t('assistant.regen_hint')}</p>
      </div>
      <div>
        <div class="card-head"><h3 class="mini-title">${t('assistant.message')}</h3><span class="badge b-analyzing" id="msg-edited" ${st.edited ? '' : 'hidden'}>${t('assistant.edited')}</span></div>
        <textarea id="msg-text" data-input="msg-text" rows="13" aria-label="${t('assistant.message')}">${st.text}</textarea>
        <div class="btn-row">
          <button class="btn" type="button" data-action="msg-generate">${icon('refresh')}${t('assistant.generate')}</button>
          <button class="btn" type="button" data-action="msg-copy">${icon('copy')}${t('common.copy')}</button>
        </div>
        <div class="review-box">
          <label class="check"><input type="checkbox" data-change="msg-reviewed" ${st.reviewed ? 'checked' : ''} ${st.approved ? 'disabled' : ''}><span>${t('assistant.reviewed')}</span></label>
          <div class="btn-row">
            <button class="btn btn-primary" type="button" data-action="msg-approve" ${canApprove ? '' : 'disabled'}>${icon('check')}${t('assistant.approve')}</button>
            <button class="btn" type="button" disabled title="${t('assistant.send_disabled')}">${icon('mail')}${t('assistant.send')}</button>
          </div>
          <p class="hint">${st.approved ? h`<strong class="ok-text">${t('assistant.approved')}</strong>` : t('assistant.human_rule')}</p>
        </div>
      </div>
    </div>`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* indisponible */ }
    ta.remove();
    return ok;
  }
}

onClick({
  'msg-generate': () => { generate(); refreshModal(); },
  'msg-lang': (el) => { st.lang = el.dataset.lang; generate(); refreshModal(); },
  'msg-copy': async () => {
    const ok = await copyText(document.getElementById('msg-text')?.value ?? st.text);
    toast(ok ? t('assistant.copied') : t('assistant.copy_failed'), ok ? 'success' : 'error');
  },
  'msg-approve': () => {
    const value = document.getElementById('msg-text')?.value ?? st.text;
    if (!st.reviewed || !value.trim()) return;
    st.text = value;
    st.approved = true;
    if (st.dossierId) getStore().recordMessageApproved(st.dossierId, { lang: st.lang, count: selected().length });
    toast(t('assistant.approved_toast'), 'success');
    refreshModal();
  },
});
onChange({
  'msg-item': (el) => {
    el.checked ? st.picked.add(el.dataset.key) : st.picked.delete(el.dataset.key);
    generate();
    refreshModal();
  },
  'msg-reviewed': (el) => { st.reviewed = el.checked; refreshModal(); },
});
onInput({
  'msg-text': (el) => {
    const wasApproved = st.approved;
    st.text = el.value;
    st.edited = true;
    st.approved = false;
    document.getElementById('msg-edited')?.removeAttribute('hidden');
    if (wasApproved) { // une modification invalide l'approbation précédente
      refreshModal();
      const ta = document.getElementById('msg-text');
      ta?.focus();
      ta?.setSelectionRange(ta.value.length, ta.value.length);
    } else {
      const btn = document.querySelector('[data-action="msg-approve"]');
      if (btn) btn.disabled = !(st.reviewed && st.text.trim());
    }
  },
});
