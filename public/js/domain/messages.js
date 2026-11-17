// Assistant de correction : génération de messages client (FR / EN).
// AUCUN envoi : le texte est préparé, modifiable, copiable, et soumis à validation humaine.
import { t } from '../core/i18n.js';
import { fmtPeriod, fmtYear } from '../core/format.js';
import { DOC_TYPES } from './docTypes.js';

/**
 * Un « item » décrit un point à régulariser :
 *  { kind:'issue', type, code, details? }  ou  { kind:'missing', type }
 */
export function itemsFromDossier(dossier, { includeMissing = true } = {}) {
  const items = [];
  for (const s of dossier.slots) {
    if (s.doc?.status === 'invalid') items.push({ kind: 'issue', slotId: s.id, type: s.type, code: s.doc.analysis.issue, details: s.doc.analysis.details });
    else if (!s.doc && includeMissing) items.push({ kind: 'missing', slotId: s.id, type: s.type });
  }
  return items;
}

function periodFor(type, period, lang) {
  const g = DOC_TYPES[type]?.granularity;
  if (!g) return '';
  return g === 'year' ? fmtYear(period) : fmtPeriod(period, lang);
}

function itemText(item, period, lang) {
  const doc = t(`doc.${item.type}`, {}, lang);
  const per = periodFor(item.type, period, lang);
  const d = item.details || {};
  const params = {
    doc,
    period: per,
    found: d.pages?.found ?? '?',
    expected: d.pages?.expected ?? '?',
    detected: d.detectedType ? t(`doc.${d.detectedType}`, {}, lang) : '',
    detectedPeriod: d.detectedPeriod ? (DOC_TYPES[item.type]?.granularity === 'year' ? fmtYear(d.detectedPeriod) : fmtPeriod(d.detectedPeriod, lang)) : '',
  };
  return item.kind === 'missing' ? t('msg.item.missing', params, lang) : t(`msg.item.${item.code}`, params, lang);
}

/**
 * @param {{lang:'fr'|'en', clientName:string, firmName:string, period:string, items:Array, link?:string, dossierId?:string}} p
 */
export function buildMessage({ lang, clientName, firmName, period, items, link, dossierId }) {
  if (!items.length) return t('msg.nothing', {}, lang);
  const parts = [t('msg.greeting', { name: clientName }, lang), ''];
  if (items.length === 1 && items[0].kind === 'issue') {
    // Formulation naturelle quand un seul document pose problème.
    const it = items[0];
    const d = it.details || {};
    parts.push(
      t(`msg.single.${it.code}`, {
        doc: t(`doc.${it.type}`, {}, lang),
        found: d.pages?.found ?? '?',
        expected: d.pages?.expected ?? '?',
        detected: d.detectedType ? t(`doc.${d.detectedType}`, {}, lang) : '',
        period: periodFor(it.type, period, lang),
      }, lang),
    );
  } else {
    parts.push(t('msg.intro', { dossier: dossierId || '' }, lang).trim(), '');
    for (const it of items) parts.push(`• ${itemText(it, period, lang)}`);
  }
  if (link) parts.push('', t('msg.link', { link }, lang));
  parts.push('', t('msg.closing', {}, lang), t('msg.signoff', { firm: firmName }, lang));
  return parts.join('\n');
}
