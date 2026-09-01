export type RegistryStatus = 'active' | 'inactive';
export type FinancialCategoryKind = 'income' | 'expense' | 'both';
export type FinancialAccountType = 'bank' | 'cash' | 'other';

export interface CompanyScope {
  tenantId: string;
  companyId: string;
}

export interface FinancialCategory extends CompanyScope {
  id: string;
  name: string;
  kind: FinancialCategoryKind;
  status: RegistryStatus;
}

export interface CostCenter extends CompanyScope {
  id: string;
  name: string;
  code: string | null;
  status: RegistryStatus;
}

export interface WorkReference extends CompanyScope {
  id: string;
  name: string;
  code: string | null;
  status: RegistryStatus;
}

export interface FinancialAccount extends CompanyScope {
  id: string;
  name: string;
  accountType: FinancialAccountType;
  openingBalance: number;
  status: RegistryStatus;
}

export interface CreateFinancialCategory extends CompanyScope {
  name: string;
  kind: FinancialCategoryKind;
}

export interface UpdateFinancialCategory extends CompanyScope {
  id: string;
  name: string;
  kind: FinancialCategoryKind;
  status: RegistryStatus;
}

export interface CreateCostCenter extends CompanyScope {
  name: string;
  code?: string | null;
}

export interface UpdateCostCenter extends CompanyScope {
  id: string;
  name: string;
  code?: string | null;
  status: RegistryStatus;
}

export interface CreateFinancialAccount extends CompanyScope {
  name: string;
  accountType: FinancialAccountType;
  openingBalance?: number;
}

export interface UpdateFinancialAccount extends CompanyScope {
  id: string;
  name: string;
  accountType: FinancialAccountType;
  status: RegistryStatus;
}
