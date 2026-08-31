import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EngineeringOperationalSnapshot,
  EngineeringOperationsRepository,
  EngineeringScope,
} from '../application/EngineeringOperationsRepository';

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} é obrigatório`);
  return normalized;
}
function nonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || Math.round(value * 100) !== value * 100) throw new Error(`${field} inválido`);
  return value;
}
function positive(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} inválido`);
  return value;
}
function month(value: string): string {
  const normalized = required(value, 'Competência');
  return /^\d{4}-\d{2}-01$/.test(normalized) ? normalized : `${normalized.slice(0, 7)}-01`;
}

export class SupabaseEngineeringOperationsRepository implements EngineeringOperationsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getSnapshot(scope: EngineeringScope): Promise<EngineeringOperationalSnapshot> {
    const [works, structures, services, contracts, contractServices, measurements, periods, employees, provisionals, addenda, accounts] = await Promise.all([
      this.client.from('works').select('id,name').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).neq('status', 'archived').order('name'),
      this.client.from('work_structures').select('id,name,work_id').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('status', 'active').order('sort_order'),
      this.client.from('engineering_services').select('id,name,default_unit').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('status', 'active').order('name'),
      this.client.from('engineering_contracts').select('id,contract_number,work_id,status').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('created_at', { ascending: false }),
      this.client.from('contract_services').select('id,contract_id,description,unit,unit_price').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('status', 'active').order('created_at'),
      this.client.from('measurements').select('id,contract_id,competence,status').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('competence', { ascending: false }),
      this.client.from('engineering_production_periods').select('id,work_id,competence,status').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('competence', { ascending: false }),
      this.client.from('employment_contracts').select('id,employees!inner(full_name)').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('status', 'active').order('hired_on'),
      this.client.from('provisional_contracts').select('id,provisional_number,status,work_id').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('created_at', { ascending: false }),
      this.client.from('contract_addenda').select('id,contract_id,addendum_number,status').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).order('created_at', { ascending: false }),
      this.client.from('financial_account_balances').select('account_id,name,status').eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('status', 'active').order('name'),
    ]);
    const error = [works.error, structures.error, services.error, contracts.error, contractServices.error, measurements.error, periods.error, employees.error, provisionals.error, addenda.error, accounts.error].find(Boolean);
    if (error) throw error;
    return {
      works: (works.data ?? []).map((row) => ({ id: row.id, name: row.name })),
      structures: (structures.data ?? []).map((row) => ({ id: row.id, name: row.name, workId: row.work_id })),
      services: (services.data ?? []).map((row) => ({ id: row.id, name: row.name, unit: row.default_unit })),
      contracts: (contracts.data ?? []).map((row) => ({ id: row.id, contractNumber: row.contract_number, workId: row.work_id, status: row.status })),
      contractServices: (contractServices.data ?? []).map((row) => ({ id: row.id, contractId: row.contract_id, description: row.description, unit: row.unit, unitPrice: Number(row.unit_price) })),
      measurements: (measurements.data ?? []).map((row) => ({ id: row.id, contractId: row.contract_id, competence: row.competence, status: row.status })),
      productionPeriods: (periods.data ?? []).map((row) => ({ id: row.id, workId: row.work_id, competence: row.competence, status: row.status })),
      employees: (employees.data ?? []).map((row) => ({ id: row.id, name: row.employees.full_name })),
      provisionals: (provisionals.data ?? []).map((row) => ({ id: row.id, number: row.provisional_number, status: row.status, workId: row.work_id })),
      addenda: (addenda.data ?? []).map((row) => ({ id: row.id, contractId: row.contract_id, number: row.addendum_number, status: row.status })),
      accounts: (accounts.data ?? []).map((row) => ({ id: row.account_id, name: row.name })),
    };
  }

  async createWork(scope: EngineeringScope, input: { name: string; code?: string | null; clientName?: string | null; city?: string | null; state?: string | null; notes?: string | null }): Promise<void> {
    const result = await this.client.from('works').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, name: required(input.name, 'Obra'), code: input.code || null, client_name: input.clientName || null, city: input.city || null, state: input.state || null, notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async createStructure(scope: EngineeringScope, input: { workId: string; parentId?: string | null; type: 'tower'|'block'|'sector'|'quad'|'floor'|'unit'|'house'|'area'|'basement'|'ground_floor'|'roof'|'other'; code?: string | null; name: string }): Promise<void> {
    const result = await this.client.from('work_structures').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, work_id: required(input.workId, 'Obra'), parent_id: input.parentId || null, structure_type: input.type, code: input.code || null, name: required(input.name, 'Estrutura') });
    if (result.error) throw result.error;
  }
  async createContract(scope: EngineeringScope, input: { workId: string; contractNumber: string; clientName?: string | null; signedAt?: string | null; startDate?: string | null; endDate?: string | null; notes?: string | null }): Promise<void> {
    const result = await this.client.from('engineering_contracts').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, work_id: required(input.workId, 'Obra'), contract_number: required(input.contractNumber, 'Número'), client_name: input.clientName || null, signed_at: input.signedAt || null, start_date: input.startDate || null, end_date: input.endDate || null, notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async updateContractStatus(scope: EngineeringScope, contractId: string, status: 'draft' | 'active' | 'suspended' | 'completed' | 'cancelled'): Promise<void> {
    const result = await this.client.from('engineering_contracts').update({ status, updated_at: new Date().toISOString() }).eq('tenant_id', scope.tenantId).eq('company_id', scope.companyId).eq('id', required(contractId, 'Contrato'));
    if (result.error) throw result.error;
  }
  async createService(scope: EngineeringScope, input: { name: string; unit: string; code?: string | null; category?: string | null; notes?: string | null }): Promise<void> {
    const result = await this.client.from('engineering_services').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, name: required(input.name, 'Serviço'), default_unit: required(input.unit, 'Unidade'), code: input.code || null, category: input.category || null, notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async addContractService(scope: EngineeringScope, input: { contractId: string; serviceId?: string | null; description: string; unit: string; quantity: number; unitPrice: number; notes?: string | null }): Promise<void> {
    const result = await this.client.from('contract_services').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, contract_id: required(input.contractId, 'Contrato'), service_id: input.serviceId || null, description: required(input.description, 'Descrição'), unit: required(input.unit, 'Unidade'), contracted_quantity: nonNegative(input.quantity, 'Quantidade'), unit_price: nonNegative(input.unitPrice, 'Valor unitário'), notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async allocateContractService(scope: EngineeringScope, input: { workId: string; contractServiceId: string; structureId: string; quantity: number; notes?: string | null }): Promise<void> {
    const result = await this.client.from('contract_service_allocations').upsert({ tenant_id: scope.tenantId, company_id: scope.companyId, work_id: required(input.workId, 'Obra'), contract_service_id: required(input.contractServiceId, 'Serviço do contrato'), structure_id: required(input.structureId, 'Estrutura'), allocated_quantity: positive(input.quantity, 'Quantidade'), notes: input.notes || null, status: 'active' }, { onConflict: 'tenant_id,company_id,contract_service_id,structure_id' });
    if (result.error) throw result.error;
  }
  async createProvisional(scope: EngineeringScope, input: { workId: string; number: string; title?: string | null; clientName?: string | null; notes?: string | null }): Promise<void> {
    const result = await this.client.from('provisional_contracts').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, work_id: required(input.workId, 'Obra'), provisional_number: required(input.number, 'Número'), title: input.title || null, client_name: input.clientName || null, notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async addProvisionalLine(scope: EngineeringScope, input: { provisionalId: string; serviceId?: string | null; description: string; unit: string; quantity: number; unitPrice: number; notes?: string | null }): Promise<void> {
    const result = await this.client.from('provisional_contract_lines').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, provisional_id: required(input.provisionalId, 'Provisório'), service_id: input.serviceId || null, description: required(input.description, 'Descrição'), unit: required(input.unit, 'Unidade'), quantity: nonNegative(input.quantity, 'Quantidade'), unit_price: nonNegative(input.unitPrice, 'Valor unitário'), notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async convertProvisional(input: { provisionalId: string; destination: 'contract' | 'addendum'; number: string; contractId?: string | null; addendumType?: 'increase' | 'reduction' | 'adjustment' | null }): Promise<void> {
    const result = await this.client.rpc('convert_provisional_contract', { p_provisional_id: required(input.provisionalId, 'Provisório'), p_destination: input.destination, p_number: required(input.number, 'Número'), p_contract_id: input.contractId || null, p_addendum_type: input.addendumType || null });
    if (result.error) throw result.error;
  }
  async createAddendum(scope: EngineeringScope, input: { contractId: string; number: string; type: 'increase' | 'reduction' | 'adjustment'; effectiveDate?: string | null; statedValue?: number | null; notes?: string | null }): Promise<void> {
    const result = await this.client.from('contract_addenda').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, contract_id: required(input.contractId, 'Contrato'), addendum_number: required(input.number, 'Número'), addendum_type: input.type, effective_date: input.effectiveDate || null, stated_value: input.statedValue == null ? null : nonNegative(input.statedValue, 'Valor'), notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async addAddendumLine(scope: EngineeringScope, input: { addendumId: string; contractServiceId?: string | null; serviceId?: string | null; description: string; unit: string; quantityDelta: number; unitPrice: number; notes?: string | null }): Promise<void> {
    if (!Number.isFinite(input.quantityDelta) || input.quantityDelta === 0) throw new Error('Variação de quantidade inválida');
    const result = await this.client.from('contract_addendum_lines').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, addendum_id: required(input.addendumId, 'Aditivo'), contract_service_id: input.contractServiceId || null, service_id: input.serviceId || null, description: required(input.description, 'Descrição'), unit: required(input.unit, 'Unidade'), quantity_delta: input.quantityDelta, unit_price: nonNegative(input.unitPrice, 'Valor unitário'), notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async createMeasurement(scope: EngineeringScope, input: { contractId: string; competence: string; notes?: string | null }): Promise<void> {
    const result = await this.client.from('measurements').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, contract_id: required(input.contractId, 'Contrato'), competence: month(input.competence), notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async addMeasurementLine(scope: EngineeringScope, input: { measurementId: string; contractServiceId: string; structureId?: string | null; measuredQuantity: number; unitPrice: number; notes?: string | null }): Promise<void> {
    const result = await this.client.from('measurement_lines').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, measurement_id: required(input.measurementId, 'Medição'), contract_service_id: required(input.contractServiceId, 'Serviço do contrato'), structure_id: input.structureId || null, measured_quantity: positive(input.measuredQuantity, 'Quantidade'), unit_price_snapshot: nonNegative(input.unitPrice, 'Valor unitário'), notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async addRetention(scope: EngineeringScope, input: { measurementId: string; retentionType: 'inss' | 'iss' | 'rt' | 'other'; calculationType: 'percentage' | 'fixed'; rate?: number | null; fixedAmount?: number | null; description?: string | null; notes?: string | null }): Promise<void> {
    const result = await this.client.from('measurement_retentions').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, measurement_id: required(input.measurementId, 'Medição'), retention_type: input.retentionType, calculation_type: input.calculationType, rate: input.calculationType === 'percentage' ? nonNegative(input.rate ?? 0, 'Percentual') : null, fixed_amount: input.calculationType === 'fixed' ? nonNegative(input.fixedAmount ?? 0, 'Valor') : null, description: input.description || null, notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async setMeasurementStatus(measurementId: string, action: 'close' | 'approve' | 'cancel' | 'reopen', reason?: string | null): Promise<void> {
    const result = await this.client.rpc('set_measurement_status', { p_measurement_id: required(measurementId, 'Medição'), p_action: action, p_reason: reason || null });
    if (result.error) throw result.error;
  }
  async generateMeasurementReceivable(measurementId: string, dueDate: string): Promise<void> {
    const result = await this.client.rpc('generate_measurement_receivable', { p_measurement_id: required(measurementId, 'Medição'), p_due_date: required(dueDate, 'Vencimento') });
    if (result.error) throw result.error;
  }
  async receiveMeasurement(measurementId: string, accountId: string, receivedOn: string, amountValue: number): Promise<void> {
    const result = await this.client.rpc('receive_measurement', { p_measurement_id: required(measurementId, 'Medição'), p_account_id: required(accountId, 'Conta'), p_received_on: required(receivedOn, 'Recebimento'), p_amount: positive(amountValue, 'Valor') });
    if (result.error) throw result.error;
  }
  async createProductionPeriod(scope: EngineeringScope, input: { workId: string; competence: string }): Promise<void> {
    const result = await this.client.from('engineering_production_periods').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, work_id: required(input.workId, 'Obra'), competence: month(input.competence) });
    if (result.error) throw result.error;
  }
  async addProductionEntry(scope: EngineeringScope, input: { periodId: string; employmentContractId: string; structureId: string; serviceId: string; productionDate: string; executedQuantity: number; unitValue?: number | null; notes?: string | null }): Promise<void> {
    const result = await this.client.from('engineering_production_entries').insert({ tenant_id: scope.tenantId, company_id: scope.companyId, production_period_id: required(input.periodId, 'Período'), employment_contract_id: required(input.employmentContractId, 'Colaborador'), structure_id: required(input.structureId, 'Estrutura'), service_id: required(input.serviceId, 'Serviço'), production_date: required(input.productionDate, 'Data'), executed_quantity: positive(input.executedQuantity, 'Quantidade'), unit_value: input.unitValue == null ? null : nonNegative(input.unitValue, 'Valor unitário'), notes: input.notes || null });
    if (result.error) throw result.error;
  }
  async setProductionPeriodStatus(periodId: string, action: 'close' | 'reopen', reason?: string | null): Promise<void> {
    const result = await this.client.rpc('set_engineering_production_period_status', { p_period_id: required(periodId, 'Período'), p_action: action, p_reason: reason || null });
    if (result.error) throw result.error;
  }
}
