// Jeu de données de DÉMONSTRATION — 100 % fictif.
// Sociétés, personnes et adresses inventées (domaine réservé « .example »).
// Les dates sont relatives à `now` pour que la démo reste « vivante ».
import { DOC_TYPES, TEMPLATES } from '../domain/docTypes.js';
import { shiftMonths, monthOf } from '../domain/period.js';
import { createDossier } from '../domain/dossier.js';
import { simulateAnalysis } from '../engine/simulated.js';

export const SEED_VERSION = 1;
const DAY = 86400000;

const CLIENTS = [
  ['CLI-001', 'Boulangerie Pain & Co', 'Camille Moreau', 'camille@pain-co.example', 'FR', 'fr'],
  ['CLI-002', 'Studio Lumen SAS', 'Hugo Lefèvre', 'hugo@studio-lumen.example', 'FR', 'fr'],
  ['CLI-003', 'Nordic Craft Ltd', 'Emma Hughes', 'emma@nordic-craft.example', 'GB', 'en'],
  ['CLI-004', 'Atelier Verdier SARL', 'Nadia Benali', 'nadia@atelier-verdier.example', 'FR', 'fr'],
  ['CLI-005', 'Bruges Logistics BV', 'Pieter De Smet', 'pieter@bruges-logistics.example', 'BE', 'en'],
  ['CLI-006', 'Cabinet Dr Roche', 'Louise Roche', 'louise@cabinet-roche.example', 'CH', 'fr'],
  ['CLI-007', 'Berlin Tech GmbH', 'Jonas Weber', 'jonas@berlin-tech.example', 'DE', 'en'],
  ['CLI-008', 'Olivar Foods SL', 'Lucía Ortega', 'lucia@olivar-foods.example', 'ES', 'en'],
];

// [id, client, modèle, décalage de mois de la période, créé il y a N jours, états des pièces dans l'ordre du modèle]
// états : ok | missing | unreadable | wrong_type | duplicate | wrong_period | incomplete | analyzing:<scénario>
const PLAN = [
  ['DOS-001', 'CLI-001', 'monthly_bookkeeping', -1, 12, ['ok', 'ok', 'ok', 'ok']],
  ['DOS-002', 'CLI-002', 'monthly_bookkeeping', -1, 9, ['ok', 'ok', 'missing', 'missing']],
  ['DOS-003', 'CLI-003', 'vat_quarter', -1, 11, ['ok', 'ok', 'unreadable', 'ok']],
  ['DOS-004', 'CLI-004', 'annual_closing', -2, 26, ['ok', 'wrong_period', 'missing', 'ok', 'duplicate']],
  ['DOS-005', 'CLI-005', 'onboarding', -1, 20, ['ok', 'ok', 'ok', 'ok']],
  ['DOS-006', 'CLI-006', 'monthly_bookkeeping', -1, 8, ['analyzing:ok', 'ok', 'ok', 'missing']],
  ['DOS-007', 'CLI-007', 'vat_quarter', -1, 15, ['ok', 'incomplete', 'missing', 'wrong_type']],
  ['DOS-008', 'CLI-008', 'onboarding', -1, 31, ['ok', 'missing', 'missing', 'missing']],
  ['DOS-009', 'CLI-001', 'vat_quarter', -2, 40, ['ok', 'ok', 'ok', 'ok']],
  ['DOS-010', 'CLI-003', 'monthly_bookkeeping', -2, 38, ['ok', 'ok', 'ok', 'ok']],
  ['DOS-011', 'CLI-002', 'onboarding', -1, 6, ['ok', 'analyzing:incomplete', 'missing', 'ok']],
  ['DOS-012', 'CLI-005', 'monthly_bookkeeping', -1, 22, ['ok', 'missing', 'missing', 'missing']],
];

const SUFFIX = { unreadable: '_flou', wrong_type: '_autre', duplicate: '_copie', wrong_period: '_ancienne', incomplete: '_partiel' };

export function buildSeed(now = new Date()) {
  const ago = (days) => new Date(now.getTime() - days * DAY);
  const events = [];
  const ev = (at, type, p) => events.push({ at: at.toISOString(), type, ...p });

  const clients = CLIENTS.map(([id, company, contact, email, country, language], i) => {
    const createdAt = ago(150 - i * 11);
    ev(createdAt, 'client_created', { clientId: id, params: { company } });
    return { id, company, contact, email, country, language, createdAt: createdAt.toISOString() };
  });

  const thisMonth = monthOf(now);
  const dossiers = PLAN.map(([id, clientId, template, offset, createdDaysAgo, states]) => {
    const period = shiftMonths(thisMonth, offset);
    const created = ago(createdDaysAgo);
    const dossier = createDossier({ id, clientId, template, period, now: created });
    ev(created, 'dossier_created', { clientId, dossierId: id, params: { template, period } });
    const known = [];
    dossier.slots.forEach((slot, i) => {
      const state = states[i];
      if (state === 'missing') return;
      const [kind, pending] = state.split(':');
      const scenario = kind === 'analyzing' ? pending : kind;
      const stamp = (DOC_TYPES[slot.type].granularity === 'year' ? period.slice(0, 4) : period);
      const fileName = `${DOC_TYPES[slot.type].stem}_${stamp}${SUFFIX[scenario] || ''}.pdf`;
      const receivedAt = new Date(Math.max(created.getTime() + 3600000, created.getTime() + (1 + i * 2) * DAY));
      const base = {
        id: `DOC-${id.slice(4)}${i + 1}`,
        fileName,
        sizeKB: 180 + ((id.charCodeAt(5) * 37 + i * 91) % 1700),
        receivedAt: receivedAt.toISOString(),
        via: i % 3 === 0 ? 'email' : 'portal',
        attempts: 1,
      };
      ev(receivedAt, 'document_received', { clientId, dossierId: id, params: { docType: slot.type, fileName } });
      if (kind === 'analyzing') {
        slot.doc = { ...base, status: 'analyzing', pendingScenario: scenario };
        return;
      }
      const analysis = simulateAnalysis({ fileName, expected: { type: slot.type, period }, scenario }, known, new Date(receivedAt.getTime() + 120000));
      slot.doc = { ...base, status: analysis.verdict === 'valid' ? 'valid' : 'invalid', analysis };
      known.push({ documentId: base.id, fileName, fingerprint: analysis.extraction.fingerprint });
      ev(new Date(receivedAt.getTime() + 120000), 'analysis_done', { clientId, dossierId: id, params: { docType: slot.type, verdict: analysis.verdict, issue: analysis.issue } });
    });
    return dossier;
  });

  events.sort((a, b) => a.at.localeCompare(b.at));
  events.forEach((e, i) => (e.id = `EV-${String(i + 1).padStart(4, '0')}`));

  return {
    version: SEED_VERSION,
    clients,
    dossiers,
    events,
    settings: { firmName: 'Cabinet Lambert & Associés (démo)', retentionDays: 1095, analysisDelayMs: 1200 },
  };
}

export { TEMPLATES };
