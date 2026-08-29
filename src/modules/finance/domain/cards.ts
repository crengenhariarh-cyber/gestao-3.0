import type { CompanyScope } from './registries';

export interface CreditCard extends CompanyScope {
  id: string;
  name: string;
  lastFour: string | null;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  defaultPaymentAccountId: string | null;
  status: 'active' | 'inactive';
}

export interface CreditCardLimit extends CompanyScope {
  cardId: string;
  name: string;
  creditLimit: number;
  committedAmount: number;
  availableLimit: number;
}

export interface CreateCardPurchase extends CompanyScope {
  cardId: string;
  purchaseDate: string;
  description: string;
  counterpartyName?: string | null;
  categoryId: string;
  costCenterId?: string | null;
  totalAmount: number;
  installmentCount: number;
  idempotencyKey: string;
  notes?: string | null;
}

export interface CreatedCardPurchase {
  transactionId: string;
  firstStatementMonth: string;
  committedAmount: number;
  availableLimit: number;
}

export interface CardInstallment extends CompanyScope {
  id: string;
  cardId: string;
  transactionId: string;
  installmentNumber: number;
  installmentCount: number;
  statementMonth: string;
  amount: number;
}
