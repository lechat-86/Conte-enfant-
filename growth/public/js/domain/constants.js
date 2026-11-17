// Vocabulaire métier de READYFILE GROWTH (codes stables ; libellés dans i18n).
export const STATUSES = ['to_research', 'to_contact', 'contacted', 'replied', 'interview_planned', 'demo_planned', 'interest_confirmed', 'offer_presented', 'paying', 'refused', 'to_recontact'];
export const CLOSED_STATUSES = ['paying', 'refused'];            // pas de relance attendue
export const REPLIED_OR_BEYOND = ['replied', 'interview_planned', 'demo_planned', 'interest_confirmed', 'offer_presented', 'paying'];
export const INTENT_STATUSES = ['interest_confirmed', 'offer_presented', 'paying'];
export const ACTIVE_STATUSES = ['contacted', 'replied', 'interview_planned', 'demo_planned', 'interest_confirmed', 'offer_presented', 'to_recontact'];

// Activités : message_sent / reply / demo_done alimentent les compteurs du tableau de bord.
export const ACTIVITY_KINDS = ['note', 'message_sent', 'reply', 'call', 'meeting', 'demo_done', 'status'];
export const USER_ACTIVITY_KINDS = ['note', 'message_sent', 'reply', 'call', 'meeting', 'demo_done'];

export const FR_COUNTRY = 'FR';
export const EN_COUNTRIES = ['GB', 'IE', 'US', 'CA', 'AU', 'NZ', 'SG', 'ZA'];
export const OTHER_COUNTRIES = ['BE', 'CH', 'LU', 'DE', 'ES', 'IT', 'NL', 'PT'];
export const COUNTRIES = [FR_COUNTRY, ...EN_COUNTRIES, ...OTHER_COUNTRIES];
/** Segment commercial : « fr » = cabinets français (pays FR), « en » = cabinets anglophones, sinon « other ». */
export const segmentOf = (country) => (country === FR_COUNTRY ? 'fr' : EN_COUNTRIES.includes(country) ? 'en' : 'other');

export const PROBLEM_TAGS = ['missing_documents', 'unreadable_docs', 'wrong_period', 'duplicates', 'chasing_time', 'client_adoption', 'multi_channel', 'no_tracking', 'other'];
export const FEATURE_TAGS = ['checklist', 'portal', 'auto_checks', 'reminders', 'accounting_integration', 'mobile_upload', 'multilingual', 'audit_log', 'security_hosting', 'other'];
export const METHOD_TAGS = ['email', 'phone', 'portal', 'whatsapp', 'paper', 'other'];
export const REFUSAL_TAGS = ['not_priority', 'already_equipped', 'too_expensive', 'ai_trust', 'security_gdpr', 'client_adoption', 'no_time', 'other'];
export const INTEREST_TAGS = ['saves_time', 'fewer_errors', 'better_tracking', 'client_experience', 'bilingual', 'other'];

export const FREQUENCIES = ['unknown', 'never', 'rarely', 'sometimes', 'often', 'almost_always'];
export const REACTIONS = ['unknown', 'negative', 'neutral', 'positive', 'very_positive'];       // intérêt VERBAL
export const WILLINGNESS = ['unknown', 'no', 'maybe', 'yes_nonsensitive', 'yes_pilot'];          // volonté de tester
export const COMMITMENT_LEVELS = [0, 1, 2, 3, 4, 5];                                             // échelle de VALIDATION_SCORECARD.md

/** Sous ce nombre d'entretiens : comptages bruts uniquement, aucune moyenne ni pourcentage (cf. G1 du scorecard). */
export const MIN_SAMPLE = 10;

export const DEFAULT_GOALS = { studied: 15, fr: 10, en: 5, demos: 5, seriousIntents: 3, paying: 1 };
export const SCHEMA_VERSION = 1;
