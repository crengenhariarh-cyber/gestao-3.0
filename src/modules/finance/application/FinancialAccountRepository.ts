import type { CompanyScope } from '../domain/registries';
import type {
  CreateFinancialTransfer,
  FinancialAccountBalance,
  FinancialAccountMovement,
  FinancialTransfer,
  RecordedFinancialTransfer,
} from '../domain/accounts';

export interface FinancialAccountRepository {
  listBalances(scope: CompanyScope): Promise<readonly FinancialAccountBalance[]>;
  reorder(tenantId: string, orderedIds: readonly string[]): Promise<void>;
  listMovements(scope: CompanyScope, from?: string, to?: string): Promise<readonly FinancialAccountMovement[]>;
  updateMovement(input: CompanyScope & { movementId: string; movementOn: string; direction?: FinancialAccountMovement['direction']; amount: number; description: string | null }): Promise<void>;
  deleteMovement(input: CompanyScope & { movementId: string }): Promise<void>;
  listTransfers(scope: CompanyScope): Promise<readonly FinancialTransfer[]>;
  recordTransfer(input: CreateFinancialTransfer): Promise<RecordedFinancialTransfer>;
}
