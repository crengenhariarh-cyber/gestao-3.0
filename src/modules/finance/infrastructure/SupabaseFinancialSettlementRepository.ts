import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinancialSettlementRepository } from '../application/FinancialSettlementRepository';
import { normalizeFinancialSettlement } from '../application/settlementValidation';
import type { CompanyScope } from '../domain/registries';
import type {
  FinancialStatus,
  InstallmentBalance,
  RecordFinancialSettlement,
  RecordedFinancialSettlement,
} from '../domain/settlements';

type BalanceRow = {
  installment_id: string;
  tenant_id: string;
  company_id: string;
  entry_id: string;
  installment_number: number;
  installment_count: number;
  due_date: string;
  competence_month: string;
  installment_amount: number | string;
  settled_amount: number | string;
  remaining_amount: number | string;
  financial_status: FinancialStatus;
};

type SettlementResultRow = {
  settlement_id: string;
  settled_amount: number | string;
  installment_amount: number | string;
  settled_total: number | string;
  remaining_amount: number | string;
  financial_status: FinancialStatus;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFinancialStatus(value: unknown): value is FinancialStatus {
  return value === 'pending' || value === 'partial' || value === 'paid';
}

function isMoneyValue(value: unknown): value is number | string {
  return typeof value === 'number' || typeof value === 'string';
}

function isSettlementResultRow(value: unknown): value is SettlementResultRow {
  if (!isRecord(value)) return false;
  return typeof value.settlement_id === 'string'
    && isMoneyValue(value.settled_amount)
    && isMoneyValue(value.installment_amount)
    && isMoneyValue(value.settled_total)
    && isMoneyValue(value.remaining_amount)
    && isFinancialStatus(value.financial_status);
}

function balance(row: BalanceRow): InstallmentBalance {
  return {
    installmentId: row.installment_id,
    tenantId: row.tenant_id,
    companyId: row.company_id,
    entryId: row.entry_id,
    installmentNumber: row.installment_number,
    installmentCount: row.installment_count,
    dueDate: row.due_date,
    competenceMonth: row.competence_month,
    installmentAmount: Number(row.installment_amount),
    settledAmount: Number(row.settled_amount),
    remainingAmount: Number(row.remaining_amount),
    financialStatus: row.financial_status,
  };
}

export class SupabaseFinancialSettlementRepository implements FinancialSettlementRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listBalances(scope: CompanyScope): Promise<readonly InstallmentBalance[]> {
    const { data, error } = await this.client
      .from('financial_installment_balances')
      .select('installment_id,tenant_id,company_id,entry_id,installment_number,installment_count,due_date,competence_month,installment_amount,settled_amount,remaining_amount,financial_status')
      .eq('tenant_id', scope.tenantId)
      .eq('company_id', scope.companyId)
      .order('due_date')
      .returns<BalanceRow[]>();

    if (error) throw error;
    return data.map(balance);
  }

  async record(raw: RecordFinancialSettlement): Promise<RecordedFinancialSettlement> {
    const input = normalizeFinancialSettlement(raw);
    const rpcResult = await this.client.rpc('record_financial_settlement', {
      p_tenant_id: input.tenantId,
      p_company_id: input.companyId,
      p_installment_id: input.installmentId,
      p_account_id: input.accountId,
      p_settled_on: input.settledOn,
      p_amount: input.amount,
      p_idempotency_key: input.idempotencyKey,
      p_notes: input.notes,
      p_settles_in_full: input.settlesInFull,
    });

    if (rpcResult.error) throw rpcResult.error;
    const rpcData: unknown = rpcResult.data;
    const row: unknown = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!isSettlementResultRow(row)) throw new Error('financial settlement returned an invalid result');

    return {
      settlementId: row.settlement_id,
      settledAmount: Number(row.settled_amount),
      installmentAmount: Number(row.installment_amount),
      settledTotal: Number(row.settled_total),
      remainingAmount: Number(row.remaining_amount),
      financialStatus: row.financial_status,
    };
  }
}
