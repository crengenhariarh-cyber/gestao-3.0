import type { CompanyScope } from '../domain/registries';
import type {
  CreateFinancialTransfer,
  FinancialAccountBalance,
  FinancialTransfer,
  RecordedFinancialTransfer,
} from '../domain/accounts';

export interface FinancialAccountRepository {
  listBalances(scope: CompanyScope): Promise<readonly FinancialAccountBalance[]>;
  listTransfers(scope: CompanyScope): Promise<readonly FinancialTransfer[]>;
  recordTransfer(input: CreateFinancialTransfer): Promise<RecordedFinancialTransfer>;
}
