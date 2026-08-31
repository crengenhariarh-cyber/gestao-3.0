import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinancialEntryRepository } from '../application/FinancialEntryRepository';
import { normalizeSingleFinancialEntry } from '../application/entryValidation';
import type {
  CreateSingleFinancialEntry,
  CreatedSingleFinancialEntry,
  FinancialEntryListItem,
} from '../domain/entries';
import type { CompanyScope } from '../domain/registries';

type CreateRow = { entry_id: string; installment_id: string };
type CreateInstallmentRow = { entry_id: string; installment_count: number };
type ListRow = {
  id: string;
  tenant_id: string;
  company_id: string;
  installment_number: number;
  installment_count: number;
  due_date: string;
  amount: number | string;
  financial_entries: {
    id: string;
    entry_type: FinancialEntryListItem['entryType'];
    description: string;
    counterparty_name: string | null;
    category_id: string;
    cost_center_id: string | null;
    competence_month: string;
  };
};

function isCreateRow(value: unknown): value is CreateRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.entry_id === 'string' && typeof row.installment_id === 'string';
}

function isCreateInstallmentRow(value: unknown): value is CreateInstallmentRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.entry_id === 'string' && typeof row.installment_count === 'number';
}

function toListItem(row: ListRow): FinancialEntryListItem {
  return {
    tenantId: row.tenant_id,
    companyId: row.company_id,
    entryId: row.financial_entries.id,
    installmentId: row.id,
    entryType: row.financial_entries.entry_type,
    description: row.financial_entries.description,
    counterpartyName: row.financial_entries.counterparty_name,
    categoryId: row.financial_entries.category_id,
    costCenterId: row.financial_entries.cost_center_id,
    competenceMonth: row.financial_entries.competence_month,
    installmentNumber: row.installment_number,
    installmentCount: row.installment_count,
    dueDate: row.due_date,
    amount: Number(row.amount),
  };
}

export class SupabaseFinancialEntryRepository implements FinancialEntryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createSingle(raw: CreateSingleFinancialEntry): Promise<CreatedSingleFinancialEntry> {
    const input = normalizeSingleFinancialEntry(raw);
    const installmentCount = input.installmentCount ?? 1;
    if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 120) {
      throw new Error('installmentCount must be an integer between 1 and 120');
    }

    if (installmentCount > 1) {
      const rpcResult = await this.client.rpc('create_installment_financial_entry', {
        p_tenant_id: input.tenantId,
        p_company_id: input.companyId,
        p_entry_type: input.entryType,
        p_description: input.description,
        p_counterparty_name: input.counterpartyName ?? null,
        p_category_id: input.categoryId,
        p_cost_center_id: input.costCenterId ?? null,
        p_initial_competence_month: input.competenceMonth,
        p_first_due_date: input.dueDate,
        p_total_amount: input.amount,
        p_installment_count: installmentCount,
        p_notes: input.notes ?? null,
      });

      if (rpcResult.error) throw rpcResult.error;
      const rpcData: unknown = rpcResult.data;
      const created: unknown = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!isCreateInstallmentRow(created)) throw new Error('installment financial entry creation returned an invalid result');

      return { entryId: created.entry_id, installmentId: null };
    }

    const rpcResult = await this.client.rpc('create_single_financial_entry', {
      p_tenant_id: input.tenantId,
      p_company_id: input.companyId,
      p_entry_type: input.entryType,
      p_description: input.description,
      p_counterparty_name: input.counterpartyName ?? null,
      p_category_id: input.categoryId,
      p_cost_center_id: input.costCenterId ?? null,
      p_competence_month: input.competenceMonth,
      p_due_date: input.dueDate,
      p_amount: input.amount,
      p_notes: input.notes ?? null,
    });

    if (rpcResult.error) throw rpcResult.error;
    const rpcData: unknown = rpcResult.data;
    const created: unknown = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!isCreateRow(created)) throw new Error('financial entry creation returned an invalid result');

    return { entryId: created.entry_id, installmentId: created.installment_id };
  }

  async list(scope: CompanyScope): Promise<readonly FinancialEntryListItem[]> {
    const { data, error } = await this.client
      .from('financial_installments')
      .select('id,tenant_id,company_id,installment_number,installment_count,due_date,amount,financial_entries!inner(id,entry_type,description,counterparty_name,category_id,cost_center_id,competence_month)')
      .eq('tenant_id', scope.tenantId)
      .eq('company_id', scope.companyId)
      .order('due_date')
      .returns<ListRow[]>();

    if (error) throw error;
    return data.map(toListItem);
  }
}
