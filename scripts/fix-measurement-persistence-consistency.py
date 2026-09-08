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
elif new_origin_rows not in text:
    raise SystemExit('origin rows anchor not found')

old_save = "setSaving(true);setError(null);try{await replaceMeasurementParityStage(scope,{measurementId:activeMeasurementId,targetKind:stage.targetKind,targetId:stage.targetId,quantity:effectiveQuantity,references:refs.length?selectedUnits:[],originName:origin.name,legacyServiceId:stage.legacyServiceId});await reload();closeUnitPicker();}catch(cause)"
new_save = "setSaving(true);setError(null);try{await replaceMeasurementParityStage(scope,{measurementId:activeMeasurementId,targetKind:stage.targetKind,targetId:stage.targetId,quantity:effectiveQuantity,references:refs.length?selectedUnits:[],originName:origin.name,legacyServiceId:stage.legacyServiceId});const refreshed=await reload();if(!refreshed)throw new Error('O serviço foi enviado para salvar, mas a medição não pôde ser recarregada para conferência.');const persistedQuantity=refreshed.lines.filter(line=>line.measurementId===activeMeasurementId&&line.targetKind===stage.targetKind&&line.targetId===stage.targetId).reduce((sum,line)=>sum+line.measuredQuantity,0);if(Math.abs(persistedQuantity-effectiveQuantity)>0.0001)throw new Error(`Falha de conferência ao salvar: esperado ${effectiveQuantity}, gravado ${persistedQuantity}. A tela foi mantida aberta para evitar perda.`);closeUnitPicker();}catch(cause)"
if old_save in text:
    text = text.replace(old_save, new_save, 1)
elif new_save not in text:
    raise SystemExit('save verification anchor not found')

path.write_text(text, encoding='utf-8')
print('Measurement persistence consistency guard applied.')
