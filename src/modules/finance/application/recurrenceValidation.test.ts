import { describe, expect, it } from 'vitest';
import { normalizeRecurrenceRule } from './recurrenceValidation';

const base = {
  tenantId: 'tenant-a',
  companyId: 'company-a',
  entryType: 'expense' as const,
  description: '  Aluguel  ',
  categoryId: 'category-a',
  amount: 1500,
  startDate: '2027-01-31',
};

describe('normalizeRecurrenceRule', () => {
  it('defaults to monthly recurrence every month', () => {
    const result = normalizeRecurrenceRule(base);
    expect(result.frequency).toBe('monthly');
    expect(result.intervalCount).toBe(1);
    expect(result.description).toBe('Aluguel');
  });

  it('normalizes optional strings to null', () => {
    const result = normalizeRecurrenceRule({
      ...base,
      counterpartyName: ' ',
      costCenterId: '',
      notes: ' ',
    });
    expect(result.counterpartyName).toBeNull();
    expect(result.costCenterId).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('rejects non-positive amounts', () => {
    expect(() => normalizeRecurrenceRule({ ...base, amount: 0 })).toThrow('amount must be greater than zero');
  });

  it('rejects invalid interval counts', () => {
    expect(() => normalizeRecurrenceRule({ ...base, intervalCount: 0 })).toThrow('intervalCount must be a positive integer');
  });

  it('rejects end date before start date', () => {
    expect(() => normalizeRecurrenceRule({ ...base, endDate: '2026-12-31' })).toThrow('endDate cannot be before startDate');
  });
});
