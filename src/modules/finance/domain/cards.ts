import type { CompanyScope, RegistryStatus } from './registries';

export interface CreditCard extends CompanyScope {
  id: string;
  name: string;
  lastFour: string | null;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  defaultPaymentAccountId: string | null;
  status: RegistryStatus;
}

export interface CreateCreditCard extends CompanyScope {
  name: string;
  lastFour?: string | null;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  defaultPaymentAccountId?: string | null;
}

export interface UpdateCreditCard extends CreateCreditCard {
  id: string;
  status: RegistryStatus;
}

export interface CreditCardLimit extends CompanyScope {
  cardId: string;
  name: string;
  creditLimit: number;
  committedAmount: number;
  availableLimit: number;
}

export interface CreateCardPurchase extends CompanyScope {
  expenseCompanyId?: string;
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

export interface CardStatementBalance extends CompanyScope {
  statementId: string;
  cardId: string;
  statementMonth: string;
  dueDate: string;
  statementAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'pending' | 'partial' | 'paid';
}

export interface CloseCardStatement extends CompanyScope {
  cardId: string;
  statementMonth: string;
}

export interface ClosedCardStatement {
  statementId: string;
  statementAmount: number;
  dueDate: string;
  paymentStatus: 'pending' | 'partial' | 'paid';
}

export interface RecordCardStatementPayment extends CompanyScope {
  statementId: string;
  accountId: string;
  paidOn: string;
  amount: number;
  idempotencyKey: string;
  notes?: string | null;
}

export interface RecordedCardStatementPayment {
  paymentId: string;
  paidTotal: number;
  remainingAmount: number;
  paymentStatus: 'partial' | 'paid';
  availableLimit: number;
}
