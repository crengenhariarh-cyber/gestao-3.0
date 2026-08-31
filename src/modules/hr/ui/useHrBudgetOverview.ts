import { useEffect, useMemo, useState } from 'react';
import type { HrBudgetOverview } from '../application/HrBudgetRepository';
import { getHrBudgetRepository } from '../infrastructure/createHrRepositories';

type HrBudgetOverviewState =
  | { status: 'idle' | 'loading'; data: HrBudgetOverview | null; errorMessage: null }
  | { status: 'ready'; data: HrBudgetOverview; errorMessage: null }
  | { status: 'error'; data: null; errorMessage: string };

const BUDGET_PROJECTION_START = '2026-09-01';

export function currentHrCompetence(): { month: string; year: number } {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const month = currentMonth < BUDGET_PROJECTION_START ? BUDGET_PROJECTION_START : currentMonth;
  return { month, year: Number(month.slice(0, 4)) };
}

export function useHrBudgetOverview(
  scope: { tenantId: string; companyId: string } | null,
  refreshToken = 0,
  selectedCompetenceMonth?: string,
): HrBudgetOverviewState {
  const repository = useMemo(() => getHrBudgetRepository(), []);
  const tenantId = scope?.tenantId ?? null;
  const companyId = scope?.companyId ?? null;
  const selectedMonth = selectedCompetenceMonth ?? currentHrCompetence().month;
  const [state, setState] = useState<HrBudgetOverviewState>({ status: 'idle', data: null, errorMessage: null });

  useEffect(() => {
    if (!tenantId || !companyId) {
      setState({ status: 'idle', data: null, errorMessage: null });
      return;
    }

    if (!/^\d{4}-\d{2}-01$/.test(selectedMonth)) {
      setState({ status: 'error', data: null, errorMessage: 'Competência inválida.' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading', data: null, errorMessage: null });

    void repository.getOverview({ tenantId, companyId, competenceMonth: selectedMonth, year: Number(selectedMonth.slice(0, 4)) })
      .then((data) => { if (!cancelled) setState({ status: 'ready', data, errorMessage: null }); })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', data: null, errorMessage: 'Não foi possível carregar RH e orçamento desta empresa.' });
      });

    return () => { cancelled = true; };
  }, [repository, tenantId, companyId, refreshToken, selectedMonth]);

  return state;
}
