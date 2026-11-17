// Import CSV de prospects : choisir → PRÉVISUALISER → valider → résultat. Rien n'est ajouté sans validation explicite.
import { h } from '../core/html.js';
import { t } from '../core/i18n.js';
import { icon } from '../ui/icons.js';
import { pageHeader, link, emptyState } from '../ui/components.js';
import { IMPORT_COLUMNS, REQUIRED_COLUMNS, REASONS, parseImportFile, evaluateRecords, summarize, templateCsv, refusalReportCsv, MAX_FILE_CHARS, MAX_ROWS } from '../domain/importCsv.js';
import { onClick, onChange } from '../core/actions.js';
import { getStore, rerender, navigate } from '../core/bus.js';
import { openModal, closeModal } from '../ui/modals.js';
import { toast } from '../ui/toast.js';
import { download } from '../ui/download.js';
import { ymd } from '../domain/dates.js';

const blank = () => ({ stage: 'start', fileName: '', error: null, parsed: null, rows: [], selected: new Set(), result: null });
let S = blank();

export const enter = () => { S = blank(); };

const reasonText = (c) => t(`imp.reason.${c}`);
const validRows = () => S.rows.filter((r) => r.status === 'valid');
const refusedRows = () => S.rows.filter((r) => r.status === 'refused');

function formatTable() {
  return h`<div class="table-wrap"><table class="table stack imp-format" data-testid="imp-format"><thead><tr><th>${t('imp.col_name')}</th><th>${t('imp.col_req')}</th><th>${t('imp.col_desc')}</th></tr></thead>
    <tbody>${IMPORT_COLUMNS.map((c) => h`<tr><td data-label="${t('imp.col_name')}"><code class="plain">${c}</code></td><td data-label="${t('imp.col_req')}">${REQUIRED_COLUMNS.includes(c) ? h`<span class="badge b-to_fix">${t('imp.required')}</span>` : h`<span class="muted">${t('imp.optional')}</span>`}</td><td data-label="${t('imp.col_desc')}">${t(`imp.col.${c}`)}</td></tr>`)}</tbody></table></div>`;
}

function startView() {
  return h`
    <section class="card">
      <h2>${t('imp.step1')}</h2>
      ${S.error ? h`<div class="note note-warn" role="alert" data-testid="imp-error">${icon('alert', 18)}<p>${t(`imp.err.${S.error.code}`, { cols: (S.error.missing || []).join(', '), max: S.error.max ?? MAX_ROWS })}</p></div>` : ''}
      <div class="btn-row">
        <label class="btn btn-primary file-btn">${icon('upload')}${t('imp.choose')}<input type="file" accept=".csv,text/csv,text/plain" data-change="imp-file" data-testid="imp-file"></label>
        <button class="btn" data-action="imp-template">${icon('download')}${t('imp.template')}</button>
      </div>
      <p class="hint">${t('imp.limits', { rows: MAX_ROWS, mb: MAX_FILE_CHARS / 1e6 })}</p>
    </section>
    <section class="card mt-card"><h2>${t('imp.format_title')}</h2><p class="muted">${t('imp.format_intro')}</p>${formatTable()}
      <h3 class="mini-title">${t('imp.rules_title')}</h3><ul class="limits-list">${[1, 2, 3, 4, 5, 6, 7].map((n) => h`<li>${icon('shield', 16)}<span>${t(`imp.rule${n}`)}</span></li>`)}</ul></section>`;
}

