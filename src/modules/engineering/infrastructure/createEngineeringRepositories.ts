import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import { SupabaseEngineeringOperationsRepository } from './SupabaseEngineeringOperationsRepository';
import { SupabaseEngineeringOverviewRepository } from './SupabaseEngineeringOverviewRepository';

let overviewRepository: SupabaseEngineeringOverviewRepository | undefined;
let operationsRepository: SupabaseEngineeringOperationsRepository | undefined;

export function getEngineeringOverviewRepository(): SupabaseEngineeringOverviewRepository {
  if (overviewRepository) return overviewRepository;
  overviewRepository = new SupabaseEngineeringOverviewRepository(getSupabaseClient());
  return overviewRepository;
}

export function getEngineeringOperationsRepository(): SupabaseEngineeringOperationsRepository {
  if (operationsRepository) return operationsRepository;
  operationsRepository = new SupabaseEngineeringOperationsRepository(getSupabaseClient());
  return operationsRepository;
}
