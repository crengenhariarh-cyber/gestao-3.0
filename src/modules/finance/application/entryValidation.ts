import type { CreateSingleFinancialEntry } from '../domain/entries';

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function normalizeOptional(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function assertIsoDate(value: string, field: string): string {
  const normalized = required(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new Error(`${field} must be an ISO date`);
  }
  return normalized;
}

export function normalizeSingleFinancialEntry(
  input: CreateSingleFinancialEntry,
): CreateSingleFinancialEntry {
  const amount = input.amount;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be greater than zero');

  const competenceMonth = assertIsoDate(input.competenceMonth, 'competenceMonth');
  if (!competenceMonth.endsWith('-01')) throw new Error('competenceMonth must be the first day of the month');

  return {
    ...input,
    tenantId: required(input.tenantId, 'tenantId'),
    companyId: required(input.companyId, 'companyId'),
    description: required(input.description, 'description'),
    counterpartyName: normalizeOptional(input.counterpartyName),
    categoryId: required(input.categoryId, 'categoryId'),
    costCenterId: normalizeOptional(input.costCenterId),
    competenceMonth,
    dueDate: assertIsoDate(input.dueDate, 'dueDate'),
    amount,
    notes: normalizeOptional(input.notes),
  };
}
