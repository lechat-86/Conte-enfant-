// Exports CSV (UTF-8, RFC 4180). Protection contre l'injection de formules (Excel/Sheets) : =, +, -, @, tab, CR.
import { segmentOf } from './constants.js';

export function csvCell(value) {
  let s = Array.isArray(value) ? value.join(' | ') : value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (header, rows) => [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

export const PROSPECT_COLUMNS = ['id', 'demo', 'firm', 'country', 'segment', 'city', 'website', 'contact_name', 'contact_role', 'contact_email', 'email_legitimacy_confirmed', 'source_url', 'added_at', 'first_contact_at', 'status', 'next_action', 'next_action_date', 'budget_monthly_eur', 'problems', 'problems_text', 'notes', 'email_source_url', 'source_verified_on'];
export const prospectsCsv = (state) => toCsv(PROSPECT_COLUMNS, state.prospects.map((p) => [p.id, p.demo ? 'yes' : '', p.firm, p.country, segmentOf(p.country), p.city, p.website, p.contactName, p.contactRole, p.contactEmail, p.emailLegit ? 'yes' : '', p.sourceUrl, p.addedAt, p.firstContactAt, p.status, p.nextAction, p.nextActionDate, p.budgetMonthly, p.problems, p.problemsText, p.notes, p.emailSourceUrl, p.sourceVerifiedAt]));

export const INTERVIEW_COLUMNS = ['id', 'demo', 'prospect_id', 'firm', 'date', 'clients_managed', 'collection_methods', 'software', 'hours_per_week_declared', 'incomplete_frequency_declared', 'difficulties', 'difficulties_text', 'solutions_used', 'features_wanted', 'budget_envisaged_eur', 'demo_reaction_verbal', 'demo_reaction_text', 'test_willingness', 'price_explicitly_accepted', 'price_accepted_eur', 'commitment_level_0_5', 'competitors_cited', 'refusal_reasons', 'interest_reasons', 'next_step', 'notes'];
export const interviewsCsv = (state) => toCsv(INTERVIEW_COLUMNS, state.interviews.map((i) => {
  const p = state.prospects.find((x) => x.id === i.prospectId);
  return [i.id, p?.demo ? 'yes' : '', i.prospectId, p?.firm, i.date, i.clientsManaged, i.collectionMethods, i.software, i.hoursPerWeek, i.incompleteFrequency, i.difficulties, i.difficultiesText, i.solutionsUsed, i.featuresWanted, i.budgetEnvisaged, i.demoReaction, i.demoReactionText, i.testWillingness, i.priceAcceptedExplicit ? 'yes' : 'no', i.priceAcceptedAmount, i.commitmentLevel, i.competitorsCited, i.refusalReasons, i.interestReasons, i.nextStep, i.notes];
}));

export const NOTE_COLUMNS = ['id', 'demo', 'prospect_id', 'firm', 'at', 'kind', 'text'];
export const notesCsv = (state) => toCsv(NOTE_COLUMNS, [...state.activities].sort((a, b) => a.at.localeCompare(b.at)).map((a) => {
  const p = state.prospects.find((x) => x.id === a.prospectId);
  return [a.id, p?.demo ? 'yes' : '', a.prospectId, p?.firm, a.at, a.kind, a.text];
}));

/** Notes commerciales en texte lisible (une section par cabinet). */
export function notesText(state) {
  const out = ['READYFILE GROWTH — notes commerciales (confidentiel, usage interne)', ''];
  for (const p of state.prospects) {
    const acts = state.activities.filter((a) => a.prospectId === p.id && a.text).sort((a, b) => a.at.localeCompare(b.at));
    if (!acts.length && !p.notes) continue;
    out.push(`## ${p.firm}${p.demo ? ' [DÉMO]' : ''} (${p.id}) — ${p.country} — ${p.status}`);
    if (p.notes) out.push(`Notes : ${p.notes}`);
    for (const a of acts) out.push(`- ${a.at.slice(0, 10)} [${a.kind}] ${a.text}`);
    out.push('');
  }
  return out.join('\n');
}
