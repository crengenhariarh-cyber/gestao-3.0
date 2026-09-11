import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { PersonalSettlementsRepository } from '../application/PersonalSettlementsRepository';
import { SupabasePersonalSettlementsRepository } from './SupabasePersonalSettlementsRepository';

let repository:PersonalSettlementsRepository|undefined;
export function getPersonalSettlementsRepository():PersonalSettlementsRepository{
  if(repository)return repository;
  repository=new SupabasePersonalSettlementsRepository(getSupabaseClient());
  return repository;
}
