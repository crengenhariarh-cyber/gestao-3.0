import type {
  CreateSingleFinancialEntry,
  CreatedSingleFinancialEntry,
  FinancialEntryListItem,
  UpdateFinancialEntry,
} from '../domain/entries';
import type { CompanyScope } from '../domain/registries';

export interface FinancialEntryRepository {
  createSingle(input: CreateSingleFinancialEntry): Promise<CreatedSingleFinancialEntry>;
  update(input: UpdateFinancialEntry): Promise<void>;
  deleteUnsettled(scope: CompanyScope, entryId: string): Promise<void>;
  setPlannedAccount(scope: CompanyScope, entryId: string, accountId: string | null): Promise<void>;
  list(scope: CompanyScope): Promise<readonly FinancialEntryListItem[]>;
}
