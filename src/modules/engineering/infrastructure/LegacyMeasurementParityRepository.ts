import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface MeasurementParityScope { tenantId:string; companyId:string }
export type MeasurementOriginType='tower'|'addendum'|'provisional'|'other';
export type MeasurementTargetKind='contract'|'addendum';

export interface MeasurementParityMeasurement { id:string; competence:string; status:string; measurementNumber:string }
export interface MeasurementParityStage {
  legacyServiceId:string;
  code:string;
  name:string;
  description:string;
  unit:string;
  contractedQuantity:number;
  unitPrice:number;
  scopeActive:boolean;
  startFloor:number|null;
  scopeFloors:string[];
  scopeUnits:string[];
  targetKind:MeasurementTargetKind;
  targetId:string;
}
export interface MeasurementParityOrigin {
  id:string;
  name:string;
  type:MeasurementOriginType;
  floorCount:number;
  hasGround:boolean;
  modes:string[];
  services:MeasurementParityStage[];
}
export interface MeasurementParityLine {
  id:string;
  measurementId:string;
  measurementStatus:string;
  targetKind:MeasurementTargetKind;
  targetId:string;
  measuredQuantity:number;
  reference:string|null;
  notes:string|null;
}
export interface MeasurementParityModel {
  contractId:string;
  legacyContractId:string;
  enterpriseType:string;
  houses:string[];
  measurements:MeasurementParityMeasurement[];
  origins:MeasurementParityOrigin[];
  lines:MeasurementParityLine[];
}

type ContractRow={id:string;work_id:string;contract_number:string};
type ContractServiceRow={id:string;description:string;unit:string;contracted_quantity:number|string;unit_price:number|string;notes:string|null};
type AddendumRow={id:string;addendum_number:string;status:string};
type AddendumLineRow={id:string;addendum_id:string;description:string;unit:string;quantity_delta:number|string;unit_price:number|string;notes:string|null};
type MeasurementRow={id:string;competence:string;status:string;measurement_number:string|null};
type MeasurementLineRow={id:string;measurement_id:string;contract_service_id:string|null;contract_addendum_line_id:string|null;measured_quantity:number|string;notes:string|null};
type OriginProfileRow={id:string;origin_key:string;origin_name:string;origin_type:MeasurementOriginType;floor_count:number|string;has_ground:boolean;modes:string[]|null;enterprise_type:string;houses:string[]|null;legacy_origin_id:string|null};
type ScopeRow={origin_key:string;service_code:string;scope_active:boolean;start_floor:number|string|null;scope_floors:string[]|null;scope_units:string[]|null};

const safeText=(value:unknown)=>typeof value==='string'?value:typeof value==='number'||typeof value==='boolean'?String(value):'';
const normalize=(value:unknown)=>safeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const number=(value:unknown)=>Number(typeof value==='number'||typeof value==='string'?value:0);
const extractCode=(value:unknown)=>{
  const text=safeText(value).trim();
  const match=text.match(/^([A-Za-z0-9._-]+)\s*(?:—|-|\||$)/);
  return match?.[1]?.trim()??'';
};
const referenceFromNotes=(notes:string|null)=>notes?.match(/\[G2PARITY\]\s+reference=([^|]+)/i)?.[1]?.trim()??null;

function originFromNotes(notes:string|null):string{
  const parts=(notes??'').split('|').map(part=>part.trim()).filter(Boolean);
  if(parts.length<2)return '';
  const second=normalize(parts[1]);
  if(second==='provisorio'||second==='aditivo historico')return parts[2]??'';
  return parts[1]??'';
}

function scopeFor(rows:readonly ScopeRow[],originName:string,code:string){
  return rows.find(row=>normalize(row.origin_key)===normalize(originName)&&normalize(row.service_code)===normalize(code));
}

