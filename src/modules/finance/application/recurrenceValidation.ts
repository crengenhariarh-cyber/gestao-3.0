import type { CreateFinancialRecurrenceRule } from '../domain/recurrence';

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function optional(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isoDate(value: string, field: string): string {
  const normalized = required(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new Error(`${field} must be an ISO date`);
  }
  return normalized;
}

export function normalizeRecurrenceRule(
  input: CreateFinancialRecurrenceRule,
): Required<Omit<CreateFinancialRecurrenceRule, 'counterpartyName' | 'costCenterId' | 'endDate' | 'notes'>> & {
  counterpartyName: string | null;
  costCenterId: string | null;
  endDate: string | null;
  notes: string | null;
} {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('amount must be greater than zero');

  const intervalCount = input.intervalCount ?? 1;
  if (!Number.isInteger(intervalCount) || intervalCount < 1) {
    throw new Error('intervalCount must be a positive integer');
  }

  const startDate = isoDate(input.startDate, 'startDate');
  const endDate = input.endDate ? isoDate(input.endDate, 'endDate') : null;
  if (endDate && endDate < startDate) throw new Error('endDate cannot be before startDate');

  return {
    tenantId: required(input.tenantId, 'tenantId'),
    companyId: required(input.companyId, 'companyId'),
    entryType: input.entryType,
    description: required(input.description, 'description'),
    counterpartyName: optional(input.counterpartyName),
    categoryId: required(input.categoryId, 'categoryId'),
    costCenterId: optional(input.costCenterId),
    amount: input.amount,
    frequency: input.frequency ?? 'monthly',
    intervalCount,
    startDate,
    endDate,
    notes: optional(input.notes),
  };
}
