// Validation des formulaires. Retourne des clés d'erreur i18n (jamais de texte brut).
import { isPeriod } from './period.js';
import { TEMPLATE_IDS } from './docTypes.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v) => String(v ?? '').trim();

export function validateClient(input) {
  const v = {
    company: clean(input.company),
    contact: clean(input.contact),
    email: clean(input.email),
    country: clean(input.country),
    language: clean(input.language) || 'fr',
  };
  const errors = {};
  if (v.company.length < 2) errors.company = 'err.required_min2';
  else if (v.company.length > 80) errors.company = 'err.too_long';
  if (v.contact.length < 2) errors.contact = 'err.required_min2';
  else if (v.contact.length > 80) errors.contact = 'err.too_long';
  if (!v.email) errors.email = 'err.required';
  else if (!EMAIL.test(v.email)) errors.email = 'err.email';
  if (!v.country) errors.country = 'err.required';
  if (!['fr', 'en'].includes(v.language)) errors.language = 'err.invalid';
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export function validateDossier(input, clients) {
  const v = { clientId: clean(input.clientId), template: clean(input.template), period: clean(input.period) };
  const errors = {};
  if (!v.clientId) errors.clientId = 'err.required';
  else if (!clients.some((c) => c.id === v.clientId)) errors.clientId = 'err.invalid';
  if (!TEMPLATE_IDS.includes(v.template)) errors.template = 'err.required';
  if (!v.period) errors.period = 'err.required';
  else if (!isPeriod(v.period)) errors.period = 'err.period';
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export function validateSettings(input) {
  const v = { firmName: clean(input.firmName), retentionDays: Number(input.retentionDays) };
  const errors = {};
  if (v.firmName.length < 2) errors.firmName = 'err.required_min2';
  else if (v.firmName.length > 80) errors.firmName = 'err.too_long';
  if (!Number.isInteger(v.retentionDays) || v.retentionDays < 30 || v.retentionDays > 3650) errors.retentionDays = 'err.retention';
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}
