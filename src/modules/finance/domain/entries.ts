import type { CompanyScope } from './registries';

export type FinancialEntryType = 'income' | 'expense';

export interface FinancialEntry extends CompanyScope {
  id: string;
  entryType: FinancialEntryType;
  description: string;
  counterpartyName: string | null;
  categoryId: string;
  costCenterId: string | null;
  competenceMonth: string;
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
  competenceMonth: string;
  installmentNumber: number;
  installmentCount: number;
  dueDate: string;
  amount: number;
}

export interface CreateSingleFinancialEntry extends CompanyScope {
  entryType: FinancialEntryType;
  description: string;
  counterpartyName?: string | null;
  categoryId: string;
  costCenterId?: string | null;
  competenceMonth: string;
  dueDate: string;
  amount: number;
  notes?: string | null;
}

export interface CreatedSingleFinancialEntry {
  entryId: string;
  installmentId: string;
}
