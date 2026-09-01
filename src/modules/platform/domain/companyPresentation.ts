import type { CompanySummary } from './AccessContext';

export const COMPANY_ORDER = ['Admin', 'Blaze', 'CR', 'Pessoal', 'PR', 'Sartori'] as const;
export type CanonicalCompanyLabel = (typeof COMPANY_ORDER)[number];

export function companyLabel(company: CompanySummary): string {
  const raw = `${company.tradeName ?? ''} ${company.legalName}`.toLocaleUpperCase('pt-BR');
  if (raw.includes('SARTORI')) return 'Sartori';
  if (raw.includes('BLAZE')) return 'Blaze';
  if (raw.includes('PESSOAL')) return 'Pessoal';
  if (raw.includes('ADMIN')) return 'Admin';
  if (raw.includes('PR-HIST') || /(^|\s)PR(\s|$)/.test(raw)) return 'PR';
  if (raw.includes('CR-HIST') || /(^|\s)CR(\s|$)/.test(raw)) return 'CR';
  return company.tradeName ?? company.legalName;
}

export function visibleCompanies(companies: readonly CompanySummary[]): readonly CompanySummary[] {
  const chosen = new Map<string, CompanySummary>();
  for (const company of companies) {
    const label = companyLabel(company);
    if (!COMPANY_ORDER.includes(label as CanonicalCompanyLabel)) continue;
    const current = chosen.get(label);
    const currentHistoric = current ? /HIST/i.test(`${current.tradeName ?? ''} ${current.legalName}`) : true;
    const candidateHistoric = /HIST/i.test(`${company.tradeName ?? ''} ${company.legalName}`);
    if (!current || (currentHistoric && !candidateHistoric)) chosen.set(label, company);
  }
  return COMPANY_ORDER.flatMap((label) => chosen.get(label) ? [chosen.get(label)!] : []);
}
