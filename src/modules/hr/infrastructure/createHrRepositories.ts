import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { HrBudgetRepository } from '../application/HrBudgetRepository';
import type { HrOperationsRepository } from '../application/HrOperationsRepository';
import { SupabaseHrBudgetRepository } from './SupabaseHrBudgetRepository';
import { SupabaseHrOperationsRepository } from './SupabaseHrOperationsRepository';

let budgetRepository: HrBudgetRepository | undefined;
let operationsRepository: HrOperationsRepository | undefined;

export function getHrBudgetRepository(): HrBudgetRepository {
  if (budgetRepository) return budgetRepository;
  budgetRepository = new SupabaseHrBudgetRepository(getSupabaseClient());
  return budgetRepository;
}

export function getHrOperationsRepository(): HrOperationsRepository {
  if (operationsRepository) return operationsRepository;
  operationsRepository = new SupabaseHrOperationsRepository(getSupabaseClient());
  return operationsRepository;
}
