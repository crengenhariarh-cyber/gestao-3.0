import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { AuthGateway, AuthUser, BootstrapSignUpResult } from '../application/AuthGateway';

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
  };
}

export class SupabaseAuthGateway implements AuthGateway {
  async getCurrentUser(): Promise<AuthUser | null> {
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!sessionData.session) {
      return null;
    }

    const { data, error } = await client.auth.getUser();

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

  async signUpFirstOwner(input: {
    email: string;
    password: string;
    bootstrapCode: string;
    tenantName: string;
    companyName: string;
  }): Promise<BootstrapSignUpResult> {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          gestao_bootstrap: 'true',
          gestao_bootstrap_code: input.bootstrapCode,
          gestao_tenant_name: input.tenantName,
          gestao_company_name: input.companyName,
        },
      },
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Supabase não retornou o usuário criado.');
    }

    return {
      user: toAuthUser(data.user),
      sessionCreated: data.session !== null,
    };
  }

  async signOut(): Promise<void> {
    const { error } = await getSupabaseClient().auth.signOut();

    if (error) {
      throw error;
    }
  }
}
