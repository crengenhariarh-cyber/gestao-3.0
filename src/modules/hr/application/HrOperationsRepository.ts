export interface CompanyScope { tenantId: string; companyId: string; }

export interface HrReferenceItem { id: string; name: string; status: 'active' | 'inactive'; }
export type EmploymentType = 'clt' | 'pj' | 'autonomo' | 'temporario' | 'estagio' | 'prestador' | 'outro';

export interface HrEmployeeRow {
  employeeId: string;
  employmentContractId: string;
  fullName: string;
  cpf: string | null;
  pix: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  jobTitle: string;
  sector: string | null;
  supervisor: string | null;
  employmentType: EmploymentType;
  weeklyHours: number;
  bankHoursEnabled: boolean;
  hiredOn: string;
  terminatedOn: string | null;
  contractStatus: 'active' | 'terminated';
  baseSalary: number;
  costCenterId: string | null;
  costCenterName: string | null;
  allocationPercent: number | null;
}

export interface PayrollEventRow {
  id: string;
  employmentContractId: string;
  employeeName: string;
  competenceMonth: string;
  eventKind: 'benefit' | 'advance' | 'overtime' | 'absence' | 'dsr' | 'adjustment_earning' | 'adjustment_deduction';
  amount: number;
  description: string | null;
  status: 'active' | 'voided';
}

export interface PayrollClosingRow {
  id: string;
  employmentContractId: string;
  employeeName: string;
  competenceMonth: string;
  grossAmount: number;
  netBeforeStatutory: number;
  inssAmount: number;
  irrfAmount: number;
  fgtsAmount: number;
  status: 'closed' | 'reopened';
}

export interface BudgetLimitRow {
  id: string;
  competenceMonth: string;
  costCenterId: string | null;
  costCenterName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  limitAmount: number;
  warningPercent: number;
  status: 'active' | 'inactive';
}

export interface HrOperationalSnapshot {
  employees: readonly HrEmployeeRow[];
  payrollEvents: readonly PayrollEventRow[];
  payrollClosings: readonly PayrollClosingRow[];
  budgetLimits: readonly BudgetLimitRow[];
  costCenters: readonly HrReferenceItem[];
  categories: readonly HrReferenceItem[];
}

export interface EmployeeProfileInput {
  fullName: string;
  jobTitle: string;
  cpf?: string | null;
  pix?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  employmentType?: EmploymentType;
  sector?: string | null;
  supervisor?: string | null;
  weeklyHours?: number;
  bankHoursEnabled?: boolean;
}

export interface CreateEmployeeBundleInput extends CompanyScope, EmployeeProfileInput {
  hiredOn: string;
  baseSalary: number;
  costCenterId?: string | null;
  allocationPercent?: number;
}

export interface RecordPayrollEventInput extends CompanyScope {
  employmentContractId: string;
  costCenterId?: string | null;
  competenceMonth: string;
  occurredOn?: string | null;
  eventKind: PayrollEventRow['eventKind'];
  quantity?: number | null;
  unitValue?: number | null;
  amount: number;
  description?: string | null;
  idempotencyKey: string;
}

export interface UpsertBudgetInput extends CompanyScope {
  costCenterId?: string | null;
  categoryId?: string | null;
  competenceMonth: string;
  amount: number;
  notes?: string | null;
}

export interface UpsertBudgetLimitInput extends UpsertBudgetInput {
  warningPercent: number;
}

export interface HrOperationsRepository {
  getSnapshot(scope: CompanyScope, competenceMonth: string): Promise<HrOperationalSnapshot>;
  createEmployeeBundle(input: CreateEmployeeBundleInput): Promise<void>;
  updateEmployeeProfile(scope: CompanyScope, employmentContractId: string, input: EmployeeProfileInput): Promise<void>;
  changeSalary(scope: CompanyScope, employmentContractId: string, effectiveFrom: string, baseSalary: number): Promise<void>;
  changeAllocation(scope: CompanyScope, employmentContractId: string, effectiveFrom: string, costCenterId: string, allocationPercent: number): Promise<void>;
  terminateContract(scope: CompanyScope, employmentContractId: string, terminatedOn: string): Promise<void>;
  recordPayrollEvent(input: RecordPayrollEventInput): Promise<void>;
  voidPayrollEvent(scope: CompanyScope, payrollEventId: string, reason: string): Promise<void>;
  closePayroll(scope: CompanyScope, employmentContractId: string, competenceMonth: string, idempotencyKey: string): Promise<void>;
  calculateStatutory(scope: CompanyScope, payrollClosingId: string, dependents: number, otherLegalDeductions: number): Promise<void>;
  reopenPayroll(scope: CompanyScope, payrollClosingId: string, reason: string): Promise<void>;
  configurePayrollFinance(scope: CompanyScope, salaryCategoryId: string, fgtsCategoryId: string, inssCategoryId: string, irrfCategoryId: string): Promise<void>;
  syncPayrollPayables(scope: CompanyScope, competenceMonth: string, salaryDueDate: string, fgtsDueDate: string, inssDueDate: string, irrfDueDate: string): Promise<void>;
  upsertBudgetPlan(input: UpsertBudgetInput): Promise<void>;
  upsertBudgetLimit(input: UpsertBudgetLimitInput): Promise<void>;
}
