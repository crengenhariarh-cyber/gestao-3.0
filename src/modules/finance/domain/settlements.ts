import type { CompanyScope } from './registries';

export type FinancialStatus = 'pending' | 'partial' | 'paid';

export interface FinancialSettlement extends CompanyScope {
  id: string;
  installmentId: string;
  accountId: string;
  settledOn: string;
  amount: number;
  idempotencyKey: string;
  notes: string | null;
}

export interface InstallmentBalance extends CompanyScope {
  installmentId: string;
  entryId: string;
  installmentNumber: number;
  installmentCount: number;
  dueDate: string;
  competenceMonth: string;
  installmentAmount: number;
  settledAmount: number;
  remainingAmount: number;
  financialStatus: FinancialStatus;
}

export interface RecordFinancialSettlement extends CompanyScope {
  installmentId: string;
  accountId: string;
  settledOn: string;
  amount: number;
  idempotencyKey: string;
  notes?: string | null;
}

export interface RecordedFinancialSettlement {
  settlementId: string;
  settledAmount: number;
  installmentAmount: number;
  settledTotal: number;
  remainingAmount: number;
  financialStatus: FinancialStatus;
}
