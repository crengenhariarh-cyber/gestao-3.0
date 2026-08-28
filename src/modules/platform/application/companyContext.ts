import type { AccessContext, CompanySummary } from '../domain/AccessContext';

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

export function resolveActiveCompanyId(
  companies: readonly CompanySummary[],
  currentCompanyId: string | null,
): string | null {
  if (isCompanyAuthorized(companies, currentCompanyId)) {
    return currentCompanyId;
  }

  return companies[0]?.id ?? null;
}
