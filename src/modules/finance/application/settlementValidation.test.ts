import { describe, expect, it } from 'vitest';
import { normalizeFinancialSettlement } from './settlementValidation';

const base = {
  tenantId: 'tenant-a',
  companyId: 'company-a',
  installmentId: 'installment-a',
  accountId: 'account-a',
  settledOn: '2026-09-10',
  amount: 40,
  idempotencyKey: ' settlement-1 ',
};

describe('normalizeFinancialSettlement', () => {
  it('normalizes identifiers, idempotency key and optional notes', () => {
    const result = normalizeFinancialSettlement({ ...base, notes: '  parcial  ' });
    expect(result.idempotencyKey).toBe('settlement-1');
    expect(result.notes).toBe('parcial');
  });

  it('rejects non-positive and non-finite amounts', () => {
    expect(() => normalizeFinancialSettlement({ ...base, amount: 0 })).toThrow('amount must be greater than zero');
    expect(() => normalizeFinancialSettlement({ ...base, amount: Number.NaN })).toThrow('amount must be greater than zero');
  });

  it('rejects invalid dates', () => {
    expect(() => normalizeFinancialSettlement({ ...base, settledOn: '10/09/2026' })).toThrow('settledOn must be an ISO date');
  });

  it('requires an idempotency key', () => {
    expect(() => normalizeFinancialSettlement({ ...base, idempotencyKey: ' ' })).toThrow('idempotencyKey is required');
  });

  it('rejects idempotency keys longer than 200 characters', () => {
    expect(() => normalizeFinancialSettlement({ ...base, idempotencyKey: 'x'.repeat(201) })).toThrow('idempotencyKey must not exceed 200 characters');
  });
});
