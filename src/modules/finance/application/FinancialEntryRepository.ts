import type {
  CreateSingleFinancialEntry,
  CreatedSingleFinancialEntry,
  FinancialEntryListItem,
} from '../domain/entries';
import type { CompanyScope } from '../domain/registries';

export interface FinancialEntryRepository {
  createSingle(input: CreateSingleFinancialEntry): Promise<CreatedSingleFinancialEntry>;
  list(scope: CompanyScope): Promise<readonly FinancialEntryListItem[]>;
}
