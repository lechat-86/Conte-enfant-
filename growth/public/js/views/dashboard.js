import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { fmtNum, fmtDateTime } from '../core/format.js';
import { icon } from '../ui/icons.js';
import { pageHeader, link, field, demoBadge } from '../ui/components.js';
import { funnel, lines } from '../ui/charts.js';
import { computeStats, weeklyProgress, goalsProgress } from '../domain/stats.js';
import { computeReminders } from '../domain/reminders.js';
import { onClick, onSubmit } from '../core/actions.js';
import { openModal, closeModal, refreshModal } from '../ui/modals.js';
import { getStore, rerender } from '../core/bus.js';
import { toast } from '../ui/toast.js';

const GOAL_KEYS = ['studied', 'fr', 'en', 'demos', 'seriousIntents', 'paying'];
let goalErrors = {}; let goalDraft = null;

function kpi({ href, label, value, sub, tone = 'neutral', ic, testid }) {
  return h`<a class="kpi tone-${tone}" href="${href}" data-testid="${testid}"><span class="kpi-ic">${icon(ic, 20)}</span><span class="kpi-label">${label}</span><strong class="kpi-val">${fmtNum(value)}</strong><span class="kpi-sub">${sub || ''}</span></a>`;
}

export function render({ store, state, today }) {
  const s = computeStats(state);
  const g = goalsProgress(state, s);
  const rm = computeReminders(state, today);
  const wk = weeklyProgress(state, today);
  const recent = [...state.activities].filter((a) => a.kind !== 'status').sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);
  const empty = s.total === 0;
  return h`
    ${pageHeader({ title: t('dash.title'), sub: t('dash.sub'), actions: h`<a class="btn btn-primary" href="${link('/prospects/new')}">${icon('plus')}${t('prospects.add')}</a>` })}
    <div class="note note-sim" role="note">${icon('info', 18)}<p>${t('dash.honesty')}</p></div>
    <section class="kpi-grid k9" aria-label="${t('dash.kpis')}">
      ${kpi({ href: link('/prospects'), label: t('kpi.total'), value: s.total, ic: 'users', testid: 'kpi-total' })}
      ${kpi({ href: link('/prospects?segment=fr'), label: t('kpi.french'), value: s.french, ic: 'globe', testid: 'kpi-french' })}
      ${kpi({ href: link('/prospects?segment=en'), label: t('kpi.english'), value: s.english, ic: 'globe', testid: 'kpi-english' })}
      ${kpi({ href: link('/prospects?status=to_contact'), label: t('kpi.to_contact'), value: s.toContact, tone: 'warn', ic: 'clock', testid: 'kpi-to-contact' })}
      ${kpi({ href: link('/prospects'), label: t('kpi.messages'), value: s.messagesSent, sub: t('kpi.messages_hint'), tone: 'info', ic: 'mail', testid: 'kpi-messages' })}
      ${kpi({ href: link('/prospects?status=replied'), label: t('kpi.replies'), value: s.repliesReceived, tone: 'info', ic: 'inbox', testid: 'kpi-replies' })}
      ${kpi({ href: link('/prospects'), label: t('kpi.demos'), value: s.demosDone, ic: 'play', testid: 'kpi-demos' })}
      ${kpi({ href: link('/prospects?status=interest_confirmed'), label: t('kpi.intents'), value: s.intents, sub: t('kpi.intents_hint', { n: s.seriousIntents }), tone: 'ok', ic: 'check', testid: 'kpi-intents' })}
      ${kpi({ href: link('/prospects?status=paying'), label: t('kpi.paying'), value: s.paying, tone: 'ok', ic: 'target', testid: 'kpi-paying' })}
    </section>

    <section class="grid-2">
      <article class="card">
        <div class="card-head"><h2>${t('goals.title')}</h2><button class="btn btn-sm" data-action="goals-edit">${icon('edit', 14)}${t('goals.edit')}</button></div>
        <ul class="goals" data-testid="goals">${GOAL_KEYS.map((k) => {
          const x = g[k]; const pct = x.target ? Math.min(100, Math.round((x.current / x.target) * 100)) : 100;
          return h`<li class="goal ${x.done ? 'done' : ''}" data-goal="${k}" data-done="${String(x.done)}"><div class="goal-top"><span>${x.done ? icon('check', 16) : icon('target', 16)}${t(`goal.${k}`)}</span><b>${x.current} / ${x.target}</b></div>
            <div class="progress ${x.done ? 'p-complete' : 'p-analyzing'}" role="progressbar" aria-valuemin="0" aria-valuemax="${x.target}" aria-valuenow="${x.current}"><span style="width:${pct}%"></span></div>
            <small class="muted">${x.done ? t('goals.reached') : t('goals.remaining', { n: x.remaining })}</small></li>`;
        })}</ul>
        <p class="hint">${t('goals.note')}</p>
      </article>
      <article class="card">
        <h2>${t('dash.funnel')}</h2>
        <p class="muted small">${t('dash.funnel_sub')}</p>
        ${funnel(s.funnel)}
      </article>
    </section>

    <section class="grid-2">
      <article class="card"><h2>${t('dash.weekly')}</h2><p class="muted small">${t('dash.weekly_sub')}</p>${empty ? h`<p class="muted">${t('common.no_data')}</p>` : lines(wk)}</article>
      <article class="card">
        <div class="card-head"><h2>${t('dash.reminders')}</h2><a class="link-more" href="${link('/reminders')}">${t('common.see_all')}${icon('arrow', 14)}</a></div>
        <ul class="rem-sum">
          <li><a href="${link('/reminders')}"><b data-testid="rem-today">${rm.today.length}</b>${t('rem.today')}</a></li>
          <li class="${rm.overdue.length ? 'late' : ''}"><a href="${link('/reminders')}"><b data-testid="rem-overdue">${rm.overdue.length}</b>${t('rem.overdue')}</a></li>
          <li><a href="${link('/reminders')}"><b>${rm.demos.length}</b>${t('rem.demos')}</a></li>
          <li><a href="${link('/reminders')}"><b>${rm.replies.length}</b>${t('rem.replies')}</a></li>
        </ul>
        <h3 class="mini-title">${t('dash.recent')}</h3>
        ${recent.length ? h`<ul class="plain-list small">${recent.map((a) => { const p = store.prospect(a.prospectId); return h`<li><a href="${link(`/prospects/${a.prospectId}`)}"><strong>${p?.firm}</strong></a> — ${t(`kind.${a.kind}`)} <span class="muted">· ${fmtDateTime(a.at)}</span></li>`; })}</ul>` : h`<p class="muted">${t('common.no_activity')}</p>`}
      </article>
    </section>`;
}

function goalsForm() {
  const g = goalDraft || getStore().getState().goals;
  return h`<form data-form="goals" novalidate>
    <p class="muted">${t('goals.edit_sub')}</p>
    <div class="row-2">${GOAL_KEYS.map((k) => field({ id: `g-${k}`, label: t(`goal.${k}`), error: goalErrors[k], children: h`<input id="g-${k}" name="${k}" type="number" min="0" max="1000" step="1" value="${g[k]}" inputmode="numeric">` }))}</div>
    <footer class="modal-foot"><button type="button" class="btn" data-action="modal-close">${t('common.cancel')}</button><button class="btn btn-primary" type="submit">${t('common.save')}</button></footer></form>`;
}

onClick({ 'goals-edit': () => { goalErrors = {}; goalDraft = null; openModal({ title: () => t('goals.edit'), body: goalsForm }); } });
onSubmit({
  goals(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const r = getStore().updateGoals(data);
    if (!r.ok) { goalErrors = r.errors; goalDraft = data; refreshModal(); return; }
    closeModal(); toast(t('goals.saved'), 'success');
  },
});
export const _r = rerender; export const _d = demoBadge;
