export type PersonalSettlementDirection = 'i_owe' | 'owes_me';
export type PersonalSettlementStatus = 'open' | 'partial' | 'settled';

export interface PersonalSettlement {
  id: string;
  tenantId: string;
  companyId: string;
  personName: string;
  direction: PersonalSettlementDirection;
  originalAmount: number;
  startedOn: string;
  description: string | null;
  notes: string | null;
  status: PersonalSettlementStatus;
}

export interface PersonalSettlementItem {
  id: string;
  settlementId: string;
  itemDate: string;
  description: string;
  amount: number;
  notes: string | null;
  financialAccountId: string | null;
}

export interface PersonalSettlementMovement {
  id: string;
  settlementId: string;
  movementDate: string;
  amount: number;
  note: string | null;
  financialAccountId: string | null;
}

export interface PersonalSettlementAccount {
  id: string;
  name: string;
  bankInstitution: string | null;
  currentBalance: number;
}

export interface PersonalSettlementsSnapshot {
  settlements: readonly PersonalSettlement[];
  items: readonly PersonalSettlementItem[];
  movements: readonly PersonalSettlementMovement[];
  accounts: readonly PersonalSettlementAccount[];
}

export interface PersonalSettlementScope { tenantId: string; companyId: string; }

export interface NewPersonalSettlement {
  scope: PersonalSettlementScope;
  personName: string;
  direction: PersonalSettlementDirection;
  startedOn: string;
  description: string;
  amount: number;
  notes: string;
  accountId: string | null;
}

export interface PersonalSettlementItemInput {
  settlementId: string;
  itemDate: string;
  description: string;
  amount: number;
  notes: string;
  accountId: string | null;
}

export interface PersonalSettlementMovementInput {
  settlementId: string;
  movementDate: string;
  amount: number;
  note: string;
  accountId: string;
}
