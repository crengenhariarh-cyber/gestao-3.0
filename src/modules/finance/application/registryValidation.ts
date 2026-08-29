import type {
  CreateCostCenter,
  CreateFinancialAccount,
  CreateFinancialCategory,
} from '../domain/registries';

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

export function normalizeCategory(input: CreateFinancialCategory): CreateFinancialCategory {
  return {
    ...input,
    tenantId: required(input.tenantId, 'tenantId'),
    companyId: required(input.companyId, 'companyId'),
    name: required(input.name, 'name'),
  };
}

export function normalizeCostCenter(input: CreateCostCenter): CreateCostCenter {
  return {
    ...input,
    tenantId: required(input.tenantId, 'tenantId'),
    companyId: required(input.companyId, 'companyId'),
    name: required(input.name, 'name'),
    code: input.code?.trim() || null,
  };
}

export function normalizeAccount(input: CreateFinancialAccount): CreateFinancialAccount {
  const openingBalance = input.openingBalance ?? 0;
  if (!Number.isFinite(openingBalance)) throw new Error('openingBalance must be finite');

  return {
    ...input,
    tenantId: required(input.tenantId, 'tenantId'),
    companyId: required(input.companyId, 'companyId'),
    name: required(input.name, 'name'),
    openingBalance,
  };
}
