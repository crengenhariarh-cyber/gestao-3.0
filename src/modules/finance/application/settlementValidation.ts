import type { RecordFinancialSettlement } from '../domain/settlements';

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

export function normalizeFinancialSettlement(
  input: RecordFinancialSettlement,
): RecordFinancialSettlement & { notes: string | null } {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('amount must be greater than zero');
  }

  const idempotencyKey = required(input.idempotencyKey, 'idempotencyKey');
  if (idempotencyKey.length > 200) throw new Error('idempotencyKey must not exceed 200 characters');

  return {
    tenantId: required(input.tenantId, 'tenantId'),
    companyId: required(input.companyId, 'companyId'),
    installmentId: required(input.installmentId, 'installmentId'),
    accountId: required(input.accountId, 'accountId'),
    settledOn: isoDate(input.settledOn, 'settledOn'),
    amount: input.amount,
    idempotencyKey,
    notes: optional(input.notes),
  };
}
