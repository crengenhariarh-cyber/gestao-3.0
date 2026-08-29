import type {
  FinanceMonthlyFilters,
  FinanceMonthlyItem,
  FinanceMonthlySummary,
} from '../domain/monthly';

export interface FinanceMonthlyRepository {
  list(filters: FinanceMonthlyFilters): Promise<readonly FinanceMonthlyItem[]>;
  summarize(filters: FinanceMonthlyFilters): Promise<readonly FinanceMonthlySummary[]>;
}
