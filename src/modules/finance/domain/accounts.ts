import type { CompanyScope } from './registries';

export interface FinancialAccountBalance extends CompanyScope {
  accountId: string;
  name: string;
  accountType: 'bank' | 'cash' | 'other';
  status: 'active' | 'inactive';
  openingBalance: number;
  movementTotal: number;
  currentBalance: number;
}

export interface FinancialAccountMovement extends CompanyScope {
  id: string;
  accountId: string;
  movementOn: string;
  direction: 'credit' | 'debit';
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
