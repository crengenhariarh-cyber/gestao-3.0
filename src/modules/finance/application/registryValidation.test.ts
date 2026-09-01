import { describe, expect, it } from 'vitest';
import { normalizeAccount, normalizeCategory, normalizeCostCenter } from './registryValidation';

describe('finance registry validation', () => {
  it('normalizes category name to uppercase without changing company scope', () => {
    expect(normalizeCategory({ tenantId: 'tenant-a', companyId: 'company-a', name: '  Combustível ', kind: 'expense' })).toEqual({
      tenantId: 'tenant-a', companyId: 'company-a', name: 'COMBUSTÍVEL', kind: 'expense',
    });
  });

  it('rejects an empty company scope', () => {
    expect(() => normalizeCategory({ tenantId: 'tenant-a', companyId: ' ', name: 'Receita', kind: 'income' })).toThrow('companyId is required');
  });

  it('normalizes cost center name to uppercase and empty code to null', () => {
    expect(normalizeCostCenter({ tenantId: 'tenant-a', companyId: 'company-a', name: ' Obra A ', code: ' ' })).toEqual({
      tenantId: 'tenant-a', companyId: 'company-a', name: 'OBRA A', code: null,
    });
  });

  it('defaults account opening balance to zero', () => {
    expect(normalizeAccount({ tenantId: 'tenant-a', companyId: 'company-a', name: ' Caixa ', accountType: 'cash' })).toEqual({
      tenantId: 'tenant-a', companyId: 'company-a', name: 'Caixa', accountType: 'cash', openingBalance: 0,
    });
  });

  it('rejects non-finite opening balance', () => {
    expect(() => normalizeAccount({ tenantId: 'tenant-a', companyId: 'company-a', name: 'Banco', accountType: 'bank', openingBalance: Number.NaN })).toThrow('openingBalance must be finite');
  });
});
