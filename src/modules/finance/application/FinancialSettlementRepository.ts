import type { CompanyScope } from '../domain/registries';
import type {
  InstallmentBalance,
  RecordFinancialSettlement,
  RecordedFinancialSettlement,
} from '../domain/settlements';

export interface FinancialSettlementRepository {
  listBalances(scope: CompanyScope): Promise<readonly InstallmentBalance[]>;
  record(input: RecordFinancialSettlement): Promise<RecordedFinancialSettlement>;
}
