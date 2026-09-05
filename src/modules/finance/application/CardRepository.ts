import type { CompanyScope } from '../domain/registries';
import type {
  CardInstallment,
  CardPurchaseDetails,
  CardStatementActivity,
  CardStatementBalance,
  CardStatementItem,
  CloseCardStatement,
  ClosedCardStatement,
  CreateCardPurchase,
  CreateCreditCard,
  CreatedCardPurchase,
  CreditCard,
  CreditCardLimit,
  RecordCardStatementPayment,
  RecordedCardStatementPayment,
  UpdateCardPurchase,
  UpdateCreditCard,
} from '../domain/cards';

export interface CardRepository {
  listCards(scope: CompanyScope): Promise<readonly CreditCard[]>;
  createCard(input: CreateCreditCard): Promise<CreditCard>;
  updateCard(input: UpdateCreditCard): Promise<CreditCard>;
  reorder(tenantId: string, orderedIds: readonly string[]): Promise<void>;
  listLimits(scope: CompanyScope): Promise<readonly CreditCardLimit[]>;
  listInstallments(scope: CompanyScope, cardId?: string): Promise<readonly CardInstallment[]>;
  listStatementItems(scope: CompanyScope, cardId: string): Promise<readonly CardStatementItem[]>;
  listStatementActivities(scope: CompanyScope, cardId: string): Promise<readonly CardStatementActivity[]>;
  listStatements(scope: CompanyScope, cardId?: string): Promise<readonly CardStatementBalance[]>;
  createPurchase(input: CreateCardPurchase): Promise<CreatedCardPurchase>;
  getPurchase(input: CompanyScope & { transactionId: string }): Promise<CardPurchaseDetails>;
  updatePurchase(input: UpdateCardPurchase): Promise<void>;
  deletePurchase(input: CompanyScope & { transactionId: string }): Promise<void>;
  updateStatementPayment(input: CompanyScope & { paymentId: string; paidOn: string; amount: number; notes: string | null }): Promise<void>;
  deleteStatementPayment(input: CompanyScope & { paymentId: string }): Promise<void>;
  closeStatement(input: CloseCardStatement): Promise<ClosedCardStatement>;
  recordStatementPayment(input: RecordCardStatementPayment): Promise<RecordedCardStatementPayment>;
}