function stageFromContract(row:ContractServiceRow,scopeRows:readonly ScopeRow[]):MeasurementParityStage{
  const originName=originFromNotes(row.notes);
  const code=extractCode(row.description);
  const scope=scopeFor(scopeRows,originName,code);
  return {
    legacyServiceId:row.id,
    code,
    name:row.description,
    description:row.description.replace(/^([A-Za-z0-9._-]+)\s*(?:—|-)\s*/,'').trim()||row.description,
    unit:row.unit,
    contractedQuantity:number(row.contracted_quantity),
    unitPrice:number(row.unit_price),
    scopeActive:Boolean(scope?.scope_active),
    startFloor:scope?.start_floor===null||scope?.start_floor===undefined?null:number(scope.start_floor),
    scopeFloors:Array.isArray(scope?.scope_floors)?scope.scope_floors.map(value=>safeText(value)):[],
    scopeUnits:Array.isArray(scope?.scope_units)?scope.scope_units.map(value=>safeText(value)):[],
    targetKind:'contract',
    targetId:row.id,
  };
}

function stageFromAddendum(row:AddendumLineRow):MeasurementParityStage{
  const code=extractCode(row.description);
  return {
    legacyServiceId:row.id,
    code,
    name:row.description,
    description:row.description.replace(/^([A-Za-z0-9._-]+)\s*(?:—|-)\s*/,'').trim()||row.description,
    unit:row.unit,
    contractedQuantity:Math.abs(number(row.quantity_delta)),
    unitPrice:number(row.unit_price),
    scopeActive:false,
    startFloor:null,
    scopeFloors:[],
    scopeUnits:[],
    targetKind:'addendum',
    targetId:row.id,
  };
}

async function loadAllMeasurementLines(scope:MeasurementParityScope,measurementIds:string[]):Promise<MeasurementLineRow[]>{
  if(!measurementIds.length)return [];
  const client=getSupabaseClient();
  const pageSize=1000;
  const rows:MeasurementLineRow[]=[];
  for(let from=0;;from+=pageSize){
    const response=await client
      .from('measurement_lines')
      .select('id,measurement_id,contract_service_id,contract_addendum_line_id,measured_quantity,notes')
      .eq('tenant_id',scope.tenantId)
      .eq('company_id',scope.companyId)
      .in('measurement_id',measurementIds)
      .order('id',{ascending:true})
      .range(from,from+pageSize-1);
    if(response.error)throw response.error;
    const page=(response.data??[]) as MeasurementLineRow[];
    rows.push(...page);
    if(page.length<pageSize)break;
  }
  return rows;
}

