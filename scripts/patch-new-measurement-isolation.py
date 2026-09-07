from pathlib import Path
p=Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s=p.read_text()
old="  useEffect(()=>{if(initialMeasurementId&&drafts.some(item=>item.id===initialMeasurementId)){setMeasurementId(initialMeasurementId);return;}if(measurementId&&drafts.some(item=>item.id===measurementId))return;setMeasurementId(drafts[0]?.id??'');},[drafts,measurementId,initialMeasurementId]);"
new="  useEffect(()=>{if(draftMode&&!initialMeasurementId){if(measurementId)setMeasurementId('');return;}if(initialMeasurementId&&drafts.some(item=>item.id===initialMeasurementId)){setMeasurementId(initialMeasurementId);return;}if(measurementId&&drafts.some(item=>item.id===measurementId))return;setMeasurementId('');},[draftMode,drafts,measurementId,initialMeasurementId]);"
if old not in s:
    raise SystemExit('measurement draft selection anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
print('new measurement isolation applied')
