import type { CompanyScope } from './registries';

export type MonthlySourceKind = 'financial_installment' | 'card_installment';
export type MonthlyEntryType = 'income' | 'expense';
export type MonthlyPaymentStatus = 'open' | 'pending' | 'partial' | 'paid';

export interface FinanceMonthlyItem extends CompanyScope {
  sourceKind: MonthlySourceKind;
  itemId: string;
  parentId: string;
  competenceMonth: string;
  dueDate: string;
  entryType: MonthlyEntryType;
  description: string;
  counterpartyName: string | null;
  categoryId: string;
  costCenterId: string | null;
  installmentNumber: number;
  installmentCount: number;
  plannedAmount: number;
  realizedAmount: number;
  pendingAmount: number;
  paymentStatus: MonthlyPaymentStatus;
}

export interface FinanceMonthlyFilters extends CompanyScope {
  competenceFrom: string;
  competenceTo: string;
  categoryId?: string;
  costCenterId?: string;
  counterparty?: string;
  entryType?: MonthlyEntryType;
  paymentStatus?: MonthlyPaymentStatus;
  sourceKind?: MonthlySourceKind;
}

export interface FinanceMonthlySummary {
  competenceMonth: string;
  entryType: MonthlyEntryType;
  plannedAmount: number;
  realizedAmount: number;
  pendingAmount: number;
  itemCount: number;
}
