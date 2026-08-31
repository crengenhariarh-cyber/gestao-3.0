import type {
  CompanyScope,
  CostCenter,
  CreateCostCenter,
  CreateFinancialAccount,
  CreateFinancialCategory,
  FinancialAccount,
  FinancialCategory,
  UpdateCostCenter,
  UpdateFinancialAccount,
  UpdateFinancialCategory,
} from '../domain/registries';

export interface FinanceRegistryRepository {
  listCategories(scope: CompanyScope): Promise<readonly FinancialCategory[]>;
  createCategory(input: CreateFinancialCategory): Promise<FinancialCategory>;
  updateCategory(input: UpdateFinancialCategory): Promise<FinancialCategory>;

  listCostCenters(scope: CompanyScope): Promise<readonly CostCenter[]>;
  createCostCenter(input: CreateCostCenter): Promise<CostCenter>;
  updateCostCenter(input: UpdateCostCenter): Promise<CostCenter>;

  listAccounts(scope: CompanyScope): Promise<readonly FinancialAccount[]>;
  createAccount(input: CreateFinancialAccount): Promise<FinancialAccount>;
  updateAccount(input: UpdateFinancialAccount): Promise<FinancialAccount>;
}
