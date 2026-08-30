import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { HrBudgetRepository } from '../application/HrBudgetRepository';
import { SupabaseHrBudgetRepository } from './SupabaseHrBudgetRepository';

let repository: HrBudgetRepository | undefined;

export function getHrBudgetRepository(): HrBudgetRepository {
  if (repository) return repository;
  repository = new SupabaseHrBudgetRepository(getSupabaseClient());
  return repository;
}
