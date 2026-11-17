// Validation (retourne des clés d'erreur i18n). Aucune donnée n'est collectée automatiquement : tout est saisi.
import { isYmd } from './dates.js';
import { STATUSES, COUNTRIES, PROBLEM_TAGS, FEATURE_TAGS, METHOD_TAGS, REFUSAL_TAGS, INTEREST_TAGS, FREQUENCIES, REACTIONS, WILLINGNESS, COMMITMENT_LEVELS } from './constants.js';

const clean = (v) => String(v ?? '').trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function isHttpUrl(s) {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}
const tags = (v, allowed) => [...new Set((Array.isArray(v) ? v : v ? [v] : []).map(String))].filter((x) => allowed.includes(x));
const num = (v) => (v === '' || v == null ? null : Number(v));
const list = (v) => [...new Set(String(v ?? '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))];

export function validateProspect(input) {
  const v = {
    firm: clean(input.firm), country: clean(input.country), city: clean(input.city), website: clean(input.website),
    contactName: clean(input.contactName), contactRole: clean(input.contactRole), contactEmail: clean(input.contactEmail),
    emailLegit: input.emailLegit === true || input.emailLegit === 'on' || input.emailLegit === 'true',
    sourceUrl: clean(input.sourceUrl), firstContactAt: clean(input.firstContactAt), status: clean(input.status) || 'to_research',
    notes: clean(input.notes), nextAction: clean(input.nextAction), nextActionDate: clean(input.nextActionDate),
    budgetMonthly: num(clean(input.budgetMonthly)), problems: tags(input.problems, PROBLEM_TAGS), problemsText: clean(input.problemsText),
  };
  const e = {};
  if (v.firm.length < 2) e.firm = 'err.required_min2'; else if (v.firm.length > 120) e.firm = 'err.too_long';
  if (!COUNTRIES.includes(v.country)) e.country = 'err.required';
  if (v.city.length > 80) e.city = 'err.too_long';
  if (v.website && !isHttpUrl(v.website)) e.website = 'err.url';
  if (!v.sourceUrl) e.sourceUrl = 'err.source_required'; else if (!isHttpUrl(v.sourceUrl)) e.sourceUrl = 'err.url';
  if (v.contactName.length > 100) e.contactName = 'err.too_long';
  if (v.contactRole.length > 100) e.contactRole = 'err.too_long';
  if (v.contactEmail) {
    if (!EMAIL.test(v.contactEmail)) e.contactEmail = 'err.email';
    else if (!v.emailLegit) e.emailLegit = 'err.email_legit';
  }
  if (v.firstContactAt && !isYmd(v.firstContactAt)) e.firstContactAt = 'err.date';
  if (v.nextActionDate && !isYmd(v.nextActionDate)) e.nextActionDate = 'err.date';
  if (v.nextActionDate && !v.nextAction) e.nextAction = 'err.action_needed';
  if (!STATUSES.includes(v.status)) e.status = 'err.invalid';
  if (v.budgetMonthly != null && (!Number.isFinite(v.budgetMonthly) || v.budgetMonthly < 0 || v.budgetMonthly > 100000)) e.budgetMonthly = 'err.budget';
  if (v.notes.length > 5000) e.notes = 'err.too_long';
  if (v.problemsText.length > 2000) e.problemsText = 'err.too_long';
  return { ok: Object.keys(e).length === 0, errors: e, value: v };
}

export function validateInterview(input, prospects = []) {
  const v = {
    prospectId: clean(input.prospectId), date: clean(input.date),
    clientsManaged: num(clean(input.clientsManaged)), collectionMethods: tags(input.collectionMethods, METHOD_TAGS), software: list(input.software),
    hoursPerWeek: num(clean(input.hoursPerWeek)), incompleteFrequency: clean(input.incompleteFrequency) || 'unknown',
    difficulties: tags(input.difficulties, PROBLEM_TAGS), difficultiesText: clean(input.difficultiesText), solutionsUsed: clean(input.solutionsUsed),
    featuresWanted: tags(input.featuresWanted, FEATURE_TAGS), budgetEnvisaged: num(clean(input.budgetEnvisaged)),
    demoReaction: clean(input.demoReaction) || 'unknown', demoReactionText: clean(input.demoReactionText),
    testWillingness: clean(input.testWillingness) || 'unknown',
    priceAcceptedExplicit: input.priceAcceptedExplicit === true || input.priceAcceptedExplicit === 'on' || input.priceAcceptedExplicit === 'true',
    priceAcceptedAmount: num(clean(input.priceAcceptedAmount)),
    commitmentLevel: clean(input.commitmentLevel) === '' ? 0 : Number(input.commitmentLevel),
    competitorsCited: list(input.competitorsCited), refusalReasons: tags(input.refusalReasons, REFUSAL_TAGS), interestReasons: tags(input.interestReasons, INTEREST_TAGS),
    nextStep: clean(input.nextStep), notes: clean(input.notes),
  };
  const e = {};
  if (!prospects.some((p) => p.id === v.prospectId)) e.prospectId = 'err.required';
  if (!isYmd(v.date)) e.date = 'err.date';
  const intOk = (n, max) => n == null || (Number.isInteger(n) && n >= 0 && n <= max);
  if (!intOk(v.clientsManaged, 100000)) e.clientsManaged = 'err.integer';
  if (v.hoursPerWeek != null && (!Number.isFinite(v.hoursPerWeek) || v.hoursPerWeek < 0 || v.hoursPerWeek > 168)) e.hoursPerWeek = 'err.hours';
  if (!FREQUENCIES.includes(v.incompleteFrequency)) e.incompleteFrequency = 'err.invalid';
  if (!REACTIONS.includes(v.demoReaction)) e.demoReaction = 'err.invalid';
  if (!WILLINGNESS.includes(v.testWillingness)) e.testWillingness = 'err.invalid';
  if (v.budgetEnvisaged != null && (!Number.isFinite(v.budgetEnvisaged) || v.budgetEnvisaged < 0 || v.budgetEnvisaged > 100000)) e.budgetEnvisaged = 'err.budget';
  if (!COMMITMENT_LEVELS.includes(v.commitmentLevel)) e.commitmentLevel = 'err.invalid';
  // Intérêt verbal ≠ volonté de payer : un prix « accepté » doit être explicite et chiffré ; le niveau 5 l'exige.
  if (v.priceAcceptedExplicit && !(v.priceAcceptedAmount > 0)) e.priceAcceptedAmount = 'err.price_needed';
  if (!v.priceAcceptedExplicit && v.priceAcceptedAmount != null) e.priceAcceptedExplicit = 'err.price_explicit';
  if (v.commitmentLevel === 5 && !(v.priceAcceptedExplicit && v.priceAcceptedAmount > 0)) e.commitmentLevel = 'err.level5_price';
  for (const k of ['notes', 'nextStep', 'solutionsUsed', 'difficultiesText', 'demoReactionText']) if (v[k].length > 5000) e[k] = 'err.too_long';
  return { ok: Object.keys(e).length === 0, errors: e, value: v };
}

export function validateGoals(input) {
  const keys = ['studied', 'fr', 'en', 'demos', 'seriousIntents', 'paying'];
  const v = {}; const e = {};
  for (const k of keys) {
    const n = Number(input[k]);
    v[k] = n;
    if (input[k] === '' || !Number.isInteger(n) || n < 0 || n > 1000) e[k] = 'err.goal';
  }
  return { ok: Object.keys(e).length === 0, errors: e, value: v };
}

export function validateActivity(input) {
  const v = { kind: clean(input.kind) || 'note', text: clean(input.text), nextAction: clean(input.nextAction), nextActionDate: clean(input.nextActionDate), status: clean(input.status) };
  const e = {};
  if (!['note', 'message_sent', 'reply', 'call', 'meeting', 'demo_done'].includes(v.kind)) e.kind = 'err.invalid';
  if (v.text.length > 5000) e.text = 'err.too_long';
  if (!v.text && v.kind === 'note') e.text = 'err.required';
  if (v.nextActionDate && !isYmd(v.nextActionDate)) e.nextActionDate = 'err.date';
  if (v.nextActionDate && !v.nextAction) e.nextAction = 'err.action_needed';
  if (v.status && !STATUSES.includes(v.status)) e.status = 'err.invalid';
  return { ok: Object.keys(e).length === 0, errors: e, value: v };
}