export async function loadMeasurementParity(scope:MeasurementParityScope,contractId:string):Promise<MeasurementParityModel>{
  const client=getSupabaseClient();
  const contractResponse=await client.from('engineering_contracts').select('id,work_id,contract_number').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',contractId).single();
  if(contractResponse.error)throw contractResponse.error;
  const contract=contractResponse.data as ContractRow;

  const [profilesResponse,scopesResponse,contractServicesResponse,addendaResponse,measurementsResponse]=await Promise.all([
    client.from('engineering_measurement_origin_profiles').select('id,origin_key,origin_name,origin_type,floor_count,has_ground,modes,enterprise_type,houses,legacy_origin_id').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('work_id',contract.work_id).eq('status','active').order('origin_name'),
    client.from('engineering_measurement_service_scopes').select('origin_key,service_code,scope_active,start_floor,scope_floors,scope_units').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('work_id',contract.work_id),
    client.from('contract_services').select('id,description,unit,contracted_quantity,unit_price,notes').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',contractId).eq('status','active').order('created_at'),
    client.from('contract_addenda').select('id,addendum_number,status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',contractId),
    client.from('measurements').select('id,competence,status,measurement_number').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',contractId).order('competence',{ascending:false}),
  ]);
  const firstError=[profilesResponse.error,scopesResponse.error,contractServicesResponse.error,addendaResponse.error,measurementsResponse.error].find(Boolean);
  if(firstError)throw firstError;

  const profiles=(profilesResponse.data??[]) as OriginProfileRow[];
  if(!profiles.length)throw new Error('A estrutura de medição compatível com o Gestão 2.0 ainda não foi preparada para esta obra.');
  const scopeRows=(scopesResponse.data??[]) as ScopeRow[];
  const contractServices=(contractServicesResponse.data??[]) as ContractServiceRow[];
  const addenda=(addendaResponse.data??[]) as AddendumRow[];
  const measurements=(measurementsResponse.data??[]) as MeasurementRow[];

  const addendumIds=addenda.filter(item=>item.status==='effective').map(item=>item.id);
  const addendumLinesResponse=addendumIds.length
    ? await client.from('contract_addendum_lines').select('id,addendum_id,description,unit,quantity_delta,unit_price,notes').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).in('addendum_id',addendumIds).order('created_at')
    : {data:[],error:null};
  if(addendumLinesResponse.error)throw addendumLinesResponse.error;
  const addendumLines=(addendumLinesResponse.data??[]) as AddendumLineRow[];

  const measurementIds=measurements.map(item=>item.id);
  const measurementRows=await loadAllMeasurementLines(scope,measurementIds);
  const measurementStatusById=new Map(measurements.map(item=>[item.id,item.status]));

  const origins:MeasurementParityOrigin[]=profiles.map(profile=>{
    const contractStages=contractServices
      .filter(row=>normalize(originFromNotes(row.notes))===normalize(profile.origin_name))
      .map(row=>stageFromContract(row,scopeRows));
    const addendumStages=addendumLines
      .filter(row=>normalize(originFromNotes(row.notes))===normalize(profile.origin_name))
      .map(stageFromAddendum);
    return {
      id:profile.id,
      name:profile.origin_name,
      type:profile.origin_type,
      floorCount:number(profile.floor_count),
      hasGround:Boolean(profile.has_ground),
      modes:Array.isArray(profile.modes)?profile.modes.map(value=>safeText(value)):[],
      services:[...contractStages,...addendumStages],
    };
  }).filter(origin=>origin.services.length>0);

  const lines:MeasurementParityLine[]=measurementRows.flatMap(row=>{
    const targetKind:MeasurementTargetKind|null=row.contract_service_id?'contract':row.contract_addendum_line_id?'addendum':null;
    const targetId=row.contract_service_id??row.contract_addendum_line_id;
    if(!targetKind||!targetId)return [];
    return [{
      id:row.id,
      measurementId:row.measurement_id,
      measurementStatus:measurementStatusById.get(row.measurement_id)??'',
      targetKind,
      targetId,
      measuredQuantity:number(row.measured_quantity),
      reference:referenceFromNotes(row.notes),
      notes:row.notes,
    }];
  });

  const profile=profiles[0];
  return {
    contractId,
    legacyContractId:profile?.legacy_origin_id??contractId,
    enterpriseType:profile?.enterprise_type??'apartamentos',
    houses:Array.isArray(profile?.houses)?profile.houses.map(value=>safeText(value)):[],
    measurements:measurements.map(item=>({id:item.id,competence:item.competence,status:item.status,measurementNumber:item.measurement_number??''})),
    origins,
    lines,
  };
}

export async function replaceMeasurementParityStage(scope:MeasurementParityScope,input:{
  measurementId:string;
  targetKind:MeasurementTargetKind;
  targetId:string;
  quantity:number;
  references:string[];
  originName:string;
  legacyServiceId:string;
}){
  const client=getSupabaseClient();
  const response=await client.rpc('replace_measurement_stage',{
    p_measurement_id:input.measurementId,
    p_contract_service_id:input.targetKind==='contract'?input.targetId:null,
    p_contract_addendum_line_id:input.targetKind==='addendum'?input.targetId:null,
    p_quantity:input.references.length?null:input.quantity,
    p_references:input.references.length?input.references:null,
    p_notes:`origin=${input.originName} | legacy_service=${input.legacyServiceId}`,
  });
  if(response.error)throw response.error;
}
