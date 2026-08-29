import type {
  CreateFinancialRecurrenceRule,
  FinancialRecurrenceRule,
  MaterializedFinancialRecurrence,
} from '../domain/recurrence';
import type { CompanyScope } from '../domain/registries';

export interface FinancialRecurrenceRepository {
  list(scope: CompanyScope): Promise<readonly FinancialRecurrenceRule[]>;
  create(input: CreateFinancialRecurrenceRule): Promise<FinancialRecurrenceRule>;
  materializeNext(ruleId: string): Promise<MaterializedFinancialRecurrence>;
}
