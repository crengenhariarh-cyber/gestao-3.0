import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinancialEntryRepository } from '../application/FinancialEntryRepository';
import { normalizeSingleFinancialEntry } from '../application/entryValidation';
import type {
  CreateSingleFinancialEntry,
  CreatedSingleFinancialEntry,
  FinancialEntryListItem,
  UpdateFinancialEntry,
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
    planned_account_id: string | null;
    notes: string | null;
  };
};

type ImmediateSettlementRow = {
  id: string;
  due_date: string;
  amount: number | string;
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
    plannedAccountId: row.financial_entries.planned_account_id,
    installmentNumber: row.installment_number,
    installmentCount: row.installment_count,
    dueDate: row.due_date,
    amount: Number(row.amount),
    notes: row.financial_entries.notes,
  };
}
function installmentCount(value: number | undefined): number {
  const count = value ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 120) throw new Error('installmentCount must be an integer between 1 and 120');
  return count;
}

export class SupabaseFinancialEntryRepository implements FinancialEntryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createSingle(raw: CreateSingleFinancialEntry): Promise<CreatedSingleFinancialEntry> {
    const input = normalizeSingleFinancialEntry(raw);
    const count = installmentCount(input.installmentCount);
    if (count > 1) {
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
        p_installment_count: count,
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

  async update(raw: UpdateFinancialEntry): Promise<void> {
    const input = normalizeSingleFinancialEntry(raw);
    const count = installmentCount(raw.installmentCount);
    const { error } = await this.client.rpc('update_unsettled_financial_entry', {
      p_tenant_id: input.tenantId,
      p_company_id: input.companyId,
      p_entry_id: raw.entryId,
      p_entry_type: input.entryType,
      p_description: input.description,
      p_counterparty_name: input.counterpartyName ?? null,
      p_category_id: input.categoryId,
      p_cost_center_id: input.costCenterId ?? null,
      p_initial_competence_month: input.competenceMonth,
      p_first_due_date: input.dueDate,
      p_total_amount: input.amount,
      p_installment_count: count,
      p_notes: input.notes ?? null,
    });
    if (error) throw error;
  }

  async deleteUnsettled(scope: CompanyScope, entryId: string): Promise<void> {
    const { error } = await this.client.rpc('delete_unsettled_financial_entry', {
      p_tenant_id: scope.tenantId,
      p_company_id: scope.companyId,
      p_entry_id: entryId,
    });
    if (error) throw error;
  }

  async setPlannedAccount(scope: CompanyScope, entryId: string, accountId: string | null, accountCompanyId = scope.companyId): Promise<void> {
    const { error } = await this.client.rpc('set_financial_entry_planned_account_cross_company', {
      p_tenant_id: scope.tenantId,
      p_company_id: scope.companyId,
      p_entry_id: entryId,
      p_account_company_id: accountCompanyId,
      p_account_id: accountId,
    });
    if (error) throw error;

    // No lançamento rápido, escolher uma conta para uma movimentação com data de hoje
    // (ou anterior) significa que o dinheiro já entrou/saiu. Registra a baixa imediatamente.
    // Datas futuras continuam apenas planejadas e não alteram o saldo antes da hora.
    if (!accountId || accountCompanyId !== scope.companyId) return;
    const today = new Date().toISOString().slice(0, 10);
    const installmentResult = await this.client
      .from('financial_installments')
      .select('id,due_date,amount')
      .eq('tenant_id', scope.tenantId)
      .eq('company_id', scope.companyId)
      .eq('entry_id', entryId)
      .lte('due_date', today)
      .order('installment_number')
      .limit(1)
      .maybeSingle<ImmediateSettlementRow>();
    if (installmentResult.error) throw installmentResult.error;
    const installment = installmentResult.data;
    if (!installment) return;

    const settlementResult = await this.client.rpc('record_financial_settlement', {
      p_tenant_id: scope.tenantId,
      p_company_id: scope.companyId,
      p_installment_id: installment.id,
      p_account_id: accountId,
      p_settled_on: installment.due_date,
      p_amount: Number(installment.amount),
      p_idempotency_key: `quick-entry:auto:${entryId}:${installment.id}`,
      p_notes: 'Baixa automática do lançamento rápido com conta selecionada',
    });
    if (settlementResult.error) throw settlementResult.error;
  }

  async list(scope: CompanyScope): Promise<readonly FinancialEntryListItem[]> {
    const { data, error } = await this.client
      .from('financial_installments')
      .select('id,tenant_id,company_id,installment_number,installment_count,due_date,amount,financial_entries!inner(id,entry_type,description,counterparty_name,category_id,cost_center_id,competence_month,planned_account_id,notes)')
      .eq('tenant_id', scope.tenantId)
      .eq('company_id', scope.companyId)
      .order('due_date')
      .returns<ListRow[]>();
    if (error) throw error;
    return data.map(toListItem);
  }
}
