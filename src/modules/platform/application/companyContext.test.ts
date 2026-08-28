import { describe, expect, it } from 'vitest';
import type { AccessContext, CompanySummary } from '../domain/AccessContext';
import {
  flattenAuthorizedCompanies,
  isCompanyAuthorized,
  resolveActiveCompanyId,
} from './companyContext';

const companyA: CompanySummary = {
  id: 'company-a',
  tenantId: 'tenant-a',
  legalName: 'Empresa A',
  tradeName: null,
};

const companyB: CompanySummary = {
  id: 'company-b',
  tenantId: 'tenant-a',
  legalName: 'Empresa B',
  tradeName: 'B',
};

const contexts: readonly AccessContext[] = [
  {
    tenant: { tenantId: 'tenant-a', role: 'operator' },
    companies: [companyA, companyB],
  },
];

describe('company context rules', () => {
  it('flattens only companies present in authorized contexts', () => {
    expect(flattenAuthorizedCompanies(contexts)).toEqual([companyA, companyB]);
  });

  it('keeps the active company when it is still authorized', () => {
    expect(resolveActiveCompanyId([companyA, companyB], 'company-b')).toBe('company-b');
  });

  it('falls back to the first authorized company when current access disappears', () => {
    expect(resolveActiveCompanyId([companyA, companyB], 'forbidden-company')).toBe('company-a');
  });

  it('returns null when there is no authorized company', () => {
    expect(resolveActiveCompanyId([], 'company-a')).toBeNull();
  });

  it('rejects a company that is outside the authorized context', () => {
    expect(isCompanyAuthorized([companyA, companyB], 'forbidden-company')).toBe(false);
  });

  it('accepts an explicitly authorized company', () => {
    expect(isCompanyAuthorized([companyA, companyB], 'company-a')).toBe(true);
  });
});
