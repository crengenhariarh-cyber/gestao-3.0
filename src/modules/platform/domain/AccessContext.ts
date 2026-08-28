export type TenantRole =
  | 'tenant_owner'
  | 'tenant_admin'
  | 'manager'
  | 'operator'
  | 'viewer';

export interface TenantMembership {
  tenantId: string;
  role: TenantRole;
}

export interface CompanySummary {
  id: string;
  tenantId: string;
  legalName: string;
  tradeName: string | null;
}

export interface AccessContext {
  tenant: TenantMembership;
  companies: readonly CompanySummary[];
}
