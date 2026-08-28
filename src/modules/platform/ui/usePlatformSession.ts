import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '../application/AuthGateway';
import type { AccessContext, CompanySummary } from '../domain/AccessContext';
import {
  flattenAuthorizedCompanies,
  isCompanyAuthorized,
  resolveActiveCompanyId,
} from '../application/companyContext';
import { SupabaseAccessRepository } from '../infrastructure/SupabaseAccessRepository';
import { SupabaseAuthGateway } from '../infrastructure/SupabaseAuthGateway';

type SessionStatus = 'loading' | 'anonymous' | 'ready' | 'error';

export interface PlatformSession {
  status: SessionStatus;
  user: AuthUser | null;
  contexts: readonly AccessContext[];
  companies: readonly CompanySummary[];
  activeCompanyId: string | null;
  errorMessage: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectCompany: (companyId: string) => void;
}

export function usePlatformSession(): PlatformSession {
  const authGateway = useMemo(() => new SupabaseAuthGateway(), []);
  const accessRepository = useMemo(() => new SupabaseAccessRepository(), []);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [contexts, setContexts] = useState<readonly AccessContext[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hydrateAccess = useCallback(async () => {
    const currentUser = await authGateway.getCurrentUser();

    if (!currentUser) {
      setUser(null);
      setContexts([]);
      setActiveCompanyId(null);
      setStatus('anonymous');
      return;
    }

    const nextContexts = await accessRepository.listContextsForCurrentUser();
    const nextCompanies = flattenAuthorizedCompanies(nextContexts);

    setUser(currentUser);
    setContexts(nextContexts);
    setActiveCompanyId((current) => resolveActiveCompanyId(nextCompanies, current));
    setErrorMessage(null);
    setStatus('ready');
  }, [accessRepository, authGateway]);

  useEffect(() => {
    void hydrateAccess().catch(() => {
      setErrorMessage('Não foi possível carregar a sessão.');
      setStatus('error');
    });
  }, [hydrateAccess]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setStatus('loading');
      setErrorMessage(null);

      try {
        await authGateway.signInWithPassword(email, password);
        await hydrateAccess();
      } catch {
        setErrorMessage('E-mail ou senha inválidos, ou acesso indisponível.');
        setStatus('anonymous');
      }
    },
    [authGateway, hydrateAccess],
  );

  const signOut = useCallback(async () => {
    await authGateway.signOut();
    setUser(null);
    setContexts([]);
    setActiveCompanyId(null);
    setErrorMessage(null);
    setStatus('anonymous');
  }, [authGateway]);

  const companies = flattenAuthorizedCompanies(contexts);

  const selectCompany = useCallback(
    (companyId: string) => {
      if (!isCompanyAuthorized(companies, companyId)) {
        return;
      }

      setActiveCompanyId(companyId);
    },
    [companies],
  );

  return {
    status,
    user,
    contexts,
    companies,
    activeCompanyId,
    errorMessage,
    signIn,
    signOut,
    selectCompany,
  };
}