function previewView() {
  const sum = summarize(S.rows); const v = validRows(); const sel = v.filter((r) => S.selected.has(r.line)).length;
  return h`
    <div class="note note-sim" role="note">${icon('shield', 18)}<p>${t('imp.safety')}</p></div>
    <section class="imp-sum" data-testid="imp-summary">
      <div><strong>${sum.total}</strong><span>${t('imp.sum_total')}</span></div>
      <div class="ok"><strong data-testid="imp-n-valid">${sum.valid}</strong><span>${t('imp.sum_valid')}</span></div>
      <div class="bad"><strong data-testid="imp-n-refused">${sum.refused}</strong><span>${t('imp.sum_refused')}</span></div>
    </section>
    ${S.parsed.ignoredColumns.length ? h`<div class="note note-warn" role="note" data-testid="imp-ignored">${icon('alert', 18)}<p>${t('imp.ignored', { cols: S.parsed.ignoredColumns.join(', ') })}</p></div>` : ''}
    <section class="card">
      <div class="card-head"><h2>${t('imp.preview')} — <span class="muted">${S.fileName}</span></h2>
        <span class="inline-actions"><button class="btn btn-sm" data-action="imp-all">${t('imp.select_all')}</button><button class="btn btn-sm" data-action="imp-none">${t('imp.select_none')}</button></span></div>
      <div class="table-wrap"><table class="table stack imp-table" data-testid="imp-table"><thead><tr><th></th><th>${t('imp.col_line')}</th><th>${t('imp.col_verdict')}</th><th>${t('prospects.firm')}</th><th>${t('prospects.country')}</th><th>${t('prospects.city')}</th><th>${t('imp.h_website')}</th><th>${t('imp.h_source')}</th><th>${t('imp.h_email')}</th></tr></thead>
        <tbody>${S.rows.map((r) => {
          const raw = r.raw || {};
          return h`<tr data-line="${r.line}" data-status="${r.status}" class="${r.status === 'refused' ? 'row-refused' : ''}">
            <td data-label="">${r.status === 'valid' ? h`<input type="checkbox" data-change="imp-toggle" data-line="${r.line}" aria-label="${t('imp.select_row', { n: r.line })}" ${S.selected.has(r.line) ? 'checked' : ''}>` : ''}</td>
            <td data-label="${t('imp.col_line')}">${r.line}</td>
            <td data-label="${t('imp.col_verdict')}">${r.status === 'valid' ? h`<span class="badge b-complete">${t('imp.ok')}</span>` : h`<span class="badge b-to_fix">${t('imp.refused')}</span><ul class="reasons">${r.reasons.map((c) => h`<li data-reason="${c}">${reasonText(c)}${c === 'duplicate_existing' && r.duplicateOf ? ` (${r.duplicateOf.id} — ${r.duplicateOf.firm})` : ''}${c === 'duplicate_in_file' && r.duplicateOf ? ` (${t('imp.line_n', { n: r.duplicateOf.line })})` : ''}</li>`)}</ul>`}</td>
            <td data-label="${t('prospects.firm')}"><strong>${raw.firm || r.cells?.[0] || '—'}</strong></td>
            <td data-label="${t('prospects.country')}">${raw.country || '—'}</td><td data-label="${t('prospects.city')}">${raw.city || '—'}</td>
            <td data-label="${t('imp.h_website')}" class="wrap">${raw.website || '—'}</td><td data-label="${t('imp.h_source')}" class="wrap">${raw.source_url || '—'}</td>
            <td data-label="${t('imp.h_email')}" class="wrap">${raw.contact_email || '—'}</td></tr>`;
        })}</tbody></table></div>
      <div class="btn-row">
        <button class="btn btn-primary" data-action="imp-confirm" data-testid="imp-import" ${sel ? '' : 'disabled'}>${icon('check')}${t('imp.import_btn', { n: sel })}</button>
        <button class="btn" data-action="imp-backup">${icon('download')}${t('imp.backup')}</button>
        ${sum.refused ? h`<button class="btn" data-action="imp-report" data-testid="imp-report">${icon('download')}${t('imp.report')}</button>` : ''}
        <button class="btn" data-action="imp-reset">${t('imp.cancel')}</button>
      </div>
      ${sel === 0 ? h`<p class="hint">${t('imp.none_valid')}</p>` : ''}
    </section>`;
}

