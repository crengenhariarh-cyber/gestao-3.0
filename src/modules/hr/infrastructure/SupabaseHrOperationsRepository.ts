import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BudgetLimitRow,
  CompanyScope,
  CreateEmployeeBundleInput,
  HrOperationalSnapshot,
  HrOperationsRepository,
  PayrollClosingRow,
  PayrollEventRow,
  RecordPayrollEventInput,
  UpsertBudgetInput,
  UpsertBudgetLimitInput,
} from '../application/HrOperationsRepository';

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}
function amount(value: number, field: string, allowZero = false): number {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0) || Math.round(value * 100) !== value * 100) throw new Error(`${field} has an invalid value`);
  return value;
}
function month(value: string): string {
  const normalized = required(value, 'competenceMonth');
  if (!/^\d{4}-\d{2}-01$/.test(normalized)) throw new Error('competenceMonth must be the first day of the month');
  return normalized;
}

export class SupabaseHrOperationsRepository implements HrOperationsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getSnapshot(scope: CompanyScope, competenceMonth: string): Promise<HrOperationalSnapshot> {
    const competence = month(competenceMonth);
    const [contractsResult, compensationResult, allocationResult, eventResult, closingResult, statutoryResult, limitsResult, costCentersResult, categoriesResult] = await Promise.all([
      this.client.from('employment_contracts').select('id,employee_id,hired_on,terminated_on,job_title,status,employees!inner(id,full_name)').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('hired_on', { ascending: false }),
      this.client.from('compensation_terms').select('employment_contract_id,valid_from,valid_to,base_salary').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).lte('valid_from', competence).or(`valid_to.is.null,valid_to.gte.${competence}`).order('valid_from', { ascending: false }),
      this.client.from('employee_allocations').select('employment_contract_id,cost_center_id,valid_from,valid_to,allocation_percent,cost_centers!inner(id,name)').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).lte('valid_from', competence).or(`valid_to.is.null,valid_to.gte.${competence}`),
      this.client.from('payroll_events').select('id,employment_contract_id,competence_month,event_kind,amount,description,status,employment_contracts!inner(employees!inner(full_name))').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('competence_month', competence).order('created_at', { ascending: false }),
      this.client.from('payroll_closings').select('id,employment_contract_id,competence_month,gross_snapshot,net_before_statutory_snapshot,status,employment_contracts!inner(employees!inner(full_name))').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('competence_month', competence).order('closed_at', { ascending: false }),
      this.client.from('payroll_statutory_calculations').select('payroll_closing_id,inss_amount,irrf_amount,fgts_amount').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('competence_month', competence),
      this.client.from('budget_limits').select('id,competence_month,cost_center_id,category_id,limit_amount,warning_percent,status,cost_centers(name),financial_categories(name)').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('competence_month', competence).order('created_at'),
      this.client.from('cost_centers').select('id,name,status').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('name'),
      this.client.from('financial_categories').select('id,name,status').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('name'),
    ]);
    const errors = [contractsResult.error, compensationResult.error, allocationResult.error, eventResult.error, closingResult.error, statutoryResult.error, limitsResult.error, costCentersResult.error, categoriesResult.error].filter(Boolean);
    if (errors[0]) throw errors[0];

    const compensations = new Map<string, number>();
    for (const row of compensationResult.data ?? []) if (!compensations.has(row.employment_contract_id)) compensations.set(row.employment_contract_id, Number(row.base_salary));
    const allocations = new Map<string, { costCenterId: string; costCenterName: string; allocationPercent: number }>();
    for (const row of allocationResult.data ?? []) {
      if (!allocations.has(row.employment_contract_id)) allocations.set(row.employment_contract_id, {
        costCenterId: row.cost_center_id,
        costCenterName: (row.cost_centers as unknown as { name: string }).name,
        allocationPercent: Number(row.allocation_percent),
      });
    }
    const employees = (contractsResult.data ?? []).map((row) => {
      const allocation = allocations.get(row.id);
      return {
        employeeId: row.employee_id,
        employmentContractId: row.id,
        fullName: (row.employees as unknown as { id: string; full_name: string }).full_name,
        jobTitle: row.job_title,
        hiredOn: row.hired_on,
        terminatedOn: row.terminated_on,
        contractStatus: row.status as 'active' | 'terminated',
        baseSalary: compensations.get(row.id) ?? 0,
        costCenterId: allocation?.costCenterId ?? null,
        costCenterName: allocation?.costCenterName ?? null,
        allocationPercent: allocation?.allocationPercent ?? null,
      };
    });
    const payrollEvents: PayrollEventRow[] = (eventResult.data ?? []).map((row) => ({
      id: row.id,
      employmentContractId: row.employment_contract_id,
      employeeName: ((row.employment_contracts as unknown as { employees: { full_name: string } }).employees).full_name,
      competenceMonth: row.competence_month,
      eventKind: row.event_kind as PayrollEventRow['eventKind'],
      amount: Number(row.amount),
      description: row.description,
      status: row.status as PayrollEventRow['status'],
    }));
    const statutory = new Map((statutoryResult.data ?? []).map((row) => [row.payroll_closing_id, row]));
    const payrollClosings: PayrollClosingRow[] = (closingResult.data ?? []).map((row) => {
      const taxes = statutory.get(row.id);
      return {
        id: row.id,
        employmentContractId: row.employment_contract_id,
        employeeName: ((row.employment_contracts as unknown as { employees: { full_name: string } }).employees).full_name,
        competenceMonth: row.competence_month,
        grossAmount: Number(row.gross_snapshot),
        netBeforeStatutory: Number(row.net_before_statutory_snapshot),
        inssAmount: Number(taxes?.inss_amount ?? 0),
        irrfAmount: Number(taxes?.irrf_amount ?? 0),
        fgtsAmount: Number(taxes?.fgts_amount ?? 0),
        status: row.status as PayrollClosingRow['status'],
      };
    });
    const budgetLimits: BudgetLimitRow[] = (limitsResult.data ?? []).map((row) => ({
      id: row.id,
      competenceMonth: row.competence_month,
      costCenterId: row.cost_center_id,
      costCenterName: row.cost_centers ? (row.cost_centers as unknown as { name: string }).name : null,
      categoryId: row.category_id,
      categoryName: row.financial_categories ? (row.financial_categories as unknown as { name: string }).name : null,
      limitAmount: Number(row.limit_amount),
      warningPercent: Number(row.warning_percent),
      status: row.status as BudgetLimitRow['status'],
    }));
    const costCenters = (costCentersResult.data ?? []).map((row) => ({ id: row.id, name: row.name, status: row.status as 'active' | 'inactive' }));
    const categories = (categoriesResult.data ?? []).map((row) => ({ id: row.id, name: row.name, status: row.status as 'active' | 'inactive' }));
    return { employees, payrollEvents, payrollClosings, budgetLimits, costCenters, categories };
  }

  async createEmployeeBundle(input: CreateEmployeeBundleInput): Promise<void> {
    amount(input.baseSalary, 'baseSalary', true);
    const result = await this.client.rpc('create_hr_employee_bundle', {
      p_tenant_id: input.tenantId, p_company_id: input.companyId, p_full_name: required(input.fullName, 'fullName'), p_hired_on: required(input.hiredOn, 'hiredOn'), p_job_title: required(input.jobTitle, 'jobTitle'), p_base_salary: input.baseSalary, p_cost_center_id: input.costCenterId ?? null, p_allocation_percent: input.allocationPercent ?? 100,
    });
    if (result.error) throw result.error;
  }
  async changeSalary(scope: CompanyScope, employmentContractId: string, effectiveFrom: string, baseSalary: number): Promise<void> {
    amount(baseSalary, 'baseSalary', true);
    const result = await this.client.rpc('change_employee_salary', { p_tenant_id: scope.tenantId, p_company_id: scope.companyId, p_employment_contract_id: employmentContractId, p_effective_from: effectiveFrom, p_base_salary: baseSalary });
    if (result.error) throw result.error;
  }
  async terminateContract(scope: CompanyScope, employmentContractId: string, terminatedOn: string): Promise<void> {
    const result = await this.client.rpc('terminate_employment_contract', { p_tenant_id: scope.tenantId, p_company_id: scope.companyId, p_employment_contract_id: employmentContractId, p_terminated_on: terminatedOn });
    if (result.error) throw result.error;
  }
  async recordPayrollEvent(input: RecordPayrollEventInput): Promise<void> {
    amount(input.amount, 'amount', true);
    const result = await this.client.rpc('record_payroll_event', { p_tenant_id: input.tenantId, p_company_id: input.companyId, p_employment_contract_id: input.employmentContractId, p_cost_center_id: input.costCenterId ?? null, p_competence_month: month(input.competenceMonth), p_occurred_on: input.occurredOn ?? null, p_event_kind: input.eventKind, p_quantity: input.quantity ?? null, p_unit_value: input.unitValue ?? null, p_amount: input.amount, p_description: input.description ?? null, p_idempotency_key: required(input.idempotencyKey, 'idempotencyKey') });
    if (result.error) throw result.error;
  }
  async closePayroll(scope: CompanyScope, employmentContractId: string, competenceMonth: string, idempotencyKey: string): Promise<void> {
    const result = await this.client.rpc('close_payroll', { p_tenant_id: scope.tenantId, p_company_id: scope.companyId, p_employment_contract_id: employmentContractId, p_competence_month: month(competenceMonth), p_idempotency_key: idempotencyKey });
    if (result.error) throw result.error;
  }
  async calculateStatutory(scope: CompanyScope, payrollClosingId: string, dependents: number, otherLegalDeductions: number): Promise<void> {
    const result = await this.client.rpc('calculate_payroll_statutory', { p_tenant_id: scope.tenantId, p_company_id: scope.companyId, p_payroll_closing_id: payrollClosingId, p_dependents: dependents, p_other_legal_deductions: otherLegalDeductions });
    if (result.error) throw result.error;
  }
  async reopenPayroll(scope: CompanyScope, payrollClosingId: string, reason: string): Promise<void> {
    const result = await this.client.rpc('reopen_payroll', { p_tenant_id: scope.tenantId, p_company_id: scope.companyId, p_payroll_closing_id: payrollClosingId, p_reason: required(reason, 'reason') });
    if (result.error) throw result.error;
  }
  async syncPayrollPayables(scope: CompanyScope, competenceMonth: string, salaryDueDate: string, fgtsDueDate: string, inssDueDate: string, irrfDueDate: string): Promise<void> {
    const result = await this.client.rpc('sync_payroll_accounts_payable', { p_tenant_id: scope.tenantId, p_company_id: scope.companyId, p_competence_month: month(competenceMonth), p_salary_due_date: salaryDueDate, p_fgts_due_date: fgtsDueDate, p_inss_due_date: inssDueDate, p_irrf_due_date: irrfDueDate });
    if (result.error) throw result.error;
  }
  async upsertBudgetPlan(input: UpsertBudgetInput): Promise<void> {
    amount(input.amount, 'amount', true);
    const result = await this.client.rpc('upsert_budget_plan', { p_tenant_id: input.tenantId, p_company_id: input.companyId, p_cost_center_id: input.costCenterId ?? null, p_category_id: input.categoryId ?? null, p_competence_month: month(input.competenceMonth), p_planned_amount: input.amount, p_notes: input.notes ?? null });
    if (result.error) throw result.error;
  }
  async upsertBudgetLimit(input: UpsertBudgetLimitInput): Promise<void> {
    amount(input.amount, 'amount', true);
    const result = await this.client.rpc('upsert_budget_limit', { p_tenant_id: input.tenantId, p_company_id: input.companyId, p_cost_center_id: input.costCenterId ?? null, p_category_id: input.categoryId ?? null, p_competence_month: month(input.competenceMonth), p_limit_amount: input.amount, p_warning_percent: input.warningPercent, p_notes: input.notes ?? null });
    if (result.error) throw result.error;
  }
}
