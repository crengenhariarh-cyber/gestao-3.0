import type {
  CompanyScope,
  CostCenter,
  CreateCostCenter,
  CreateFinancialAccount,
  CreateFinancialCategory,
  FinancialAccount,
  FinancialCategory,
} from '../domain/registries';

export interface FinanceRegistryRepository {
  listCategories(scope: CompanyScope): Promise<readonly FinancialCategory[]>;
  createCategory(input: CreateFinancialCategory): Promise<FinancialCategory>;

  listCostCenters(scope: CompanyScope): Promise<readonly CostCenter[]>;
  createCostCenter(input: CreateCostCenter): Promise<CostCenter>;

  listAccounts(scope: CompanyScope): Promise<readonly FinancialAccount[]>;
  createAccount(input: CreateFinancialAccount): Promise<FinancialAccount>;
}