function doneView() {
  const r = S.result;
  return h`
    <section class="card imp-done" data-testid="imp-done">
      <h2>${icon('check', 20)} ${t('imp.done_title')}</h2>
      <section class="imp-sum">
        <div class="ok"><strong data-testid="imp-done-imported">${r.imported}</strong><span>${t('imp.done_imported')}</span></div>
        <div class="bad"><strong data-testid="imp-done-refused">${r.refused.length}</strong><span>${t('imp.done_refused')}</span></div>
        ${r.skipped ? h`<div><strong>${r.skipped}</strong><span>${t('imp.done_skipped')}</span></div>` : ''}
      </section>
      <p class="muted">${t('imp.done_notice')}</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="${link('/prospects')}">${t('imp.done_view')}</a>
        ${r.refused.length ? h`<button class="btn" data-action="imp-report" data-testid="imp-report">${icon('download')}${t('imp.report')}</button>` : ''}
        <button class="btn" data-action="imp-reset">${t('imp.again')}</button>
      </div>
    </section>`;
}

export function render() {
  return h`${pageHeader({ back: { href: link('/prospects'), label: t('prospects.title') }, title: t('imp.title'), sub: t('imp.sub') })}
    ${S.stage === 'start' ? startView() : S.stage === 'preview' ? previewView() : doneView()}`;
}

async function readFile(el) {
  const f = el.files?.[0]; el.value = '';
  if (!f) return;
  if (!/\.(csv|txt)$/i.test(f.name)) { S = { ...blank(), error: { code: 'bad_type' } }; return rerender(); }
  if (f.size > MAX_FILE_CHARS * 2) { S = { ...blank(), error: { code: 'too_large' } }; return rerender(); }
  // Le fichier est lu localement ; rien n'est transmis. Aucun prospect n'est créé à cette étape.
  const parsed = parseImportFile(await f.text());
  if (!parsed.ok) { S = { ...blank(), error: { code: parsed.error, missing: parsed.missing, max: parsed.max } }; return rerender(); }
  const rows = evaluateRecords(parsed.records, getStore().getState().prospects, ymd());
  S = { stage: 'preview', fileName: f.name, error: null, parsed, rows, selected: new Set(rows.filter((r) => r.status === 'valid').map((r) => r.line)), result: null };
  rerender();
}

function confirm() {
  const n = validRows().filter((r) => S.selected.has(r.line)).length;
  openModal({
    title: () => t('imp.confirm_title'),
    body: () => h`<p data-testid="imp-confirm-text">${t('imp.confirm_text', { n })}</p><p class="hint">${t('imp.confirm_safe')}</p>
      <footer class="modal-foot"><button class="btn" data-action="modal-close">${t('common.cancel')}</button><button class="btn btn-primary" data-action="imp-do" data-testid="imp-confirm-ok">${icon('check')}${t('imp.confirm_ok', { n })}</button></footer>`,
  });
}

onChange({
  'imp-file': (el) => readFile(el),
  'imp-toggle': (el) => { const l = Number(el.dataset.line); el.checked ? S.selected.add(l) : S.selected.delete(l); rerender(); },
});
onClick({
  'imp-template': () => download('readyfile-growth-import-modele.csv', templateCsv()),
  'imp-all': () => { S.selected = new Set(validRows().map((r) => r.line)); rerender(); },
  'imp-none': () => { S.selected = new Set(); rerender(); },
  'imp-reset': () => { S = blank(); rerender(); },
  'imp-confirm': () => confirm(),
  'imp-backup': () => { download(`readyfile-growth-backup-${ymd()}.json`, getStore().exportBackup(), 'application/json;charset=utf-8'); toast(t('imp.backup_done'), 'success'); },
  'imp-report': () => {
    const rows = S.stage === 'done' ? S.result.refused : refusedRows();
    download(`readyfile-growth-import-refuses-${ymd()}.csv`, refusalReportCsv(rows.map((r) => ({ ...r, status: 'refused' })), (c) => reasonText(c)));
  },
  'imp-do': () => {
    const chosen = validRows().filter((r) => S.selected.has(r.line));
    if (!chosen.length) return;
    const res = getStore().importProspects(chosen.map((r) => ({ line: r.line, raw: r.raw, cells: r.cells })), { fileName: S.fileName });
    closeModal();
    const refusedNow = res.rows.filter((r) => r.status === 'refused');
    S = { ...S, stage: 'done', result: { imported: res.imported.length, refused: [...refusedRows(), ...refusedNow], skipped: validRows().length - chosen.length } };
    toast(t('imp.toast', { n: res.imported.length }), 'success');
    rerender();
  },
});
export const _n = navigate;
