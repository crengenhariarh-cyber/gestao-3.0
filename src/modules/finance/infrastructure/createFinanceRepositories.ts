import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { FinanceMonthlyRepository } from '../application/FinanceMonthlyRepository';
import type { FinancialAccountRepository } from '../application/FinancialAccountRepository';
import type { CardRepository } from '../application/CardRepository';
import type { FinancialEntryRepository } from '../application/FinancialEntryRepository';
import { SupabaseFinanceMonthlyRepository } from './SupabaseFinanceMonthlyRepository';
import { SupabaseFinancialAccountRepository } from './SupabaseFinancialAccountRepository';
import { SupabaseCardRepository } from './SupabaseCardRepository';
import { SupabaseFinancialEntryRepository } from './SupabaseFinancialEntryRepository';

export interface FinanceRepositories {
  monthly: FinanceMonthlyRepository;
  accounts: FinancialAccountRepository;
  cards: CardRepository;
  entries: FinancialEntryRepository;
}

let repositories: FinanceRepositories | undefined;

export function getFinanceRepositories(): FinanceRepositories {
  if (repositories) return repositories;

  const client = getSupabaseClient();
  repositories = {
    monthly: new SupabaseFinanceMonthlyRepository(client),
    accounts: new SupabaseFinancialAccountRepository(client),
    cards: new SupabaseCardRepository(client),
    entries: new SupabaseFinancialEntryRepository(client),
  };

  return repositories;
}
