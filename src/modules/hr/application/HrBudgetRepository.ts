export interface HrSalaryProjectionItem {
  employmentContractId: string;
  employeeId: string;
  employeeName: string;
  costCenterId: string | null;
  allocationPercent: number;
  plannedSalary: number;
  realizedSalary: number;
  varianceAmount: number;
  projectionStatus: string;
}

export interface BudgetMonthlySummaryItem {
  costCenterId: string | null;
  costCenterName: string | null;
  plannedManual: number;
  plannedSalary: number;
  plannedTotal: number;
  realizedFinance: number;
  realizedSalary: number;
  realizedTotal: number;
  varianceAmount: number;
}

export interface BudgetAnnualSummaryItem {
  costCenterId: string | null;
  costCenterName: string | null;
  plannedTotal: number;
  realizedTotal: number;
  varianceAmount: number;
  utilizationPercent: number;
}

export interface HrBudgetOverview {
  competenceMonth: string;
  salaryProjection: readonly HrSalaryProjectionItem[];
  monthlyBudget: readonly BudgetMonthlySummaryItem[];
  annualBudget: readonly BudgetAnnualSummaryItem[];
}

export interface HrBudgetRepository {
  getOverview(input: {
    tenantId: string;
    companyId: string;
    competenceMonth: string;
    year: number;
  }): Promise<HrBudgetOverview>;
}
