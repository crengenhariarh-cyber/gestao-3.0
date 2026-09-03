import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineeringCompanyScope, EngineeringOverviewRepository } from '../application/EngineeringOverviewRepository';
import type { EngineeringOverview } from '../domain/overview';

type ContractRow = { contract_id:string; contract_number:string; status:string; updated_contract_value:number|string; measured_net:number|string; gross_balance:number|string; measured_percent:number|string };
type MeasurementRow = { measurement_id:string; competence:string; status:string; gross_amount:number|string; retained_amount:number|string; net_amount:number|string };
type ProductionRow = { employment_contract_id:string; competence:string; executed_quantity:number|string; production_value:number|string };
type AddendumRow = { id:string; addendum_number:string; addendum_type:string; status:string; stated_value:number|string|null };
type ProvisionalRow = { id:string; provisional_number:string; title:string|null; status:string; client_name:string|null };

export class SupabaseEngineeringOverviewRepository implements EngineeringOverviewRepository {
  constructor(private readonly client: SupabaseClient) {}

  async load(scope: EngineeringCompanyScope): Promise<EngineeringOverview> {
    const [contracts, measurements, production, addenda, provisionals] = await Promise.all([
      this.client.from('engineering_contract_financial_summary').select('contract_id,contract_number,status,updated_contract_value,measured_net,gross_balance,measured_percent').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<ContractRow[]>(),
      this.client.from('engineering_measurement_monthly_report').select('measurement_id,competence,status,gross_amount,retained_amount,net_amount').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<MeasurementRow[]>(),
      this.client.from('engineering_employee_production_summary').select('employment_contract_id,competence,executed_quantity,production_value').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<ProductionRow[]>(),
      this.client.from('contract_addenda').select('id,addendum_number,addendum_type,status,stated_value').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<AddendumRow[]>(),
      this.client.from('provisional_contracts').select('id,provisional_number,title,status,client_name').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<ProvisionalRow[]>(),
    ]);
    for (const result of [contracts,measurements,production,addenda,provisionals]) if (result.error) throw result.error;
    return {
      contracts:(contracts.data ?? []).map(r=>({companyId:scope.companyId,contractId:r.contract_id,contractNumber:r.contract_number,status:r.status,updatedContractValue:Number(r.updated_contract_value),measuredNet:Number(r.measured_net),grossBalance:Number(r.gross_balance),measuredPercent:Number(r.measured_percent)})),
      measurements:(measurements.data ?? []).map(r=>({measurementId:r.measurement_id,competence:r.competence,status:r.status,grossAmount:Number(r.gross_amount),retainedAmount:Number(r.retained_amount),netAmount:Number(r.net_amount)})),
      production:(production.data ?? []).map(r=>({employmentContractId:r.employment_contract_id,competence:r.competence,executedQuantity:Number(r.executed_quantity),productionValue:Number(r.production_value)})),
      addenda:(addenda.data ?? []).map(r=>({id:r.id,addendumNumber:r.addendum_number,addendumType:r.addendum_type,status:r.status,statedValue:r.stated_value===null?null:Number(r.stated_value)})),
      provisionals:(provisionals.data ?? []).map(r=>({id:r.id,provisionalNumber:r.provisional_number,title:r.title,status:r.status,clientName:r.client_name})),
    };
  }
}
