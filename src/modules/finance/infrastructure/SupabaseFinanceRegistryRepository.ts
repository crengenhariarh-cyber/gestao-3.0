import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinanceRegistryRepository } from '../application/FinanceRegistryRepository';
import { normalizeAccount, normalizeCategory, normalizeCostCenter } from '../application/registryValidation';
import type {
  CompanyScope,
  CostCenter,
  CreateCostCenter,
  CreateFinancialAccount,
  CreateFinancialCategory,
  FinancialAccount,
  FinancialCategory,
  UpdateCostCenter,
  UpdateFinancialAccount,
  UpdateFinancialCategory,
} from '../domain/registries';

type CategoryRow = { id: string; tenant_id: string; company_id: string; name: string; kind: FinancialCategory['kind']; status: FinancialCategory['status'] };
type CostCenterRow = { id: string; tenant_id: string; company_id: string; name: string; code: string | null; status: CostCenter['status'] };
type AccountRow = { id: string; tenant_id: string; company_id: string; name: string; account_type: FinancialAccount['accountType']; bank_institution: FinancialAccount['bankInstitution']; opening_balance: number | string; status: FinancialAccount['status'] };

function category(row: CategoryRow): FinancialCategory {
  return { id: row.id, tenantId: row.tenant_id, companyId: row.company_id, name: row.name, kind: row.kind, status: row.status };
}
function costCenter(row: CostCenterRow): CostCenter {
  return { id: row.id, tenantId: row.tenant_id, companyId: row.company_id, name: row.name, code: row.code, status: row.status };
}
function account(row: AccountRow): FinancialAccount {
  return { id: row.id, tenantId: row.tenant_id, companyId: row.company_id, name: row.name, accountType: row.account_type, bankInstitution: row.bank_institution, openingBalance: Number(row.opening_balance), status: row.status };
}

export class SupabaseFinanceRegistryRepository implements FinanceRegistryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listCategories(scope: CompanyScope): Promise<readonly FinancialCategory[]> {
    const { data, error } = await this.client.from('financial_categories').select('id,tenant_id,company_id,name,kind,status').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('name');
    if (error) throw error;
    return data.map(category);
  }

  async createCategory(raw: CreateFinancialCategory): Promise<FinancialCategory> {
    const input = normalizeCategory(raw);
    const { data, error } = await this.client.from('financial_categories').insert({ tenant_id: input.tenantId, company_id: input.companyId, name: input.name, kind: input.kind }).select('id,tenant_id,company_id,name,kind,status').single();
    if (error) throw error;
    return category(data);
  }

  async updateCategory(raw: UpdateFinancialCategory): Promise<FinancialCategory> {
    const input = normalizeCategory(raw);
    const { data, error } = await this.client.from('financial_categories')
      .update({ name: input.name, kind: input.kind, status: raw.status })
      .eq('tenant_id', input.tenantId).eq('company_id', input.companyId).eq('id', raw.id)
      .select('id,tenant_id,company_id,name,kind,status').single();
    if (error) throw error;
    return category(data);
  }

  async listCostCenters(scope: CompanyScope): Promise<readonly CostCenter[]> {
    const { data, error } = await this.client.from('cost_centers').select('id,tenant_id,company_id,name,code,status').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('name');
    if (error) throw error;
    return data.map(costCenter);
  }

  async createCostCenter(raw: CreateCostCenter): Promise<CostCenter> {
    const input = normalizeCostCenter(raw);
    const { data, error } = await this.client.from('cost_centers').insert({ tenant_id: input.tenantId, company_id: input.companyId, name: input.name, code: input.code ?? null }).select('id,tenant_id,company_id,name,code,status').single();
    if (error) throw error;
    return costCenter(data);
  }

  async updateCostCenter(raw: UpdateCostCenter): Promise<CostCenter> {
    const input = normalizeCostCenter(raw);
    const { data, error } = await this.client.from('cost_centers')
      .update({ name: input.name, code: input.code ?? null, status: raw.status })
      .eq('tenant_id', input.tenantId).eq('company_id', input.companyId).eq('id', raw.id)
      .select('id,tenant_id,company_id,name,code,status').single();
    if (error) throw error;
    return costCenter(data);
  }

  async listAccounts(scope: CompanyScope): Promise<readonly FinancialAccount[]> {
    const { data, error } = await this.client.from('financial_accounts').select('id,tenant_id,company_id,name,account_type,bank_institution,opening_balance,status').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('name');
    if (error) throw error;
    return data.map(account);
  }

  async createAccount(raw: CreateFinancialAccount): Promise<FinancialAccount> {
    const input = normalizeAccount(raw);
    const { data, error } = await this.client.from('financial_accounts').insert({ tenant_id: input.tenantId, company_id: input.companyId, name: input.name, account_type: input.accountType, bank_institution: input.bankInstitution ?? null, opening_balance: input.openingBalance ?? 0 }).select('id,tenant_id,company_id,name,account_type,bank_institution,opening_balance,status').single();
    if (error) throw error;
    return account(data);
  }

  async updateAccount(raw: UpdateFinancialAccount): Promise<FinancialAccount> {
    const name = raw.name.trim();
    if (!name) throw new Error('name is required');
    const sourceCompanyId = raw.sourceCompanyId ?? raw.companyId;
    const { data, error } = await this.client.from('financial_accounts')
      .update({ company_id: raw.companyId, name, account_type: raw.accountType, bank_institution: raw.bankInstitution ?? null, status: raw.status })
      .eq('tenant_id', raw.tenantId).eq('company_id', sourceCompanyId).eq('id', raw.id)
      .select('id,tenant_id,company_id,name,account_type,bank_institution,opening_balance,status').single();
    if (error) throw error;
    return account(data);
  }
}
