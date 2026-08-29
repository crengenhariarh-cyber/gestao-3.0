import type { FinanceMonthlyFilters, FinanceMonthlyItem } from '../domain/monthly';

export interface FinanceMonthlyRepository {
  list(filters: FinanceMonthlyFilters): Promise<readonly FinanceMonthlyItem[]>;
}
