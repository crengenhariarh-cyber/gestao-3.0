import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface MeasurementParityScope { tenantId:string; companyId:string }
export type MeasurementOriginType='tower'|'addendum'|'provisional'|'other';
export type MeasurementTargetKind='contract'|'addendum';

export interface MeasurementParityMeasurement { id:string; competence:string; status:string }
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

type LegacyContractRow={id:string;obra:string;cliente:string;numero_contrato:string;tipo_empreendimento:string|null;casas:string[]|null};
type LegacyOriginRow={id:string;nome:string;tipo:string|null;quantidade_pavimentos:number|string|null;possui_terreo:boolean|null;formas_medicao:string[]|null};
type LegacyServiceRow={id:string;torre_id:string;codigo:string|null;nome:string;descricao:string|null;observacao:string|null;unidade:string;quantidade_contratada:number|string;valor_unitario:number|string;escopo_ativo:boolean|null;pavimento_inicial:number|string|null;pavimentos_escopo:string[]|null;unidades_escopo:string[]|null};
type ContractRow={id:string;work_id:string;contract_number:string};
type WorkRow={id:string;name:string};
type ContractServiceRow={id:string;description:string;unit:string;contracted_quantity:number|string;unit_price:number|string;notes:string|null};
type AddendumRow={id:string;addendum_number:string;status:string};
type AddendumLineRow={id:string;addendum_id:string;description:string;unit:string;quantity_delta:number|string;unit_price:number|string;notes:string|null};
type MeasurementRow={id:string;competence:string;status:string};
type MeasurementLineRow={id:string;measurement_id:string;contract_service_id:string|null;contract_addendum_line_id:string|null;measured_quantity:number|string;notes:string|null};

const normalize=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const number=(value:unknown)=>Number(value||0);
const extractCode=(value:unknown)=>{
  const text=String(value??'').trim();
  const match=text.match(/^([A-Za-z0-9._-]+)\s*(?:—|-|\||$)/);
  return match?.[1]?.trim()??'';
};
const referenceFromNotes=(notes:string|null)=>notes?.match(/\[G2PARITY\]\s+reference=([^|]+)/i)?.[1]?.trim()??null;

function originType(value:string|null):MeasurementOriginType{
  const normalized=normalize(value);
  if(normalized==='torre'||normalized==='bloco')return 'tower';
  if(normalized==='aditivo')return 'addendum';
  if(normalized==='provisorio')return 'provisional';
  return 'other';
}

function findContractService(rows:readonly ContractServiceRow[],originName:string,service:LegacyServiceRow){
  const origin=normalize(originName);
  const code=normalize(service.codigo);
  const candidates=rows.filter(row=>normalize(row.notes).includes(origin));
  if(code){
    const exact=candidates.find(row=>normalize(extractCode(row.description))===code);
    if(exact)return exact;
  }
  const serviceName=normalize(service.nome||service.descricao);
  return candidates.find(row=>normalize(row.description).includes(serviceName)||serviceName.includes(normalize(row.description)));
}

function findAddendumLine(rows:readonly AddendumLineRow[],originName:string,service:LegacyServiceRow){
  const origin=normalize(originName);
  const code=normalize(service.codigo);
  const candidates=rows.filter(row=>normalize(row.notes).includes(origin));
  if(code){
    const exact=candidates.find(row=>normalize(extractCode(row.description))===code);
    if(exact)return exact;
  }
  const serviceName=normalize(service.nome||service.descricao);
  return candidates.find(row=>normalize(row.description).includes(serviceName)||serviceName.includes(normalize(row.description)));
}

