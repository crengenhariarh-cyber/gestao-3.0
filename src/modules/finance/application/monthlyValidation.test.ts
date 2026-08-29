import { describe, expect, it } from 'vitest';
import { normalizeFinanceMonthlyFilters } from './monthlyValidation';

const base = {
  tenantId: ' tenant ',
  companyId: ' company ',
  competenceFrom: '2026-09-01',
  competenceTo: '2026-12-01',
};

describe('normalizeFinanceMonthlyFilters', () => {
  it('normalizes optional text filters', () => {
    expect(normalizeFinanceMonthlyFilters({ ...base, categoryId: ' cat ', costCenterId: ' obra ', counterparty: ' fornecedor ' }))
      .toMatchObject({ tenantId: 'tenant', companyId: 'company', categoryId: 'cat', costCenterId: 'obra', counterparty: 'fornecedor' });
  });

  it('requires first-day monthly competences', () => {
    expect(() => normalizeFinanceMonthlyFilters({ ...base, competenceFrom: '2026-09-15' })).toThrow(/first day/);
  });

  it('rejects an inverted competence range', () => {
    expect(() => normalizeFinanceMonthlyFilters({ ...base, competenceFrom: '2026-12-01', competenceTo: '2026-09-01' })).toThrow(/before or equal/);
  });
});
