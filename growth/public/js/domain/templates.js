// Modèles de messages de prospection (FR/EN). Courts, naturels, honnêtes (maquette, analyse simulée).
// Rien n'est envoyé : l'utilisateur copie le texte et l'envoie LUI-MÊME depuis sa propre messagerie.
// Chaque premier message mentionne la possibilité de ne plus être contacté (prospection B2B : à faire valider juridiquement).
export const TEMPLATE_IDS = ['first_contact', 'interview_request', 'demo_proposal', 'thanks_after_interview', 'follow_up', 'post_demo_feedback'];

export const TEMPLATES = {
  first_contact: {
    fr: { subject: 'Question rapide sur la collecte de pièces chez {firm}', body: `Bonjour {contact},

Je m'appelle {sender}. Je travaille sur un outil qui aide les cabinets comptables à récupérer des pièces complètes auprès de leurs clients : liste des pièces attendues, contrôle à la réception, relance prête à relire.

Je ne vends rien aujourd'hui : je cherche à comprendre comment {firm} gère cette collecte, et si c'est vraiment un sujet pour vous.

Auriez-vous quelques minutes pour m'en parler ?

Si ce n'est pas pertinent, dites-le-moi simplement et je ne vous écrirai plus.

Cordialement,
{sender}` },
    en: { subject: 'Quick question about document collection at {firm}', body: `Hello {contact},

My name is {sender}. I'm working on a tool that helps accounting firms get complete documents from their clients: list of expected documents, checks on receipt, and a follow-up message ready for review.

I'm not selling anything today: I'm trying to understand how {firm} handles this collection, and whether it's really an issue for you.

Would you have a few minutes to tell me about it?

If it isn't relevant, just let me know and I won't write again.

Kind regards,
{sender}` },
  },
  interview_request: {
    fr: { subject: '10 minutes pour échanger sur la collecte de pièces ?', body: `Bonjour {contact},

Merci de votre retour. Pourriez-vous m'accorder 10 minutes (téléphone ou visio) cette semaine ou la suivante ?

Je vous poserai surtout des questions sur votre façon de faire aujourd'hui : comment vous demandez les pièces, ce qui manque le plus souvent, ce qui vous prend du temps. Je ne vous présenterai rien sauf si vous le souhaitez.

Proposez-moi un créneau qui vous arrange, je m'adapte.

Cordialement,
{sender}` },
    en: { subject: '10 minutes to talk about document collection?', body: `Hello {contact},

Thank you for your reply. Could you spare 10 minutes (phone or video) this week or next?

I'll mostly ask how you work today: how you request documents, what is missing most often, what takes your time. I won't show anything unless you'd like me to.

Suggest a slot that suits you and I'll adapt.

Kind regards,
{sender}` },
  },
  demo_proposal: {
    fr: { subject: 'Démonstration courte (5 min) — maquette', body: `Bonjour {contact},

Si cela vous intéresse, je peux vous montrer en 5 minutes une maquette : création d'un dossier, dépôt de pièces par le client, contrôles, message de correction que vous relisez avant tout envoi.

Précision importante : c'est un prototype. L'analyse des documents y est simulée et aucune donnée réelle n'est nécessaire. Je cherche surtout vos retours.

Souhaitez-vous que l'on fixe un moment ?

Cordialement,
{sender}` },
    en: { subject: 'Short demo (5 min) — mock-up', body: `Hello {contact},

If you're interested, I can show you a mock-up in 5 minutes: creating a file, the client uploading documents, checks, and a correction message you review before anything is sent.

Important: this is a prototype. Document analysis is simulated and no real data is needed. I mainly want your feedback.

Would you like to set a time?

Kind regards,
{sender}` },
  },
  thanks_after_interview: {
    fr: { subject: 'Merci pour notre échange', body: `Bonjour {contact},

Merci pour le temps que vous m'avez accordé. Vos retours sur la collecte de pièces chez {firm} m'aident beaucoup.

Je reste à votre disposition si vous souhaitez ajouter quelque chose. Et si je peux vous renvoyer un résumé de ce que j'ai compris, dites-le-moi.

Bien cordialement,
{sender}` },
    en: { subject: 'Thank you for our conversation', body: `Hello {contact},

Thank you for the time you gave me. Your feedback on document collection at {firm} is very helpful.

I'm happy to hear anything else you'd like to add, and I can send you a summary of what I understood if you wish.

Kind regards,
{sender}` },
  },
  follow_up: {
    fr: { subject: 'Re : collecte de pièces chez {firm}', body: `Bonjour {contact},

Je me permets une dernière relance sur mon message précédent. Je comprends que vous soyez très sollicité(e).

Si le sujet n'est pas d'actualité pour {firm}, un simple « non merci » me suffit et je ne vous écrirai plus.

Bien cordialement,
{sender}` },
    en: { subject: 'Re: document collection at {firm}', body: `Hello {contact},

Just one last follow-up on my previous message. I understand you are very busy.

If this isn't a topic for {firm} right now, a simple "no thanks" is enough and I won't write again.

Kind regards,
{sender}` },
  },
  post_demo_feedback: {
    fr: { subject: 'Votre avis sur la démonstration', body: `Bonjour {contact},

Merci d'avoir regardé la maquette. Pourriez-vous me dire, franchement :
- ce qui vous a semblé utile (ou pas) ;
- ce qui manquerait pour que cela serve dans votre cabinet ;
- si, à vos yeux, ce serait un sujet à traiter ou plutôt un confort.

Vos réserves m'intéressent autant que vos points positifs.

Cordialement,
{sender}` },
    en: { subject: 'Your feedback on the demo', body: `Hello {contact},

Thank you for looking at the mock-up. Could you tell me, frankly:
- what seemed useful (or not);
- what would be missing for it to be used in your firm;
- whether you see this as a problem to solve or more of a nice-to-have.

Your reservations interest me as much as the positives.

Kind regards,
{sender}` },
  },
};

const FALLBACK = { fr: { contact: '[Prénom Nom]', firm: '[Cabinet]', sender: '[Votre nom]' }, en: { contact: '[Name]', firm: '[Firm]', sender: '[Your name]' } };

/** Remplit les variables ; celles non renseignées restent visibles entre crochets pour inciter à personnaliser. */
export function renderTemplate(id, lang, vars = {}) {
  const tpl = TEMPLATES[id]?.[lang];
  if (!tpl) throw new Error(`Modèle inconnu : ${id}/${lang}`);
  const v = { ...FALLBACK[lang] };
  for (const [k, val] of Object.entries(vars)) if (val && String(val).trim()) v[k] = String(val).trim();
  const fill = (s) => s.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  const out = { subject: fill(tpl.subject), body: fill(tpl.body) };
  out.unresolved = [...new Set([...(out.subject + out.body).matchAll(/\[[^\]]+\]/g)].map((m) => m[0]))];
  return out;
}
