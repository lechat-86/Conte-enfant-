// Grille tarifaire HYPOTHÉTIQUE (aucun tarif commercialisé, aucun paiement réel).
export const USD_PER_EUR = 1.08; // taux indicatif fixe, non actualisé
export const TARGET_MRR_EUR = 10000;

export const PLANS = [
  { id: 'starter', eur: 49, limits: { users: 1, clients: 25, docs: 200 }, features: ['portal', 'ai_sim', 'bilingual', 'assistant'] },
  { id: 'pro', eur: 99, highlight: true, limits: { users: 5, clients: 150, docs: 1500 }, features: ['portal', 'ai_sim', 'bilingual', 'assistant', 'reminders', 'templates', 'export'] },
  { id: 'business', eur: 199, limits: { users: 15, clients: null, docs: 6000 }, features: ['portal', 'ai_sim', 'bilingual', 'assistant', 'reminders', 'templates', 'export', 'audit', 'retention', 'priority'] },
];

export const toUsd = (eur) => Math.round(eur * USD_PER_EUR);

export function mrr(counts) {
  return PLANS.reduce((sum, p) => sum + p.eur * Math.max(0, Math.floor(Number(counts[p.id]) || 0)), 0);
}

export const customersNeeded = (planId, target = TARGET_MRR_EUR) => Math.ceil(target / PLANS.find((p) => p.id === planId).eur);
