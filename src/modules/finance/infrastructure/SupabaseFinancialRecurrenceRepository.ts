import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinancialRecurrenceRepository } from '../application/FinancialRecurrenceRepository';
import { normalizeRecurrenceRule } from '../application/recurrenceValidation';
import type {
  CreateFinancialRecurrenceRule,
  FinancialRecurrenceRule,
  MaterializedFinancialRecurrence,
} from '../domain/recurrence';
import type { CompanyScope } from '../domain/registries';

type RecurrenceRow = {
  id: string;
  tenant_id: string;
  company_id: string;
  entry_type: FinancialRecurrenceRule['entryType'];
  description: string;
  counterparty_name: string | null;
  category_id: string;
  cost_center_id: string | null;
  work_id: string | null;
  payment_method: FinancialRecurrenceRule['paymentMethod'];
  amount: number | string;
  frequency: FinancialRecurrenceRule['frequency'];
  interval_count: number;
  start_date: string;
  end_date: string | null;
  next_occurrence_date: string;
  day_of_month: number;
  status: FinancialRecurrenceRule['status'];
  notes: string | null;
};

type MaterializeRow = {
  entry_id: string;
  occurrence_date: string;
  next_occurrence_date: string;
};

type RecurrenceMetadataRow = {
  tenant_id: string;
  company_id: string;
  work_id: string | null;
  payment_method: FinancialRecurrenceRule['paymentMethod'];
};

const recurrenceSelect = 'id,tenant_id,company_id,entry_type,description,counterparty_name,category_id,cost_center_id,work_id,payment_method,amount,frequency,interval_count,start_date,end_date,next_occurrence_date,day_of_month,status,notes';

function recurrence(row: RecurrenceRow): FinancialRecurrenceRule {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    companyId: row.company_id,
    entryType: row.entry_type,
    description: row.description,
    counterpartyName: row.counterparty_name,
    categoryId: row.category_id,
    costCenterId: row.cost_center_id,
    workId: row.work_id,
    paymentMethod: row.payment_method,
    amount: Number(row.amount),
    frequency: row.frequency,
    intervalCount: row.interval_count,
    startDate: row.start_date,
    endDate: row.end_date,
    nextOccurrenceDate: row.next_occurrence_date,
    anchorDay: row.day_of_month,
    status: row.status,
    notes: row.notes,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMaterializeRow(value: unknown): value is MaterializeRow {
  if (!isRecord(value)) return false;
  return typeof value.entry_id === 'string'
    && typeof value.occurrence_date === 'string'
    && typeof value.next_occurrence_date === 'string';
}

export class SupabaseFinancialRecurrenceRepository implements FinancialRecurrenceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(scope: CompanyScope): Promise<readonly FinancialRecurrenceRule[]> {
    const { data, error } = await this.client
      .from('financial_recurrence_rules')
      .select(recurrenceSelect)
      .eq('tenant_id', scope.tenantId)
      .eq('company_id', scope.companyId)
      .order('next_occurrence_date')
      .returns<RecurrenceRow[]>();

    if (error) throw error;
    return data.map(recurrence);
  }

  async create(raw: CreateFinancialRecurrenceRule): Promise<FinancialRecurrenceRule> {
    const input = normalizeRecurrenceRule(raw);
    const anchorDay = Number(input.startDate.slice(8, 10));
    const { data, error } = await this.client
      .from('financial_recurrence_rules')
      .insert({
        tenant_id: input.tenantId,
        company_id: input.companyId,
        entry_type: input.entryType,
        description: input.description,
        counterparty_name: input.counterpartyName,
        category_id: input.categoryId,
        cost_center_id: input.costCenterId,
        work_id: raw.workId ?? null,
        payment_method: raw.paymentMethod ?? null,
        amount: input.amount,
        frequency: input.frequency,
        interval_count: input.intervalCount,
        start_date: input.startDate,
        end_date: input.endDate,
        next_occurrence_date: input.startDate,
        day_of_month: anchorDay,
        notes: input.notes,
      })
      .select(recurrenceSelect)
      .single<RecurrenceRow>();

    if (error) throw error;
    return recurrence(data);
  }

  async materializeNext(ruleId: string): Promise<MaterializedFinancialRecurrence> {
    if (!ruleId.trim()) throw new Error('ruleId is required');

    const { data: metadata, error: metadataError } = await this.client
      .from('financial_recurrence_rules')
      .select('tenant_id,company_id,work_id,payment_method')
      .eq('id', ruleId)
      .single<RecurrenceMetadataRow>();
    if (metadataError) throw metadataError;

    const rpcResult = await this.client.rpc('materialize_next_financial_recurrence', {
      p_rule_id: ruleId,
    });

    if (rpcResult.error) throw rpcResult.error;
    const rpcData: unknown = rpcResult.data;
    const row: unknown = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!isMaterializeRow(row)) throw new Error('recurrence materialization returned an invalid result');

    const { error } = await this.client.from('financial_entries')
      .update({ work_id: metadata.work_id, payment_method: metadata.payment_method })
      .eq('tenant_id', metadata.tenant_id)
      .eq('company_id', metadata.company_id)
      .eq('id', row.entry_id);
    if (error) throw error;

    return {
      entryId: row.entry_id,
      occurrenceDate: row.occurrence_date,
      nextOccurrenceDate: row.next_occurrence_date,
    };
  }
}
