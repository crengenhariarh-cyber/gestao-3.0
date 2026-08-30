import { useEffect, useMemo, useState } from 'react';
import type { HrBudgetOverview } from '../application/HrBudgetRepository';
import { getHrBudgetRepository } from '../infrastructure/createHrRepositories';

type HrBudgetOverviewState =
  | { status: 'idle' | 'loading'; data: HrBudgetOverview | null; errorMessage: null }
  | { status: 'ready'; data: HrBudgetOverview; errorMessage: null }
  | { status: 'error'; data: null; errorMessage: string };

function currentCompetence(): { month: string; year: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return { month: `${year}-${month}-01`, year };
}

export function useHrBudgetOverview(scope: { tenantId: string; companyId: string } | null): HrBudgetOverviewState {
  const repository = useMemo(() => getHrBudgetRepository(), []);
  const tenantId = scope?.tenantId ?? null;
  const companyId = scope?.companyId ?? null;
  const [state, setState] = useState<HrBudgetOverviewState>({ status: 'idle', data: null, errorMessage: null });

  useEffect(() => {
    if (!tenantId || !companyId) {
      setState({ status: 'idle', data: null, errorMessage: null });
      return;
    }

    const competence = currentCompetence();
    let cancelled = false;
    setState({ status: 'loading', data: null, errorMessage: null });

    void repository.getOverview({
      tenantId,
      companyId,
      competenceMonth: competence.month,
      year: competence.year,
    }).then((data) => {
      if (!cancelled) setState({ status: 'ready', data, errorMessage: null });
    }).catch(() => {
      if (!cancelled) {
        setState({
          status: 'error',
          data: null,
          errorMessage: 'Não foi possível carregar RH e orçamento desta empresa.',
        });
      }
    });

    return () => { cancelled = true; };
  }, [repository, tenantId, companyId]);

  return state;
}
