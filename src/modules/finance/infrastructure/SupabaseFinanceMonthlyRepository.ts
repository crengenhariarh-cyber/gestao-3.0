import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinanceMonthlyRepository } from '../application/FinanceMonthlyRepository';
import { normalizeFinanceMonthlyFilters } from '../application/monthlyValidation';
import type {
  FinanceMonthlyFilters,
  FinanceMonthlyItem,
  MonthlyEntryType,
  MonthlyPaymentStatus,
  MonthlySourceKind,
} from '../domain/monthly';

type MonthlyRow = {
  tenant_id: string;
  company_id: string;
  source_kind: MonthlySourceKind;
  item_id: string;
  parent_id: string;
  competence_month: string;
  due_date: string;
  entry_type: MonthlyEntryType;
  description: string;
  counterparty_name: string | null;
  category_id: string;
  cost_center_id: string | null;
  installment_number: number;
  installment_count: number;
  planned_amount: number | string;
  realized_amount: number | string;
  pending_amount: number | string;
  payment_status: MonthlyPaymentStatus;
};

function toMonthlyItem(row: MonthlyRow): FinanceMonthlyItem {
  return {
    tenantId: row.tenant_id,
    companyId: row.company_id,
    sourceKind: row.source_kind,
    itemId: row.item_id,
    parentId: row.parent_id,
    competenceMonth: row.competence_month,
    dueDate: row.due_date,
    entryType: row.entry_type,
    description: row.description,
    counterpartyName: row.counterparty_name,
    categoryId: row.category_id,
    costCenterId: row.cost_center_id,
    installmentNumber: row.installment_number,
    installmentCount: row.installment_count,
    plannedAmount: Number(row.planned_amount),
    realizedAmount: Number(row.realized_amount),
    pendingAmount: Number(row.pending_amount),
    paymentStatus: row.payment_status,
  };
}

export class SupabaseFinanceMonthlyRepository implements FinanceMonthlyRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(raw: FinanceMonthlyFilters): Promise<readonly FinanceMonthlyItem[]> {
    const filters = normalizeFinanceMonthlyFilters(raw);
    let query = this.client
      .from('finance_monthly_items')
      .select('tenant_id,company_id,source_kind,item_id,parent_id,competence_month,due_date,entry_type,description,counterparty_name,category_id,cost_center_id,installment_number,installment_count,planned_amount,realized_amount,pending_amount,payment_status')
      .eq('tenant_id', filters.tenantId)
      .eq('company_id', filters.companyId)
      .gte('competence_month', filters.competenceFrom)
      .lte('competence_month', filters.competenceTo)
      .order('competence_month')
      .order('due_date')
      .order('description');

    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters.costCenterId) query = query.eq('cost_center_id', filters.costCenterId);
    if (filters.counterparty) query = query.ilike('counterparty_name', `%${filters.counterparty}%`);
    if (filters.entryType) query = query.eq('entry_type', filters.entryType);
    if (filters.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
    if (filters.sourceKind) query = query.eq('source_kind', filters.sourceKind);

    const { data, error } = await query.returns<MonthlyRow[]>();
    if (error) throw error;
    return data.map(toMonthlyItem);
  }
}
