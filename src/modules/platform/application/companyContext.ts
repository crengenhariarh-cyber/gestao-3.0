import type { AccessContext, CompanySummary } from '../domain/AccessContext';

export const ALL_COMPANIES_ID = '__all_companies__';

export function flattenAuthorizedCompanies(
  contexts: readonly AccessContext[],
): readonly CompanySummary[] {
  return contexts.flatMap((context) => context.companies);
}

export function isCompanyAuthorized(
  companies: readonly CompanySummary[],
  companyId: string | null,
): boolean {
  return companyId !== null && companies.some((company) => company.id === companyId);
}

export function isAllCompanies(companyId: string | null): boolean {
  return companyId === ALL_COMPANIES_ID;
}

export function resolveActiveCompanyId(
  companies: readonly CompanySummary[],
  currentCompanyId: string | null,
): string | null {
  if (isAllCompanies(currentCompanyId) && companies.length > 1) return ALL_COMPANIES_ID;
  if (isCompanyAuthorized(companies, currentCompanyId)) return currentCompanyId;
  return companies.length > 1 ? ALL_COMPANIES_ID : companies[0]?.id ?? null;
}
