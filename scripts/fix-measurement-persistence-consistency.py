from pathlib import Path

path = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
text = path.read_text(encoding='utf-8')

helper_anchor = "const originLabel=(origin:MeasurementParityOrigin)=>origin.type==='addendum'?`Aditivo · ${origin.name}`:origin.name;\n"
helper = helper_anchor + "const measurementLineOrigin=(notes:string|null)=>notes?.match(/(?:^|\\|)\\s*origin=([^|]+)/i)?.[1]?.trim()??'';\n"
if 'const measurementLineOrigin=' not in text:
    if helper_anchor not in text:
        raise SystemExit('origin label anchor not found')
    text = text.replace(helper_anchor, helper, 1)

old_origin_rows = "const originRows=useMemo(()=>{if(!model||!measurementId)return [];return model.origins.map(itemOrigin=>{const keys=new Set(itemOrigin.services.map(item=>`${item.targetKind}:${item.targetId}`));const lines=model.lines.filter(line=>line.measurementId===measurementId&&keys.has(`${line.targetKind}:${line.targetId}`));return {origin:itemOrigin,gross:lines.reduce((sum,line)=>sum+line.measuredQuantity*(stagePriceByTarget.get(`${line.targetKind}:${line.targetId}`)??0),0),serviceCount:new Set(lines.map(line=>`${line.targetKind}:${line.targetId}`)).size};}).filter(row=>row.serviceCount>0||row.gross>0);},[model,measurementId,stagePriceByTarget]);"
new_origin_rows = "const originRows=useMemo(()=>{if(!model||!measurementId)return [];return model.origins.map(itemOrigin=>{const keys=new Set(itemOrigin.services.map(item=>`${item.targetKind}:${item.targetId}`));const lines=model.lines.filter(line=>line.measurementId===measurementId&&(keys.has(`${line.targetKind}:${line.targetId}`)||normalize(measurementLineOrigin(line.notes))===normalize(itemOrigin.name)));return {origin:itemOrigin,gross:lines.reduce((sum,line)=>sum+line.measuredQuantity*(stagePriceByTarget.get(`${line.targetKind}:${line.targetId}`)??0),0),serviceCount:new Set(lines.map(line=>`${line.targetKind}:${line.targetId}`)).size};}).filter(row=>row.serviceCount>0||row.gross>0);},[model,measurementId,stagePriceByTarget]);"
if old_origin_rows in text:
    text = text.replace(old_origin_rows, new_origin_rows, 1)

old_save = "setSaving(true);setError(null);try{await replaceMeasurementParityStage(scope,{measurementId:activeMeasurementId,targetKind:stage.targetKind,targetId:stage.targetId,quantity:effectiveQuantity,references:refs.length?selectedUnits:[],originName:origin.name,legacyServiceId:stage.legacyServiceId});await reload();closeUnitPicker();}catch(cause)"
new_save = "setSaving(true);setError(null);try{await replaceMeasurementParityStage(scope,{measurementId:activeMeasurementId,targetKind:stage.targetKind,targetId:stage.targetId,quantity:effectiveQuantity,references:refs.length?selectedUnits:[],originName:origin.name,legacyServiceId:stage.legacyServiceId});const refreshed=await reload();if(!refreshed)throw new Error('O serviço foi enviado para salvar, mas a medição não pôde ser recarregada para conferência.');const persistedQuantity=refreshed.lines.filter(line=>line.measurementId===activeMeasurementId&&line.targetKind===stage.targetKind&&line.targetId===stage.targetId).reduce((sum,line)=>sum+line.measuredQuantity,0);if(Math.abs(persistedQuantity-effectiveQuantity)>0.0001)throw new Error(`Falha de conferência ao salvar: esperado ${effectiveQuantity}, gravado ${persistedQuantity}. A tela foi mantida aberta para evitar perda.`);closeUnitPicker();}catch(cause)"
if old_save in text:
    text = text.replace(old_save, new_save, 1)

required = [
    'const measurementLineOrigin=',
    'normalize(measurementLineOrigin(line.notes))===normalize(itemOrigin.name)',
    'const refreshed=await reload();',
    'persistedQuantity=',
    'Falha de conferência ao salvar',
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit('measurement persistence guard incomplete: ' + ', '.join(missing))

path.write_text(text, encoding='utf-8')

repo = Path('src/modules/engineering/infrastructure/SupabaseEngineeringOperationsRepository.ts')
source = repo.read_text(encoding='utf-8')
helper_marker = 'async function loadAllMeasurementLines('
if helper_marker not in source:
    class_anchor = 'export class SupabaseEngineeringOperationsRepository implements EngineeringOperationsRepository {'
    if class_anchor not in source:
        raise SystemExit('engineering repository class anchor not found')
    pagination_helper = """async function loadAllMeasurementLines(client:SupabaseClient,scope:EngineeringScope){
  const pageSize=1000;
  const rows:MeasurementLineRow[]=[];
  for(let from=0;;from+=pageSize){
    const response=await client.from('measurement_lines').select('id,measurement_id,contract_service_id,structure_id,measured_quantity,gross_value').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).range(from,from+pageSize-1).returns<MeasurementLineRow[]>();
    if(response.error)return response;
    const page=response.data??[];
    rows.push(...page);
    if(page.length<pageSize)return {data:rows,error:null};
  }
}

"""
    source = source.replace(class_anchor, pagination_helper + class_anchor, 1)

old_query = "this.client.from('measurement_lines').select('id,measurement_id,contract_service_id,structure_id,measured_quantity,gross_value').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<MeasurementLineRow[]>(),"
new_query = "loadAllMeasurementLines(this.client,scope),"
if old_query in source:
    source = source.replace(old_query, new_query, 1)

if helper_marker not in source or new_query not in source:
    raise SystemExit('snapshot measurement pagination guard incomplete')
repo.write_text(source, encoding='utf-8')
print('Measurement persistence consistency and snapshot pagination verified.')
