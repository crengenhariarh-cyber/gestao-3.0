import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { AuthGateway, AuthUser } from '../application/AuthGateway';

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
  };
}

export class SupabaseAuthGateway implements AuthGateway {
  async getCurrentUser(): Promise<AuthUser | null> {
    const { data, error } = await getSupabaseClient().auth.getUser();

    if (error) {
      throw error;
    }

    return data.user ? toAuthUser(data.user) : null;
  }

  async signInWithPassword(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return toAuthUser(data.user);
  }

  async signOut(): Promise<void> {
    const { error } = await getSupabaseClient().auth.signOut();

    if (error) {
      throw error;
    }
  }
}
