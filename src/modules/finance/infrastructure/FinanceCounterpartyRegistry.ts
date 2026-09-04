import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export type FinanceCounterpartyKind = 'supplier' | 'payer' | 'both';
export type FinanceCounterparty = { id: string; tenantId: string; companyId: string; name: string; kind: FinanceCounterpartyKind; status: 'active' | 'inactive' };
const upper = (value: string) => value.trim().toLocaleUpperCase('pt-BR');

export async function listFinanceCounterparties(tenantId: string, companyId: string, kind: FinanceCounterpartyKind): Promise<readonly FinanceCounterparty[]> {
  const { data, error } = await getSupabaseClient().from('finance_counterparties').select('id,tenant_id,company_id,name,kind,status').eq('tenant_id', tenantId).eq('company_id', companyId).eq('status', 'active').in('kind', [kind, 'both']).order('name');
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), tenantId: String(row.tenant_id), companyId: String(row.company_id), name: String(row.name), kind: row.kind as FinanceCounterpartyKind, status: row.status as 'active' | 'inactive' }));
}

export async function createFinanceCounterparty(tenantId: string, companyId: string, rawName: string, kind: FinanceCounterpartyKind): Promise<FinanceCounterparty> {
  const name = upper(rawName);
  if (!name) throw new Error('Nome é obrigatório.');
  const client = getSupabaseClient();
  const { data: existing, error: lookupError } = await client.from('finance_counterparties').select('id,tenant_id,company_id,name,kind,status').eq('tenant_id', tenantId).eq('company_id', companyId).eq('name', name).in('kind', [kind, 'both']).maybeSingle();
  if (lookupError) throw lookupError;
  const row = existing ?? (await client.from('finance_counterparties').insert({ tenant_id: tenantId, company_id: companyId, name, kind }).select('id,tenant_id,company_id,name,kind,status').single()).data;
  if (!row) throw new Error('Não foi possível salvar o cadastro.');
  return { id: String(row.id), tenantId: String(row.tenant_id), companyId: String(row.company_id), name: String(row.name), kind: row.kind as FinanceCounterpartyKind, status: row.status as 'active' | 'inactive' };
}
