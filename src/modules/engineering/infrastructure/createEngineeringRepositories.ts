import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import { SupabaseEngineeringOverviewRepository } from './SupabaseEngineeringOverviewRepository';

let overviewRepository: SupabaseEngineeringOverviewRepository | undefined;

export function getEngineeringOverviewRepository(): SupabaseEngineeringOverviewRepository {
  if (overviewRepository) return overviewRepository;
  overviewRepository = new SupabaseEngineeringOverviewRepository(getSupabaseClient());
  return overviewRepository;
}
