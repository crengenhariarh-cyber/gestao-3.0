import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { CardRepository } from '../application/CardRepository';
import type { FinanceMonthlyRepository } from '../application/FinanceMonthlyRepository';
import type { FinanceRegistryRepository } from '../application/FinanceRegistryRepository';
import type { FinancialAccountRepository } from '../application/FinancialAccountRepository';
import type { FinancialEntryRepository } from '../application/FinancialEntryRepository';
import type { FinancialRecurrenceRepository } from '../application/FinancialRecurrenceRepository';
import type { FinancialSettlementRepository } from '../application/FinancialSettlementRepository';
import { SupabaseCardRepository } from './SupabaseCardRepository';
import { SupabaseFinanceMonthlyRepository } from './SupabaseFinanceMonthlyRepository';
import { SupabaseFinanceRegistryRepository } from './SupabaseFinanceRegistryRepository';
import { SupabaseFinancialAccountRepository } from './SupabaseFinancialAccountRepository';
import { SupabaseFinancialEntryRepository } from './SupabaseFinancialEntryRepository';
import { SupabaseFinancialRecurrenceRepository } from './SupabaseFinancialRecurrenceRepository';
import { SupabaseFinancialSettlementRepository } from './SupabaseFinancialSettlementRepository';

export interface FinanceRepositories {
  monthly: FinanceMonthlyRepository;
  registries: FinanceRegistryRepository;
  accounts: FinancialAccountRepository;
  cards: CardRepository;
  entries: FinancialEntryRepository;
  settlements: FinancialSettlementRepository;
  recurrences: FinancialRecurrenceRepository;
}

let repositories: FinanceRepositories | undefined;

export function getFinanceRepositories(): FinanceRepositories {
  if (repositories) return repositories;

  const client = getSupabaseClient();
  repositories = {
    monthly: new SupabaseFinanceMonthlyRepository(client),
    registries: new SupabaseFinanceRegistryRepository(client),
    accounts: new SupabaseFinancialAccountRepository(client),
    cards: new SupabaseCardRepository(client),
    entries: new SupabaseFinancialEntryRepository(client),
    settlements: new SupabaseFinancialSettlementRepository(client),
    recurrences: new SupabaseFinancialRecurrenceRepository(client),
  };

  return repositories;
}
