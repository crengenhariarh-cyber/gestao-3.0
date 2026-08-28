import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

type SupabaseEnvironmentKey =
  | 'VITE_SUPABASE_URL'
  | 'VITE_SUPABASE_PUBLISHABLE_KEY';

function readEnvironmentValue(key: SupabaseEnvironmentKey): string {
  const environment: unknown = import.meta.env;

  if (typeof environment !== 'object' || environment === null) {
    throw new Error('Application environment is not available.');
  }

  const value = (environment as Record<string, unknown>)[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Required environment variable ${key} is not configured.`);
  }

  return value;
}

export function getSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const url = readEnvironmentValue('VITE_SUPABASE_URL');
  const publishableKey = readEnvironmentValue('VITE_SUPABASE_PUBLISHABLE_KEY');

  client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}
