import { describe, expect, it } from 'vitest';
import { normalizeSingleFinancialEntry } from './entryValidation';

const base = {
  tenantId: 'tenant-a',
  companyId: 'company-a',
  entryType: 'expense' as const,
  description: ' Combustível ',
  categoryId: 'category-a',
  competenceMonth: '2026-09-01',
  dueDate: '2026-09-10',
  amount: 150,
};

describe('financial entry validation', () => {
  it('normalizes a valid single entry', () => {
    expect(normalizeSingleFinancialEntry(base)).toEqual({
      ...base,
      description: 'Combustível',
      counterpartyName: null,
      costCenterId: null,
      notes: null,
    });
  });

  it('rejects a non-positive amount', () => {
    expect(() => normalizeSingleFinancialEntry({ ...base, amount: 0 })).toThrow('amount must be greater than zero');
  });

  it('requires competence to use the first day of month', () => {
    expect(() => normalizeSingleFinancialEntry({ ...base, competenceMonth: '2026-09-15' })).toThrow('competenceMonth must be the first day of the month');
  });

  it('rejects an empty company context', () => {
    expect(() => normalizeSingleFinancialEntry({ ...base, companyId: ' ' })).toThrow('companyId is required');
  });

  it('normalizes optional text fields', () => {
    expect(normalizeSingleFinancialEntry({ ...base, counterpartyName: ' Posto A ', notes: ' abastecimento ' })).toMatchObject({
      counterpartyName: 'Posto A',
      notes: 'abastecimento',
    });
  });
});
