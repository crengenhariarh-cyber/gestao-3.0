import type { EngineeringOverview } from '../domain/overview';

export interface EngineeringCompanyScope {
  tenantId: string;
  companyId: string;
}

export interface EngineeringOverviewRepository {
  load(scope: EngineeringCompanyScope): Promise<EngineeringOverview>;
}
