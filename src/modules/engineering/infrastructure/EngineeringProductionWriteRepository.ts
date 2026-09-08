import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface SharedProductionParticipantInput {
  employmentContractId:string;
  percentage?:number;
  value?:number;
}

export interface SharedProductionEntryInput {
  tenantId:string;
  companyId:string;
  periodId:string;
  structureId:string;
  serviceId:string;
  productionDate:string;
  executedQuantity:number;
  unitValue:number;
  notes?:string|null;
  divisionMode:'equal'|'percentage'|'value';
  participants:SharedProductionParticipantInput[];
}

export async function createSharedProductionEntry(input:SharedProductionEntryInput):Promise<string>{
  const client=getSupabaseClient();
  const result=await client.rpc('create_engineering_production_shared_entry',{
    p_tenant_id:input.tenantId,
    p_company_id:input.companyId,
    p_period_id:input.periodId,
    p_structure_id:input.structureId,
    p_service_id:input.serviceId,
    p_production_date:input.productionDate,
    p_executed_quantity:input.executedQuantity,
    p_unit_value:input.unitValue,
    p_notes:input.notes??null,
    p_division_mode:input.divisionMode,
    p_participants:input.participants,
  });
  if(result.error)throw result.error;
  return String(result.data);
}