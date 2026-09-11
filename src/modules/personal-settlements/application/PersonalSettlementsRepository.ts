import type {
  NewPersonalSettlement,
  PersonalSettlementItemInput,
  PersonalSettlementMovementInput,
  PersonalSettlementScope,
  PersonalSettlementsSnapshot,
} from '../domain/personalSettlements';

export interface PersonalSettlementsRepository {
  load(scope: PersonalSettlementScope): Promise<PersonalSettlementsSnapshot>;
  create(input: NewPersonalSettlement): Promise<string>;
  addItem(input: PersonalSettlementItemInput): Promise<string>;
  updateItem(itemId: string, input: Omit<PersonalSettlementItemInput, 'settlementId'>): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
  addMovement(input: PersonalSettlementMovementInput): Promise<string>;
  updateMovement(movementId: string, input: Omit<PersonalSettlementMovementInput, 'settlementId'>): Promise<void>;
  deleteMovement(movementId: string): Promise<void>;
  deleteSettlement(settlementId: string): Promise<void>;
}
