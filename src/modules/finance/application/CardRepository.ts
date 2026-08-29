import type { CompanyScope } from '../domain/registries';
import type {
  CardInstallment,
  CreateCardPurchase,
  CreatedCardPurchase,
  CreditCard,
  CreditCardLimit,
} from '../domain/cards';

export interface CardRepository {
  listCards(scope: CompanyScope): Promise<readonly CreditCard[]>;
  listLimits(scope: CompanyScope): Promise<readonly CreditCardLimit[]>;
  listInstallments(scope: CompanyScope, cardId?: string): Promise<readonly CardInstallment[]>;
  createPurchase(input: CreateCardPurchase): Promise<CreatedCardPurchase>;
}
