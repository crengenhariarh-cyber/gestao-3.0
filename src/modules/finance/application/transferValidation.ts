import type { CreateFinancialTransfer } from '../domain/accounts';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeFinancialTransfer(
  raw: CreateFinancialTransfer,
): CreateFinancialTransfer {
  const tenantId = raw.tenantId.trim();
  const companyId = raw.companyId.trim();
  const fromAccountId = raw.fromAccountId.trim();
  const toAccountId = raw.toAccountId.trim();
  const idempotencyKey = raw.idempotencyKey.trim();
  const notes = raw.notes?.trim() || null;

  if (!tenantId) throw new Error('tenantId is required');
  if (!companyId) throw new Error('companyId is required');
  if (!fromAccountId) throw new Error('fromAccountId is required');
  if (!toAccountId) throw new Error('toAccountId is required');
  if (fromAccountId === toAccountId) throw new Error('transfer accounts must be different');
  if (!DATE_PATTERN.test(raw.transferOn)) throw new Error('transferOn must use YYYY-MM-DD');
  if (!Number.isFinite(raw.amount) || raw.amount <= 0) throw new Error('amount must be greater than zero');
  if (!idempotencyKey) throw new Error('idempotencyKey is required');

  return {
    tenantId,
    companyId,
    fromAccountId,
    toAccountId,
    transferOn: raw.transferOn,
    amount: raw.amount,
    idempotencyKey,
    notes,
  };
}
