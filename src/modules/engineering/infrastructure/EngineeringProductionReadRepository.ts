import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface EngineeringProductionScope { tenantId:string; companyId:string; }
export interface EngineeringProductionPeriodView { id:string; workId:string; competence:string; status:string; }
export interface EngineeringProductionEntryView { id:string;periodId:string;employmentContractId:string;employeeName:string;structureId:string;structureName:string;serviceId:string|null;serviceName:string;productionDate:string;executedQuantity:number;unitValue:number|null;productionValue:number|null;notes:string|null; }
export interface EngineeringProductionSnapshot { periods:EngineeringProductionPeriodView[];entries:EngineeringProductionEntryView[]; }
type WorkRow={id:string;name:string};
type PeriodRow={id:string;work_id:string;competence:string;status:string};
type EntryRow={id:string;production_period_id:string;employment_contract_id:string;structure_id:string;service_id:string|null;production_date:string;executed_quantity:number|string;unit_value:number|string|null;production_value:number|string|null;notes:string|null};
type StructureRow={id:string;name:string};type ServiceRow={id:string;name:string};type EmployeeRow={id:string;employees:{full_name:string}[]};

export async function loadEngineeringProduction(scope:EngineeringProductionScope,workName:string):Promise<EngineeringProductionSnapshot>{
  const client=getSupabaseClient();
  const works=await client.from('works').select('id,name').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('name',workName).limit(1).returns<WorkRow[]>();
  if(works.error)throw works.error;
  const workId=works.data?.[0]?.id;
  if(!workId)return {periods:[],entries:[]};
  const periods=await client.from('engineering_production_periods').select('id,work_id,competence,status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('work_id',workId).order('competence',{ascending:false}).returns<PeriodRow[]>();
  if(periods.error)throw periods.error;
  const periodRows=periods.data??[];
  if(periodRows.length===0)return {periods:[],entries:[]};
  const periodIds=periodRows.map(item=>item.id);
  const [entries,structures,services,employees]=await Promise.all([
    client.from('engineering_production_entries').select('id,production_period_id,employment_contract_id,structure_id,service_id,production_date,executed_quantity,unit_value,production_value,notes').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).in('production_period_id',periodIds).order('production_date',{ascending:false}).returns<EntryRow[]>(),
    client.from('work_structures').select('id,name').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('work_id',workId).returns<StructureRow[]>(),
    client.from('engineering_services').select('id,name').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<ServiceRow[]>(),
    client.from('employment_contracts').select('id,employees!inner(full_name)').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<EmployeeRow[]>(),
  ]);
  const error=[entries.error,structures.error,services.error,employees.error].find(Boolean);if(error)throw error;
  const structureNames=new Map((structures.data??[]).map(item=>[item.id,item.name]));const serviceNames=new Map((services.data??[]).map(item=>[item.id,item.name]));const employeeNames=new Map((employees.data??[]).map(item=>[item.id,item.employees[0]?.full_name??'Colaborador']));
  return {periods:periodRows.map(item=>({id:item.id,workId:item.work_id,competence:item.competence,status:item.status})),entries:(entries.data??[]).map(item=>({id:item.id,periodId:item.production_period_id,employmentContractId:item.employment_contract_id,employeeName:employeeNames.get(item.employment_contract_id)??'Colaborador',structureId:item.structure_id,structureName:structureNames.get(item.structure_id)??'Estrutura',serviceId:item.service_id,serviceName:item.service_id?serviceNames.get(item.service_id)??'Serviço':'Serviço legado / provisório',productionDate:item.production_date,executedQuantity:Number(item.executed_quantity),unitValue:item.unit_value===null?null:Number(item.unit_value),productionValue:item.production_value===null?null:Number(item.production_value),notes:item.notes}))};
}