export async function loadMeasurementParity(scope:MeasurementParityScope,contractId:string):Promise<MeasurementParityModel>{
  const client=getSupabaseClient();
  const contractResponse=await client.from('engineering_contracts').select('id,work_id,contract_number').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',contractId).single();
  if(contractResponse.error)throw contractResponse.error;
  const contract=contractResponse.data as ContractRow;
  const workResponse=await client.from('works').select('id,name').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',contract.work_id).single();
  if(workResponse.error)throw workResponse.error;
  const work=workResponse.data as WorkRow;

  const legacyContractsResponse=await client.from('medicao_contratos').select('id,obra,cliente,numero_contrato,tipo_empreendimento,casas').ilike('obra',work.name);
  if(legacyContractsResponse.error)throw legacyContractsResponse.error;
  const legacyContracts=(legacyContractsResponse.data??[]) as LegacyContractRow[];
  const legacyContract=legacyContracts.find(row=>normalize(row.obra)===normalize(work.name))??legacyContracts[0];
  if(!legacyContract)throw new Error(`Não foi encontrada a estrutura de medição do Gestão 2.0 para ${work.name}.`);

  const [originsResponse,legacyServicesResponse,contractServicesResponse,addendaResponse,measurementsResponse]=await Promise.all([
    client.from('medicao_torres').select('id,nome,tipo,quantidade_pavimentos,possui_terreo,formas_medicao').eq('contrato_id',legacyContract.id).order('nome'),
    client.from('medicao_servicos').select('id,torre_id,codigo,nome,descricao,observacao,unidade,quantidade_contratada,valor_unitario,escopo_ativo,pavimento_inicial,pavimentos_escopo,unidades_escopo').eq('contrato_id',legacyContract.id),
    client.from('contract_services').select('id,description,unit,contracted_quantity,unit_price,notes').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',contractId).eq('status','active'),
    client.from('contract_addenda').select('id,addendum_number,status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',contractId),
    client.from('measurements').select('id,competence,status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',contractId).order('competence',{ascending:false}),
  ]);
  const firstError=[originsResponse.error,legacyServicesResponse.error,contractServicesResponse.error,addendaResponse.error,measurementsResponse.error].find(Boolean);
  if(firstError)throw firstError;
  const legacyOrigins=(originsResponse.data??[]) as LegacyOriginRow[];
  const legacyServices=(legacyServicesResponse.data??[]) as LegacyServiceRow[];
  const contractServices=(contractServicesResponse.data??[]) as ContractServiceRow[];
  const addenda=(addendaResponse.data??[]) as AddendumRow[];
  const measurements=(measurementsResponse.data??[]) as MeasurementRow[];

  const addendumIds=addenda.map(item=>item.id);
  const addendumLinesResponse=addendumIds.length
    ? await client.from('contract_addendum_lines').select('id,addendum_id,description,unit,quantity_delta,unit_price,notes').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).in('addendum_id',addendumIds)
    : {data:[],error:null};
  if(addendumLinesResponse.error)throw addendumLinesResponse.error;
  const addendumLines=(addendumLinesResponse.data??[]) as AddendumLineRow[];

  const measurementIds=measurements.map(item=>item.id);
  const linesResponse=measurementIds.length
    ? await client.from('measurement_lines').select('id,measurement_id,contract_service_id,contract_addendum_line_id,measured_quantity,notes').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).in('measurement_id',measurementIds)
    : {data:[],error:null};
  if(linesResponse.error)throw linesResponse.error;
  const measurementRows=(linesResponse.data??[]) as MeasurementLineRow[];
  const measurementStatusById=new Map(measurements.map(item=>[item.id,item.status]));

  const origins:MeasurementParityOrigin[]=legacyOrigins.map(origin=>{
    const stages:MeasurementParityStage[]=[];
    for(const service of legacyServices.filter(item=>item.torre_id===origin.id)){
      const contractTarget=findContractService(contractServices,origin.nome,service);
      const addendumTarget=contractTarget?undefined:findAddendumLine(addendumLines,origin.nome,service);
      if(!contractTarget&&!addendumTarget)continue;
      const targetKind:MeasurementTargetKind=contractTarget?'contract':'addendum';
      const target=contractTarget??addendumTarget!;
      stages.push({
        legacyServiceId:service.id,
        code:String(service.codigo??''),
        name:service.nome,
        description:service.descricao||service.nome,
        unit:service.unidade||target.unit,
        contractedQuantity:number(service.quantidade_contratada),
        unitPrice:number(target.unit_price||service.valor_unitario),
        scopeActive:Boolean(service.escopo_ativo),
        startFloor:service.pavimento_inicial===null||service.pavimento_inicial===''?null:number(service.pavimento_inicial),
        scopeFloors:Array.isArray(service.pavimentos_escopo)?service.pavimentos_escopo.map(String):[],
        scopeUnits:Array.isArray(service.unidades_escopo)?service.unidades_escopo.map(String):[],
        targetKind,
        targetId:target.id,
      });
    }
    return {
      id:origin.id,
      name:origin.nome,
      type:originType(origin.tipo),
      floorCount:number(origin.quantidade_pavimentos),
      hasGround:Boolean(origin.possui_terreo),
      modes:Array.isArray(origin.formas_medicao)?origin.formas_medicao.map(String):[],
      services:stages,
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

  return {
    contractId,
    legacyContractId:legacyContract.id,
    enterpriseType:legacyContract.tipo_empreendimento??'apartamentos',
    houses:Array.isArray(legacyContract.casas)?legacyContract.casas.map(String):[],
    measurements:measurements.map(item=>({id:item.id,competence:item.competence,status:item.status})),
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
