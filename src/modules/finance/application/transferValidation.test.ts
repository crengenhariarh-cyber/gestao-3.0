import { describe, expect, it } from 'vitest';
import { normalizeFinancialTransfer } from './transferValidation';

const base = {
  tenantId: ' tenant ',
  companyId: ' company ',
  fromAccountId: ' from ',
  toAccountId: ' to ',
  transferOn: '2026-09-15',
  amount: 150,
  idempotencyKey: ' transfer-1 ',
  notes: ' teste ',
};

describe('normalizeFinancialTransfer', () => {
  it('normalizes scope, account ids and optional notes', () => {
    expect(normalizeFinancialTransfer(base)).toEqual({
      tenantId: 'tenant', companyId: 'company', fromAccountId: 'from', toAccountId: 'to',
      transferOn: '2026-09-15', amount: 150, idempotencyKey: 'transfer-1', notes: 'teste',
    });
  });

  it('rejects transfer to the same account', () => {
    expect(() => normalizeFinancialTransfer({ ...base, toAccountId: ' from ' })).toThrow(/different/);
  });

  it('rejects non-positive or non-finite amounts', () => {
    expect(() => normalizeFinancialTransfer({ ...base, amount: 0 })).toThrow(/greater than zero/);
    expect(() => normalizeFinancialTransfer({ ...base, amount: Number.NaN })).toThrow(/greater than zero/);
  });

  it('requires a date and idempotency key', () => {
    expect(() => normalizeFinancialTransfer({ ...base, transferOn: '15/09/2026' })).toThrow(/YYYY-MM-DD/);
    expect(() => normalizeFinancialTransfer({ ...base, idempotencyKey: ' ' })).toThrow(/idempotencyKey/);
  });
});
