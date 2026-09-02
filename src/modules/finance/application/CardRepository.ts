import type { CompanyScope } from '../domain/registries';
import type {
  CardInstallment,
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
  listStatements(scope: CompanyScope, cardId?: string): Promise<readonly CardStatementBalance[]>;
  createPurchase(input: CreateCardPurchase): Promise<CreatedCardPurchase>;
  updatePurchase(input: CompanyScope & { transactionId: string; purchaseDate: string; description: string; totalAmount: number }): Promise<void>;
  deletePurchase(input: CompanyScope & { transactionId: string }): Promise<void>;
  closeStatement(input: CloseCardStatement): Promise<ClosedCardStatement>;
  recordStatementPayment(input: RecordCardStatementPayment): Promise<RecordedCardStatementPayment>;
}
