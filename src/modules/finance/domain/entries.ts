import type { CompanyScope } from './registries';

export type FinancialEntryType = 'income' | 'expense';
export type FinancialPaymentMethod = 'pix' | 'debit' | 'credit' | 'cash' | 'transfer' | 'boleto' | 'other';

export interface FinancialEntry extends CompanyScope {
  id: string;
  entryType: FinancialEntryType;
  description: string;
  counterpartyName: string | null;
  categoryId: string;
  costCenterId: string | null;
  workId: string | null;
  paymentMethod: FinancialPaymentMethod | null;
  competenceMonth: string;
  plannedAccountId: string | null;
  notes: string | null;
}

export interface FinancialInstallment extends CompanyScope {
  id: string;
  entryId: string;
  installmentNumber: number;
  installmentCount: number;
  dueDate: string;
  competenceMonth: string;
  amount: number;
}

export interface FinancialEntryListItem extends CompanyScope {
  entryId: string;
  installmentId: string;
  entryType: FinancialEntryType;
  description: string;
  counterpartyName: string | null;
  categoryId: string;
  costCenterId: string | null;
  workId: string | null;
  paymentMethod: FinancialPaymentMethod | null;
  competenceMonth: string;
  plannedAccountId: string | null;
  installmentNumber: number;
  installmentCount: number;
  dueDate: string;
  amount: number;
  notes: string | null;
}

export interface CreateSingleFinancialEntry extends CompanyScope {
  entryType: FinancialEntryType;
  description: string;
  counterpartyName?: string | null;
  categoryId: string;
  costCenterId?: string | null;
  workId?: string | null;
  paymentMethod?: FinancialPaymentMethod | null;
  plannedAccountId?: string | null;
  competenceMonth: string;
  dueDate: string;
  amount: number;
  installmentCount?: number;
  notes?: string | null;
}

export interface UpdateFinancialEntry extends CreateSingleFinancialEntry {
  entryId: string;
  installmentCount: number;
}

export interface CreatedSingleFinancialEntry {
  entryId: string;
  installmentId: string | null;
}
