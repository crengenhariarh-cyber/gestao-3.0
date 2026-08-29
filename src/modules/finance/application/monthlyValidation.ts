import type { FinanceMonthlyFilters } from '../domain/monthly';

const MONTH_PATTERN = /^\d{4}-\d{2}-01$/;

export function normalizeFinanceMonthlyFilters(raw: FinanceMonthlyFilters): FinanceMonthlyFilters {
  const tenantId = raw.tenantId.trim();
  const companyId = raw.companyId.trim();
  const competenceFrom = raw.competenceFrom.trim();
  const competenceTo = raw.competenceTo.trim();
  const categoryId = raw.categoryId?.trim() || undefined;
  const costCenterId = raw.costCenterId?.trim() || undefined;
  const counterparty = raw.counterparty?.trim() || undefined;

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
    categoryId,
    costCenterId,
    counterparty,
    entryType: raw.entryType,
    paymentStatus: raw.paymentStatus,
    sourceKind: raw.sourceKind,
  };
}
