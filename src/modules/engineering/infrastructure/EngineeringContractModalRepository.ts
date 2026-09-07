import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export type RetentionType = 'inss' | 'iss' | 'rt';

export interface RetentionValues {
  inss: number;
  iss: number;
  rt: number;
}

export interface AddendumSheetLine {
  id: string;
  description: string;
  unit: string;
  quantityDelta: number;
  unitPrice: number;
}

interface Scope {
  tenantId: string;
  companyId: string;
}

export async function loadContractRetentions(scope: Scope, contractId: string): Promise<RetentionValues> {
  const client = getSupabaseClient();
  const result = await client
    .from('engineering_contract_retention_rules')
    .select('retention_type,rate')
    .eq('tenant_id', scope.tenantId)
    .eq('company_id', scope.companyId)
    .eq('contract_id', contractId)
    .eq('active', true);
  if (result.error) throw result.error;
  const values: RetentionValues = { inss: 0, iss: 0, rt: 0 };
  for (const row of result.data ?? []) {
    const type = row.retention_type as RetentionType;
    if (type in values) values[type] = Number(row.rate ?? 0);
  }
  return values;
}

export async function saveContractRetentions(scope: Scope, contractId: string, values: RetentionValues) {
  const client = getSupabaseClient();
  const items: Array<{ type: RetentionType; rate: number; label: string }> = [
    { type: 'inss', rate: values.inss, label: 'INSS' },
    { type: 'iss', rate: values.iss, label: 'ISS' },
    { type: 'rt', rate: values.rt, label: 'Retenção técnica' },
  ];
  for (const item of items) {
    const existing = await client
      .from('engineering_contract_retention_rules')
      .select('id')
      .eq('tenant_id', scope.tenantId)
      .eq('company_id', scope.companyId)
      .eq('contract_id', contractId)
      .eq('retention_type', item.type)
      .eq('active', true)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (item.rate === 0) {
      if (existing.data?.id) {
        const disabled = await client
          .from('engineering_contract_retention_rules')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('tenant_id', scope.tenantId)
          .eq('company_id', scope.companyId)
          .eq('id', existing.data.id);
        if (disabled.error) throw disabled.error;
      }
      continue;
    }
    if (existing.data?.id) {
      const updated = await client
        .from('engineering_contract_retention_rules')
        .update({ calculation_type: 'percentage', rate: item.rate, fixed_amount: null, updated_at: new Date().toISOString() })
        .eq('tenant_id', scope.tenantId)
        .eq('company_id', scope.companyId)
        .eq('id', existing.data.id);
      if (updated.error) throw updated.error;
    } else {
      const inserted = await client.from('engineering_contract_retention_rules').insert({
        tenant_id: scope.tenantId,
        company_id: scope.companyId,
        contract_id: contractId,
        retention_type: item.type,
        calculation_type: 'percentage',
        rate: item.rate,
        fixed_amount: null,
        description: item.label,
        active: true,
      });
      if (inserted.error) throw inserted.error;
    }
  }
}

export async function loadAddendumSheetLines(scope: Scope, addendumId: string): Promise<AddendumSheetLine[]> {
  const client = getSupabaseClient();
  const result = await client
    .from('contract_addendum_lines')
    .select('id,description,unit,quantity_delta,unit_price')
    .eq('tenant_id', scope.tenantId)
    .eq('company_id', scope.companyId)
    .eq('addendum_id', addendumId)
    .order('created_at', { ascending: true });
  if (result.error) throw result.error;
  return (result.data ?? []).map(row => ({
    id: String(row.id),
    description: String(row.description ?? ''),
    unit: String(row.unit ?? ''),
    quantityDelta: Number(row.quantity_delta ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
  }));
}
