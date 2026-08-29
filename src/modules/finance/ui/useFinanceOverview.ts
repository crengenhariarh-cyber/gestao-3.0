import { useEffect, useMemo, useState } from 'react';
import type { CompanyScope } from '../domain/registries';
import type { FinanceMonthlySummary } from '../domain/monthly';
import type { FinancialAccountBalance } from '../domain/accounts';
import type { CreditCardLimit } from '../domain/cards';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';

interface FinanceOverviewData {
  month: string;
  summary: readonly FinanceMonthlySummary[];
  accountBalances: readonly FinancialAccountBalance[];
  cardLimits: readonly CreditCardLimit[];
}

type FinanceOverviewState =
  | { status: 'idle' | 'loading'; data: FinanceOverviewData | null; errorMessage: null }
  | { status: 'ready'; data: FinanceOverviewData; errorMessage: null }
  | { status: 'error'; data: null; errorMessage: string };

function currentMonthStart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function useFinanceOverview(scope: CompanyScope | null): FinanceOverviewState {
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const [state, setState] = useState<FinanceOverviewState>({
    status: 'idle',
    data: null,
    errorMessage: null,
  });

  useEffect(() => {
    if (!scope) {
      setState({ status: 'idle', data: null, errorMessage: null });
      return;
    }

    let cancelled = false;
    const month = currentMonthStart();
    setState({ status: 'loading', data: null, errorMessage: null });

    void Promise.all([
      repositories.monthly.summarize({
        ...scope,
        competenceFrom: month,
        competenceTo: month,
      }),
      repositories.accounts.listBalances(scope),
      repositories.cards.listLimits(scope),
    ])
      .then(([summary, accountBalances, cardLimits]) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          data: { month, summary, accountBalances, cardLimits },
          errorMessage: null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          status: 'error',
          data: null,
          errorMessage: 'Não foi possível carregar a visão financeira desta empresa.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [repositories, scope?.companyId, scope?.tenantId]);

  return state;
}
