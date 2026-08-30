import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BudgetAnnualSummaryItem,
  BudgetMonthlySummaryItem,
  HrBudgetOverview,
  HrBudgetRepository,
  HrSalaryProjectionItem,
} from '../application/HrBudgetRepository';

type SalaryProjectionRow = {
  employment_contract_id: string;
  employee_id: string;
  employee_name: string;
  cost_center_id: string | null;
  allocation_percent: number | string;
  planned_salary: number | string;
  realized_salary: number | string;
  variance_amount: number | string;
  projection_status: string;
};

type MonthlyBudgetRow = {
  cost_center_id: string | null;
  cost_center_name: string | null;
  planned_manual: number | string;
  planned_salary: number | string;
  planned_total: number | string;
  realized_finance: number | string;
  realized_salary: number | string;
  realized_total: number | string;
  variance_amount: number | string;
};

type AnnualBudgetRow = {
  cost_center_id: string | null;
  cost_center_name: string | null;
  planned_total: number | string;
  realized_total: number | string;
  variance_amount: number | string;
  utilization_percent: number | string;
};

function mapSalary(row: SalaryProjectionRow): HrSalaryProjectionItem {
  return {
    employmentContractId: row.employment_contract_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    costCenterId: row.cost_center_id,
    allocationPercent: Number(row.allocation_percent),
    plannedSalary: Number(row.planned_salary),
    realizedSalary: Number(row.realized_salary),
    varianceAmount: Number(row.variance_amount),
    projectionStatus: row.projection_status,
  };
}

function mapMonthly(row: MonthlyBudgetRow): BudgetMonthlySummaryItem {
  return {
    costCenterId: row.cost_center_id,
    costCenterName: row.cost_center_name,
    plannedManual: Number(row.planned_manual),
    plannedSalary: Number(row.planned_salary),
    plannedTotal: Number(row.planned_total),
    realizedFinance: Number(row.realized_finance),
    realizedSalary: Number(row.realized_salary),
    realizedTotal: Number(row.realized_total),
    varianceAmount: Number(row.variance_amount),
  };
}

function mapAnnual(row: AnnualBudgetRow): BudgetAnnualSummaryItem {
  return {
    costCenterId: row.cost_center_id,
    costCenterName: row.cost_center_name,
    plannedTotal: Number(row.planned_total),
    realizedTotal: Number(row.realized_total),
    varianceAmount: Number(row.variance_amount),
    utilizationPercent: Number(row.utilization_percent),
  };
}

export class SupabaseHrBudgetRepository implements HrBudgetRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getOverview(input: {
    tenantId: string;
    companyId: string;
    competenceMonth: string;
    year: number;
  }): Promise<HrBudgetOverview> {
    const { tenantId, companyId, competenceMonth, year } = input;

    const [salaryResult, monthlyResult, annualResult] = await Promise.all([
      this.client.rpc('payroll_salary_projection', {
        p_tenant_id: tenantId,
        p_company_id: companyId,
        p_from_competence: competenceMonth,
        p_to_competence: competenceMonth,
      }),
      this.client.rpc('budget_monthly_summary', {
        p_tenant_id: tenantId,
        p_company_id: companyId,
        p_from_competence: competenceMonth,
        p_to_competence: competenceMonth,
      }),
      this.client.rpc('budget_annual_summary', {
        p_tenant_id: tenantId,
        p_company_id: companyId,
        p_year: year,
      }),
    ]);

    if (salaryResult.error) throw salaryResult.error;
    if (monthlyResult.error) throw monthlyResult.error;
    if (annualResult.error) throw annualResult.error;

    return {
      competenceMonth,
      salaryProjection: ((salaryResult.data ?? []) as SalaryProjectionRow[]).map(mapSalary),
      monthlyBudget: ((monthlyResult.data ?? []) as MonthlyBudgetRow[]).map(mapMonthly),
      annualBudget: ((annualResult.data ?? []) as AnnualBudgetRow[]).map(mapAnnual),
    };
  }
}
