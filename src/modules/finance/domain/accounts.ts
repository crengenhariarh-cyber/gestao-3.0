import type { CompanyScope } from './registries';

export type BankInstitution = 'itau' | 'nubank' | 'inter' | 'santander' | 'caixa' | 'sicoob' | 'bradesco' | 'bb' | 'sicredi' | 'c6';

export interface FinancialAccountBalance extends CompanyScope {
  accountId: string;
  name: string;
  accountType: 'bank' | 'cash' | 'other';
  bankInstitution: BankInstitution | null;
  status: 'active' | 'inactive';
  includeInDashboard: boolean;
  openingBalance: number;
  movementTotal: number;
  currentBalance: number;
  sortOrder: number;
}

export interface FinancialAccountMovement extends CompanyScope {
  id: string;
  accountId: string;
  movementOn: string;
  direction: 'inflow' | 'outflow';
  amount: number;
  sourceType: string;
  sourceId: string;
  description: string | null;
}

export interface FinancialTransfer extends CompanyScope {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  transferOn: string;
  amount: number;
  notes: string | null;
}

export interface CreateFinancialTransfer extends CompanyScope {
  fromAccountId: string;
  toAccountId: string;
  transferOn: string;
  amount: number;
  idempotencyKey: string;
  notes?: string | null;
}

export interface RecordedFinancialTransfer {
  transferId: string;
  fromBalance: number;
  toBalance: number;
}
