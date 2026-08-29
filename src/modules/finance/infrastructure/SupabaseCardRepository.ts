import type { SupabaseClient } from '@supabase/supabase-js';
import type { CardRepository } from '../application/CardRepository';
import { normalizeCardPurchase } from '../application/cardValidation';
import type {
  CardInstallment,
  CreateCardPurchase,
  CreatedCardPurchase,
  CreditCard,
  CreditCardLimit,
} from '../domain/cards';
import type { CompanyScope } from '../domain/registries';

type CardRow = {
  id: string; tenant_id: string; company_id: string; name: string; last_four: string | null;
  credit_limit: number | string; closing_day: number; due_day: number;
  default_payment_account_id: string | null; status: CreditCard['status'];
};

type LimitRow = {
  card_id: string; tenant_id: string; company_id: string; name: string;
  credit_limit: number | string; committed_amount: number | string; available_limit: number | string;
};

type InstallmentRow = {
  id: string; tenant_id: string; company_id: string; card_id: string; transaction_id: string;
  installment_number: number; installment_count: number; statement_month: string; amount: number | string;
};

type CreatedRow = {
  transaction_id: string; first_statement_month: string;
  committed_amount: number | string; available_limit: number | string;
};

function isCreatedRow(value: unknown): value is CreatedRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.transaction_id === 'string'
    && typeof row.first_statement_month === 'string'
    && (typeof row.committed_amount === 'number' || typeof row.committed_amount === 'string')
    && (typeof row.available_limit === 'number' || typeof row.available_limit === 'string');
}

export class SupabaseCardRepository implements CardRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listCards(scope: CompanyScope): Promise<readonly CreditCard[]> {
    const { data, error } = await this.client.from('credit_cards')
      .select('id,tenant_id,company_id,name,last_four,credit_limit,closing_day,due_day,default_payment_account_id,status')
      .eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('name')
      .returns<CardRow[]>();
    if (error) throw error;
    return data.map((row) => ({
      id: row.id, tenantId: row.tenant_id, companyId: row.company_id, name: row.name,
      lastFour: row.last_four, creditLimit: Number(row.credit_limit), closingDay: row.closing_day,
      dueDay: row.due_day, defaultPaymentAccountId: row.default_payment_account_id, status: row.status,
    }));
  }

  async listLimits(scope: CompanyScope): Promise<readonly CreditCardLimit[]> {
    const { data, error } = await this.client.from('credit_card_limits')
      .select('card_id,tenant_id,company_id,name,credit_limit,committed_amount,available_limit')
      .eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('name')
      .returns<LimitRow[]>();
    if (error) throw error;
    return data.map((row) => ({
      cardId: row.card_id, tenantId: row.tenant_id, companyId: row.company_id, name: row.name,
      creditLimit: Number(row.credit_limit), committedAmount: Number(row.committed_amount),
      availableLimit: Number(row.available_limit),
    }));
  }

  async listInstallments(scope: CompanyScope, cardId?: string): Promise<readonly CardInstallment[]> {
    let query = this.client.from('card_installments')
      .select('id,tenant_id,company_id,card_id,transaction_id,installment_number,installment_count,statement_month,amount')
      .eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId)
      .order('statement_month').order('installment_number');
    if (cardId) query = query.eq('card_id', cardId);
    const { data, error } = await query.returns<InstallmentRow[]>();
    if (error) throw error;
    return data.map((row) => ({
      id: row.id, tenantId: row.tenant_id, companyId: row.company_id, cardId: row.card_id,
      transactionId: row.transaction_id, installmentNumber: row.installment_number,
      installmentCount: row.installment_count, statementMonth: row.statement_month, amount: Number(row.amount),
    }));
  }

  async createPurchase(raw: CreateCardPurchase): Promise<CreatedCardPurchase> {
    const input = normalizeCardPurchase(raw);
    const result = await this.client.rpc('create_card_purchase', {
      p_tenant_id: input.tenantId,
      p_company_id: input.companyId,
      p_card_id: input.cardId,
      p_purchase_date: input.purchaseDate,
      p_description: input.description,
      p_counterparty_name: input.counterpartyName ?? null,
      p_category_id: input.categoryId,
      p_cost_center_id: input.costCenterId ?? null,
      p_total_amount: input.totalAmount,
      p_installment_count: input.installmentCount,
      p_idempotency_key: input.idempotencyKey,
      p_notes: input.notes ?? null,
    });
    if (result.error) throw result.error;
    const data: unknown = result.data;
    const row: unknown = Array.isArray(data) ? data[0] : data;
    if (!isCreatedRow(row)) throw new Error('card purchase returned an invalid result');
    return {
      transactionId: row.transaction_id,
      firstStatementMonth: row.first_statement_month,
      committedAmount: Number(row.committed_amount),
      availableLimit: Number(row.available_limit),
    };
  }
}
