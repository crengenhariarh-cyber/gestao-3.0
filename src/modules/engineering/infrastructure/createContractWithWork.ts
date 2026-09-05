import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface CreateContractWithWorkScope {
  tenantId: string;
  companyId: string;
}

export interface CreateContractWithWorkInput {
  workName: string;
  contractNumber: string;
  clientName?: string | null;
  signedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  inssRate?: number | null;
  issRate?: number | null;
  retentionRate?: number | null;
  notes?: string | null;
}

function required(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} é obrigatório`);
  return normalized;
}

function percentage(value: number | null | undefined, field: string) {
  const normalized = value ?? 0;
  if (!Number.isFinite(normalized) || normalized < 0 || normalized >= 100) {
    throw new Error(`${field} inválido`);
  }
  return normalized;
}

export async function createContractWithWork(
  scope: CreateContractWithWorkScope,
  input: CreateContractWithWorkInput,
): Promise<void> {
  const client = getSupabaseClient();
  const workName = required(input.workName, 'Nome da obra');
  const contractNumber = required(input.contractNumber, 'Número do contrato');
  const clientName = input.clientName?.trim() || null;

  const work = await client
    .from('works')
    .insert({
      tenant_id: scope.tenantId,
      company_id: scope.companyId,
      name: workName,
      client_name: clientName,
      notes: input.notes?.trim() || null,
    })
    .select('id')
    .single();

  if (work.error) throw work.error;
  const workId = work.data.id as string;

  const contract = await client
    .from('engineering_contracts')
    .insert({
      tenant_id: scope.tenantId,
      company_id: scope.companyId,
      work_id: workId,
      contract_number: contractNumber,
      client_name: clientName,
      signed_at: input.signedAt || null,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      notes: input.notes?.trim() || null,
      status: 'active',
    })
    .select('id')
    .single();

  if (contract.error) {
    await client.from('works').delete().eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('id', workId);
    throw contract.error;
  }

  const contractId = contract.data.id as string;
  const retentionRules = [
    { type: 'inss' as const, rate: percentage(input.inssRate, 'INSS') },
    { type: 'iss' as const, rate: percentage(input.issRate, 'ISS') },
    { type: 'rt' as const, rate: percentage(input.retentionRate, 'Retenção') },
  ]
    .filter(item => item.rate > 0)
    .map(item => ({
      tenant_id: scope.tenantId,
      company_id: scope.companyId,
      contract_id: contractId,
      retention_type: item.type,
      calculation_type: 'percentage',
      rate: item.rate,
      fixed_amount: null,
      active: true,
    }));

  if (retentionRules.length) {
    const retention = await client.from('engineering_contract_retention_rules').insert(retentionRules);
    if (retention.error) {
      await client.from('engineering_contracts').delete().eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('id', contractId);
      await client.from('works').delete().eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('id', workId);
      throw retention.error;
    }
  }
}
