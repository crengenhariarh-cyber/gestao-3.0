import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinancialAccountRepository } from '../application/FinancialAccountRepository';
import { normalizeFinancialTransfer } from '../application/transferValidation';
import type {
  CreateFinancialTransfer,
  FinancialAccountBalance,
  FinancialAccountMovement,
  FinancialTransfer,
  RecordedFinancialTransfer,
} from '../domain/accounts';
import type { CompanyScope } from '../domain/registries';

type BalanceRow = {
  account_id: string; tenant_id: string; company_id: string; name: string;
  account_type: FinancialAccountBalance['accountType']; bank_institution: FinancialAccountBalance['bankInstitution']; status: FinancialAccountBalance['status'];
  opening_balance: number | string; movement_total: number | string; current_balance: number | string;
  include_in_dashboard: boolean; sort_order: number;
};

type MovementRow = {
  id: string; tenant_id: string; company_id: string; account_id: string; movement_on: string;
  direction: FinancialAccountMovement['direction']; amount: number | string; source_type: string;
  source_id: string; description: string | null;
};

type TransferRow = {
  id: string; tenant_id: string; company_id: string; from_account_id: string;
  to_account_id: string; transfer_on: string; amount: number | string; notes: string | null;
};

type RecordedRow = { transfer_id: string; from_balance: number | string; to_balance: number | string };

function isRecordedRow(value: unknown): value is RecordedRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.transfer_id === 'string'
    && (typeof row.from_balance === 'number' || typeof row.from_balance === 'string')
    && (typeof row.to_balance === 'number' || typeof row.to_balance === 'string');
}

export class SupabaseFinancialAccountRepository implements FinancialAccountRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listBalances(scope: CompanyScope): Promise<readonly FinancialAccountBalance[]> {
    const { data, error } = await this.client.from('financial_account_balances')
      .select('account_id,tenant_id,company_id,name,account_type,bank_institution,status,opening_balance,movement_total,current_balance,include_in_dashboard,sort_order')
      .eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId)
      .order('sort_order', { ascending: true }).order('name')
      .returns<BalanceRow[]>();
    if (error) throw error;
    return data.map((row) => ({
      accountId: row.account_id, tenantId: row.tenant_id, companyId: row.company_id,
      name: row.name, accountType: row.account_type, bankInstitution: row.bank_institution, status: row.status,
      includeInDashboard: row.include_in_dashboard,
      openingBalance: Number(row.opening_balance), movementTotal: Number(row.movement_total),
      currentBalance: Number(row.current_balance), sortOrder: Number(row.sort_order),
    }));
  }

  async reorder(tenantId: string, orderedIds: readonly string[]): Promise<void> {
    if (orderedIds.length < 2) return;
    const { error } = await this.client.rpc('reorder_financial_accounts', {
      p_tenant_id: tenantId,
      p_ordered_ids: [...orderedIds],
    });
    if (error) throw error;
  }

  async listMovements(scope: CompanyScope, from: string, to: string): Promise<readonly FinancialAccountMovement[]> {
    const { data, error } = await this.client.from('financial_account_movements')
      .select('id,tenant_id,company_id,account_id,movement_on,direction,amount,source_type,source_id,description')
      .eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId)
      .gte('movement_on', from).lte('movement_on', to)
      .order('movement_on', { ascending: true }).order('created_at', { ascending: true })
      .returns<MovementRow[]>();
    if (error) throw error;
    return data.map((row) => ({
      id: row.id, tenantId: row.tenant_id, companyId: row.company_id, accountId: row.account_id,
      movementOn: row.movement_on, direction: row.direction, amount: Number(row.amount),
      sourceType: row.source_type, sourceId: row.source_id, description: row.description,
    }));
  }

  async listTransfers(scope: CompanyScope): Promise<readonly FinancialTransfer[]> {
    const { data, error } = await this.client.from('financial_transfers')
      .select('id,tenant_id,company_id,from_account_id,to_account_id,transfer_on,amount,notes')
      .eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId)
      .order('transfer_on', { ascending: false }).returns<TransferRow[]>();
    if (error) throw error;
    return data.map((row) => ({
      id: row.id, tenantId: row.tenant_id, companyId: row.company_id,
      fromAccountId: row.from_account_id, toAccountId: row.to_account_id,
      transferOn: row.transfer_on, amount: Number(row.amount), notes: row.notes,
    }));
  }

  async recordTransfer(raw: CreateFinancialTransfer): Promise<RecordedFinancialTransfer> {
    const input = normalizeFinancialTransfer(raw);
    const result = await this.client.rpc('record_financial_transfer', {
      p_tenant_id: input.tenantId, p_company_id: input.companyId,
      p_from_account_id: input.fromAccountId, p_to_account_id: input.toAccountId,
      p_transfer_on: input.transferOn, p_amount: input.amount,
      p_idempotency_key: input.idempotencyKey, p_notes: input.notes ?? null,
    });
    if (result.error) throw result.error;
    const data: unknown = result.data;
    const row: unknown = Array.isArray(data) ? data[0] : data;
    if (!isRecordedRow(row)) throw new Error('financial transfer returned an invalid result');
    return { transferId: row.transfer_id, fromBalance: Number(row.from_balance), toBalance: Number(row.to_balance) };
  }
}
