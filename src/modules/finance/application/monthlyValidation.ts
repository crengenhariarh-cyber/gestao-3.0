import type { FinanceMonthlyFilters } from '../domain/monthly';

const MONTH_PATTERN = /^\d{4}-\d{2}-01$/;

export function normalizeFinanceMonthlyFilters(raw: FinanceMonthlyFilters): FinanceMonthlyFilters {
  const tenantId = raw.tenantId.trim();
  const companyId = raw.companyId.trim();
  const competenceFrom = raw.competenceFrom.trim();
  const competenceTo = raw.competenceTo.trim();
  const categoryId = raw.categoryId?.trim();
  const costCenterId = raw.costCenterId?.trim();
  const counterparty = raw.counterparty?.trim();

  if (!tenantId) throw new Error('tenantId is required');
  if (!companyId) throw new Error('companyId is required');
  if (!MONTH_PATTERN.test(competenceFrom)) throw new Error('competenceFrom must be the first day of a month');
  if (!MONTH_PATTERN.test(competenceTo)) throw new Error('competenceTo must be the first day of a month');
  if (competenceFrom > competenceTo) throw new Error('competenceFrom must be before or equal to competenceTo');

  return {
    tenantId,
    companyId,
    competenceFrom,
    competenceTo,
    ...(categoryId ? { categoryId } : {}),
    ...(costCenterId ? { costCenterId } : {}),
    ...(counterparty ? { counterparty } : {}),
    ...(raw.entryType ? { entryType: raw.entryType } : {}),
    ...(raw.paymentStatus ? { paymentStatus: raw.paymentStatus } : {}),
    ...(raw.sourceKind ? { sourceKind: raw.sourceKind } : {}),
  };
}
