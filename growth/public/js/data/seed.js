// Données de DÉMONSTRATION — 100 % fictives (cabinets, personnes et adresses inventés ; domaine réservé « .example »).
// Chaque enregistrement porte demo:true : « Démarrer avec mes données » les supprime sans toucher aux saisies réelles.
import { addDays, ymd } from '../domain/dates.js';
import { DEFAULT_GOALS, SCHEMA_VERSION } from '../domain/constants.js';

const SRC = 'https://annuaire.example/cabinets';

// [firm, country, city, contact, role, status, firstContactDaysAgo|null, nextAction, nextActionOffset|null, problems, budget]
const P = [
  ['Cabinet Exemple Alpha', 'FR', 'Lyon', 'Alice Martin', 'Experte-comptable associée', 'demo_planned', 12, 'Préparer la démo de 5 min', 1, ['missing_documents', 'chasing_time'], 60],
  ['Cabinet Exemple Beta', 'FR', 'Nantes', 'Bruno Durand', 'Responsable de production', 'interview_planned', 9, 'Entretien téléphonique', 0, ['multi_channel', 'client_adoption'], null],
  ['Cabinet Exemple Gamma', 'FR', 'Lille', 'Chloé Petit', 'Collaboratrice comptable', 'replied', 6, 'Répondre et proposer un créneau', -1, ['wrong_period', 'duplicates'], null],
  ['Cabinet Exemple Delta', 'FR', 'Bordeaux', 'David Roux', 'Expert-comptable', 'contacted', 14, 'Relance courte', -3, [], null],
  ['Cabinet Exemple Epsilon', 'FR', 'Toulouse', 'Emma Blanc', 'Associée', 'to_contact', null, 'Envoyer le premier message', 0, [], null],
  ['Fictional Accountants Ltd', 'GB', 'Leeds', 'Frank Hughes', 'Practice manager', 'interest_confirmed', 20, 'Proposer un pilote sur cas non sensible', 2, ['chasing_time', 'unreadable_docs'], 99],
  ['Demo Ledger & Co', 'IE', 'Cork', 'Grace Kelly', 'Partner', 'refused', 18, null, null, ['no_tracking'], null],
  ['Sample Books LLP', 'CA', 'Ottawa', 'Henry Wong', 'Operations lead', 'to_research', null, 'Trouver un contact', null, [], null],
];
// [prospect index, jours passés, kind, texte]
const A = [
  [0, 12, 'message_sent', 'Premier message envoyé manuellement (modèle « premier contact »).'], [0, 10, 'reply', 'Réponse positive : intéressée par un échange court.'], [0, 7, 'call', 'Appel de 10 min : relances manuelles par email, beaucoup de pièces au mauvais mois.'], [0, 3, 'demo_done', 'Démo de 5 min réalisée (maquette, analyse simulée annoncée).'],
  [1, 9, 'message_sent', 'Message envoyé manuellement.'], [1, 5, 'reply', 'Répond que les clients envoient tout par WhatsApp.'],
  [2, 6, 'message_sent', 'Message envoyé manuellement.'], [2, 1, 'reply', 'Réponse reçue : demande plus de détails.'],
  [3, 14, 'message_sent', 'Message envoyé manuellement, sans réponse pour l’instant.'],
  [5, 20, 'message_sent', 'Message envoyé manuellement.'], [5, 17, 'reply', 'Replied: open to a chat.'], [5, 10, 'meeting', 'Visio de 30 min.'], [5, 8, 'demo_done', 'Demo done (mock-up).'],
  [6, 18, 'message_sent', 'Message envoyé manuellement.'], [6, 15, 'reply', 'Not a priority for now, asks to be contacted in 6 months.'],
];
// Entretiens fictifs
const I = [
  { p: 0, d: 7, clients: 140, methods: ['email', 'phone'], software: ['Logiciel Compta X', 'Tableur'], hours: 6, freq: 'often', diff: ['missing_documents', 'wrong_period'], solutions: 'Relances par email et tableur de suivi.', features: ['checklist', 'auto_checks', 'reminders'], budget: 60, reaction: 'positive', willing: 'yes_nonsensitive', priceExplicit: false, price: null, level: 2, competitors: ['Suite Comptable X'], refusal: [], interest: ['saves_time', 'better_tracking'], next: 'Revoir une version plus avancée.' },
  { p: 5, d: 8, clients: 60, methods: ['email'], software: ['Cloud Accounts Y'], hours: 4, freq: 'sometimes', diff: ['chasing_time', 'unreadable_docs'], solutions: 'Portail du logiciel, peu utilisé.', features: ['portal', 'mobile_upload'], budget: 99, reaction: 'very_positive', willing: 'yes_pilot', priceExplicit: true, price: 99, level: 4, competitors: ['Cloud Accounts Y'], refusal: [], interest: ['fewer_errors', 'client_experience'], next: 'Envoyer une lettre d’intention de pilote.' },
  { p: 6, d: 15, clients: 35, methods: ['email'], software: ['Cloud Accounts Y'], hours: 1, freq: 'rarely', diff: ['no_tracking'], solutions: '', features: [], budget: null, reaction: 'neutral', willing: 'no', priceExplicit: false, price: null, level: 0, competitors: [], refusal: ['not_priority', 'already_equipped'], interest: [], next: 'Recontacter dans 6 mois.' },
];

export function buildSeed(now = new Date()) {
  const today = ymd(now);
  const ago = (n) => addDays(today, -n);
  const prospects = P.map(([firm, country, city, contactName, contactRole, status, fc, nextAction, off, problems, budget], i) => ({
    id: `P-${String(i + 1).padStart(3, '0')}`, demo: true, firm, country, city, website: `https://${firm.toLowerCase().replace(/[^a-z]+/g, '-')}.example`,
    contactName, contactRole, contactEmail: '', emailLegit: false, sourceUrl: `${SRC}/${i + 1}`, addedAt: ago(fc != null ? fc + 4 : 3 + i),
    firstContactAt: fc != null ? ago(fc) : '', status, notes: i === 0 ? 'Contact chaleureux ; cabinet de taille moyenne (données fictives).' : '',
    nextAction: nextAction || '', nextActionDate: off != null ? addDays(today, off) : '', budgetMonthly: budget, problems, problemsText: '',
  }));
  const activities = A.map(([pi, days, kind, text], i) => ({ id: `A-${String(i + 1).padStart(4, '0')}`, prospectId: prospects[pi].id, demo: true, at: `${ago(days)}T10:00:00.000Z`, kind, text }));
  const interviews = I.map((x, i) => ({
    id: `I-${String(i + 1).padStart(3, '0')}`, demo: true, prospectId: prospects[x.p].id, date: ago(x.d), clientsManaged: x.clients, collectionMethods: x.methods, software: x.software,
    hoursPerWeek: x.hours, incompleteFrequency: x.freq, difficulties: x.diff, difficultiesText: '', solutionsUsed: x.solutions, featuresWanted: x.features, budgetEnvisaged: x.budget,
    demoReaction: x.reaction, demoReactionText: '', testWillingness: x.willing, priceAcceptedExplicit: x.priceExplicit, priceAcceptedAmount: x.price, commitmentLevel: x.level,
    competitorsCited: x.competitors, refusalReasons: x.refusal, interestReasons: x.interest, nextStep: x.next, notes: '',
  }));
  return { version: SCHEMA_VERSION, meta: { createdAt: now.toISOString() }, settings: { senderName: '', lang: 'fr' }, goals: { ...DEFAULT_GOALS }, prospects, activities, interviews };
}
