import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface EngineeringProductionScope { tenantId:string; companyId:string; }
export interface EngineeringProductionPeriodView { id:string; workId:string; competence:string; status:string; }
export interface EngineeringProductionParticipantView { employmentContractId:string; employeeName:string; percentage:number; value:number; }
export interface EngineeringProductionReferenceView { id:string; name:string; }
export interface EngineeringProductionEntryView { id:string;periodId:string;employmentContractId:string;employeeName:string;structureId:string;structureName:string;serviceId:string|null;serviceName:string;productionDate:string;executedQuantity:number;unitValue:number|null;productionValue:number|null;notes:string|null;participants:EngineeringProductionParticipantView[]; }
export interface EngineeringProductionSnapshot { periods:EngineeringProductionPeriodView[];entries:EngineeringProductionEntryView[];employees:EngineeringProductionReferenceView[];structures:EngineeringProductionReferenceView[];services:EngineeringProductionReferenceView[]; }
type WorkRow={id:string;name:string};type PeriodRow={id:string;work_id:string;competence:string;status:string};type EntryRow={id:string;production_period_id:string;employment_contract_id:string;structure_id:string;service_id:string|null;production_date:string;executed_quantity:number|string;unit_value:number|string|null;production_value:number|string|null;notes:string|null};type ParticipantRow={production_entry_id:string;employment_contract_id:string;percentage:number|string;participant_value:number|string};type StructureRow={id:string;name:string};type ServiceRow={id:string;name:string};type EmployeeRow={id:string;employees:{full_name:string}[]};
const emptySnapshot=():EngineeringProductionSnapshot=>({periods:[],entries:[],employees:[],structures:[],services:[]});

export async function loadEngineeringProduction(scope:EngineeringProductionScope,workName:string):Promise<EngineeringProductionSnapshot>{
  const client=getSupabaseClient();
  const works=await client.from('works').select('id,name').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('name',workName).limit(1).returns<WorkRow[]>();if(works.error)throw works.error;
  const workId=works.data?.[0]?.id;if(!workId)return emptySnapshot();
  const [periods,structures,services,employees]=await Promise.all([
    client.from('engineering_production_periods').select('id,work_id,competence,status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('work_id',workId).order('competence',{ascending:false}).returns<PeriodRow[]>(),
    client.from('work_structures').select('id,name').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('work_id',workId).eq('status','active').order('sort_order').returns<StructureRow[]>(),
    client.from('engineering_services').select('id,name').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('status','active').order('name').returns<ServiceRow[]>(),
    client.from('employment_contracts').select('id,employees!inner(full_name)').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('status','active').order('hired_on').returns<EmployeeRow[]>(),
  ]);
  const baseError=[periods.error,structures.error,services.error,employees.error].find(Boolean);if(baseError)throw baseError;
  const periodRows=periods.data??[];
  const employeeRefs=(employees.data??[]).map(item=>({id:item.id,name:item.employees[0]?.full_name??'Colaborador'}));
  const structureRefs=(structures.data??[]).map(item=>({id:item.id,name:item.name}));
  const serviceRefs=(services.data??[]).map(item=>({id:item.id,name:item.name}));
  if(periodRows.length===0)return {periods:[],entries:[],employees:employeeRefs,structures:structureRefs,services:serviceRefs};
  const periodIds=periodRows.map(item=>item.id);
  const entries=await client.from('engineering_production_entries').select('id,production_period_id,employment_contract_id,structure_id,service_id,production_date,executed_quantity,unit_value,production_value,notes').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).in('production_period_id',periodIds).order('production_date',{ascending:false}).returns<EntryRow[]>();if(entries.error)throw entries.error;
  const entryRows=entries.data??[];const entryIds=entryRows.map(item=>item.id);
  const participants=entryIds.length?await client.from('engineering_production_participants').select('production_entry_id,employment_contract_id,percentage,participant_value').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).in('production_entry_id',entryIds).returns<ParticipantRow[]>():{data:[] as ParticipantRow[],error:null};
  if(participants.error)throw participants.error;
  const structureNames=new Map(structureRefs.map(item=>[item.id,item.name]));const serviceNames=new Map(serviceRefs.map(item=>[item.id,item.name]));const employeeNames=new Map(employeeRefs.map(item=>[item.id,item.name]));
  const participantsByEntry=new Map<string,EngineeringProductionParticipantView[]>();for(const item of participants.data??[]){const list=participantsByEntry.get(item.production_entry_id)??[];list.push({employmentContractId:item.employment_contract_id,employeeName:employeeNames.get(item.employment_contract_id)??'Colaborador',percentage:Number(item.percentage),value:Number(item.participant_value)});participantsByEntry.set(item.production_entry_id,list);}
  return {periods:periodRows.map(item=>({id:item.id,workId:item.work_id,competence:item.competence,status:item.status})),entries:entryRows.map(item=>({id:item.id,periodId:item.production_period_id,employmentContractId:item.employment_contract_id,employeeName:employeeNames.get(item.employment_contract_id)??'Colaborador',structureId:item.structure_id,structureName:structureNames.get(item.structure_id)??'Estrutura',serviceId:item.service_id,serviceName:item.service_id?serviceNames.get(item.service_id)??'Serviço':'Serviço legado / provisório',productionDate:item.production_date,executedQuantity:Number(item.executed_quantity),unitValue:item.unit_value===null?null:Number(item.unit_value),productionValue:item.production_value===null?null:Number(item.production_value),notes:item.notes,participants:participantsByEntry.get(item.id)??[]})),employees:employeeRefs,structures:structureRefs,services:serviceRefs};
}