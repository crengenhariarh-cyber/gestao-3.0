import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { getFinanceRepositories } from '../../finance/infrastructure/createFinanceRepositories';
import { getHrBudgetRepository } from '../../hr/infrastructure/createHrRepositories';
import { currentHrCompetence } from '../../hr/ui/useHrBudgetOverview';

export interface HomeEntry {
  installmentId: string;
  entryType: 'income' | 'expense';
  description: string;
  counterpartyName: string | null;
  installmentNumber: number;
  installmentCount: number;
  dueDate: string;
  amount: number;
  companyName: string;
}

export interface HomeBudgetItem {
  companyId: string;
  companyName: string;
  costCenterId: string | null;
  costCenterName: string | null;
  plannedTotal: number;
  realizedTotal: number;
}

export interface HomeOverviewData {
  month: string;
  bankBalance: number;
  incomePlanned: number;
  incomeRealized: number;
  expensePlanned: number;
  expenseRealized: number;
  entries: readonly HomeEntry[];
  budgets: readonly HomeBudgetItem[];
}

type HomeOverviewState =
  | { status: 'idle' | 'loading'; data: HomeOverviewData | null; errorMessage: null }
  | { status: 'ready'; data: HomeOverviewData; errorMessage: null }
  | { status: 'error'; data: null; errorMessage: string };

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function companyName(company: CompanySummary): string {
  return company.tradeName ?? company.legalName;
}

export function useHomeOverview(companies: readonly CompanySummary[], refreshToken = 0): HomeOverviewState {
  const finance = useMemo(() => getFinanceRepositories(), []);
  const hr = useMemo(() => getHrBudgetRepository(), []);
  const companyKey = companies.map((company) => company.id).sort().join(',');
  const [state, setState] = useState<HomeOverviewState>({ status: 'idle', data: null, errorMessage: null });

  useEffect(() => {
    if (companies.length === 0) {
      setState({ status: 'idle', data: null, errorMessage: null });
      return;
    }

    let cancelled = false;
    const month = currentMonthStart();
    const hrMonth = currentHrCompetence().month;
    setState({ status: 'loading', data: null, errorMessage: null });

    void Promise.all(companies.map(async (company) => {
      const scope = { tenantId: company.tenantId, companyId: company.id };
      const [summary, balances, entries, budget] = await Promise.all([
        finance.monthly.summarize({ ...scope, competenceFrom: month, competenceTo: month }),
        finance.accounts.listBalances(scope),
        finance.entries.list(scope),
        hr.getOverview({ ...scope, competenceMonth: hrMonth, year: Number(hrMonth.slice(0, 4)) }),
      ]);
      return { company, summary, balances, entries, budget };
    }))
      .then((results) => {
        if (cancelled) return;
        let bankBalance = 0;
        let incomePlanned = 0;
        let incomeRealized = 0;
        let expensePlanned = 0;
        let expenseRealized = 0;
        const entries: HomeEntry[] = [];
        const budgets: HomeBudgetItem[] = [];

        results.forEach(({ company, summary, balances, entries: companyEntries, budget }) => {
          const label = companyName(company);
          bankBalance += balances.filter((item) => item.status === 'active').reduce((total, item) => total + item.currentBalance, 0);
          summary.forEach((item) => {
            if (item.entryType === 'income') { incomePlanned += item.plannedAmount; incomeRealized += item.realizedAmount; }
            else { expensePlanned += item.plannedAmount; expenseRealized += item.realizedAmount; }
          });
          companyEntries
            .filter((item) => item.competenceMonth.slice(0, 7) === month.slice(0, 7))
            .forEach((item) => entries.push({ installmentId: item.installmentId, entryType: item.entryType, description: item.description, counterpartyName: item.counterpartyName, installmentNumber: item.installmentNumber, installmentCount: item.installmentCount, dueDate: item.dueDate, amount: item.amount, companyName: label }));
          budget.monthlyBudget.forEach((item) => budgets.push({ companyId: company.id, companyName: label, costCenterId: item.costCenterId, costCenterName: item.costCenterName, plannedTotal: item.plannedTotal, realizedTotal: item.realizedTotal }));
        });

        setState({ status: 'ready', data: { month, bankBalance, incomePlanned, incomeRealized, expensePlanned, expenseRealized, entries, budgets }, errorMessage: null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', data: null, errorMessage: 'Não foi possível carregar a visão consolidada.' });
      });

    return () => { cancelled = true; };
  }, [finance, hr, companyKey, refreshToken, companies]);

  return state;
}
