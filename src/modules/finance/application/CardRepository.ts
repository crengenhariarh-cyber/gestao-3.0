import type { CompanyScope } from '../domain/registries';
import type {
  CardInstallment,
  CardStatementBalance,
  CloseCardStatement,
  ClosedCardStatement,
  CreateCardPurchase,
  CreatedCardPurchase,
  CreditCard,
  CreditCardLimit,
  RecordCardStatementPayment,
  RecordedCardStatementPayment,
} from '../domain/cards';

export interface CardRepository {
  listCards(scope: CompanyScope): Promise<readonly CreditCard[]>;
  listLimits(scope: CompanyScope): Promise<readonly CreditCardLimit[]>;
  listInstallments(scope: CompanyScope, cardId?: string): Promise<readonly CardInstallment[]>;
  listStatements(scope: CompanyScope, cardId?: string): Promise<readonly CardStatementBalance[]>;
  createPurchase(input: CreateCardPurchase): Promise<CreatedCardPurchase>;
  closeStatement(input: CloseCardStatement): Promise<ClosedCardStatement>;
  recordStatementPayment(input: RecordCardStatementPayment): Promise<RecordedCardStatementPayment>;
}
