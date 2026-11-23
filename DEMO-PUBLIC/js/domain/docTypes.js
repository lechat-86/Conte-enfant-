// Catalogue des types de documents (données métier, sans texte d'interface :
// les libellés sont dans i18n sous la clé « doc.<type> »).
export const DOC_TYPES = {
  bank_statement: { pages: 4, granularity: 'month', stem: 'releve_banque', icon: 'bank' },
  sales_invoices: { pages: 6, granularity: 'month', stem: 'factures_ventes', icon: 'file' },
  purchase_invoices: { pages: 8, granularity: 'month', stem: 'factures_achats', icon: 'file' },
  payslips: { pages: 3, granularity: 'month', stem: 'bulletins_paie', icon: 'file' },
  vat_return: { pages: 3, granularity: 'month', stem: 'declaration_tva', icon: 'file' },
  tax_return: { pages: 5, granularity: 'year', stem: 'liasse_fiscale', icon: 'file' },
  loan_schedule: { pages: 4, granularity: 'year', stem: 'tableau_emprunt', icon: 'file' },
  insurance_certificate: { pages: 2, granularity: null, stem: 'attestation_assurance', icon: 'shield' },
  id_document: { pages: 2, granularity: null, stem: 'piece_identite', icon: 'id' },
  company_registration: { pages: 2, granularity: null, stem: 'extrait_kbis', icon: 'file' },
};

export const DOC_TYPE_IDS = Object.keys(DOC_TYPES);

export const TEMPLATES = {
  monthly_bookkeeping: ['bank_statement', 'sales_invoices', 'purchase_invoices', 'payslips'],
  vat_quarter: ['vat_return', 'sales_invoices', 'purchase_invoices', 'bank_statement'],
  annual_closing: ['bank_statement', 'tax_return', 'loan_schedule', 'insurance_certificate', 'purchase_invoices'],
  onboarding: ['id_document', 'company_registration', 'insurance_certificate', 'bank_statement'],
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES);
