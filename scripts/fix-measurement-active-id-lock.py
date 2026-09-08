from pathlib import Path

path = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
text = path.read_text(encoding='utf-8')

# Existing measurement editing must never drift to another draft. The prop supplied
# by the workspace is authoritative; state is only used for a newly-created draft.
old = "  const [measurementId,setMeasurementId]=useState(''); const [originId,setOriginId]=useState(initialOriginId); const [serviceIndex,setServiceIndex]=useState(0);"
new = "  const [measurementId,setMeasurementId]=useState(initialMeasurementId); const activeMeasurementId=initialMeasurementId||measurementId; const [originId,setOriginId]=useState(initialOriginId); const [serviceIndex,setServiceIndex]=useState(0);"
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('measurement state anchor not found')

replacements = [
("const snapshotMeasurement=operations.state.data?.measurements.find(item=>item.id===measurementId);", "const snapshotMeasurement=operations.state.data?.measurements.find(item=>item.id===activeMeasurementId);"),
("const measurementGross=useMemo(()=>!model||!measurementId?0:model.lines.filter(line=>line.measurementId===measurementId)", "const measurementGross=useMemo(()=>!model||!activeMeasurementId?0:model.lines.filter(line=>line.measurementId===activeMeasurementId)"),
("[model,measurementId,stagePriceByTarget]);", "[model,activeMeasurementId,stagePriceByTarget]);"),
("const originRows=useMemo(()=>{if(!model||!measurementId)return [];", "const originRows=useMemo(()=>{if(!model||!activeMeasurementId)return [];"),
("line.measurementId===measurementId&&(keys.has", "line.measurementId===activeMeasurementId&&(keys.has"),
("},[model,measurementId,stagePriceByTarget]);", "},[model,activeMeasurementId,stagePriceByTarget]);"),
("const currentLines=useMemo(()=>targetLines.filter(line=>line.measurementId===measurementId),[targetLines,measurementId]);", "const currentLines=useMemo(()=>targetLines.filter(line=>line.measurementId===activeMeasurementId),[targetLines,activeMeasurementId]);"),
("line.measurementId!==measurementId&&['closed','approved'].includes(line.measurementStatus)", "line.measurementId!==activeMeasurementId&&['closed','approved'].includes(line.measurementStatus)"),
("[targetLines,measurementId]);", "[targetLines,activeMeasurementId]);"),
("line.measurementId===measurementId&&`${line.targetKind}:${line.targetId}`===key", "line.measurementId===activeMeasurementId&&`${line.targetKind}:${line.targetId}`===key"),
("[model,origin,stages,serviceSearch,typeFilter,statusFilter,measurementId,editLaunchedOnly]", "[model,origin,stages,serviceSearch,typeFilter,statusFilter,activeMeasurementId,editLaunchedOnly]"),
("[model,origin,measurementId]", "[model,origin,activeMeasurementId]"),
("async function openOrigin(nextOriginId:string,launchedOnly=false){if(!nextOriginId)return;if(measurementId){", "async function openOrigin(nextOriginId:string,launchedOnly=false){if(!nextOriginId)return;if(activeMeasurementId){"),
("async function confirmSelection(){\n    if(!origin||!stage)return; let activeMeasurementId=measurementId;", "async function confirmSelection(){\n    if(!origin||!stage)return; let targetMeasurementId=activeMeasurementId;"),
("if(!activeMeasurementId&&draftMode)", "if(!targetMeasurementId&&draftMode)"),
("activeMeasurementId=created.id;setMeasurementId(created.id);", "targetMeasurementId=created.id;setMeasurementId(created.id);"),
("if(!activeMeasurementId){setError('Crie ou selecione uma medição em rascunho.');return;}", "if(!targetMeasurementId){setError('Crie ou selecione uma medição em rascunho.');return;}"),
("measurementId:activeMeasurementId,targetKind:stage.targetKind", "measurementId:targetMeasurementId,targetKind:stage.targetKind"),
("line.measurementId===activeMeasurementId&&line.targetKind===stage.targetKind", "line.measurementId===targetMeasurementId&&line.targetKind===stage.targetKind"),
("async function saveHeader(){if(!measurementId)return;", "async function saveHeader(){if(!activeMeasurementId)return;"),
("await operations.updateMeasurement({measurementId,measurementNumber,competence", "await operations.updateMeasurement({measurementId:activeMeasurementId,measurementNumber,competence"),
("async function finalizeMeasurement(){if(!measurementId){", "async function finalizeMeasurement(){if(!activeMeasurementId){"),
("await operations.setMeasurementStatus(measurementId,'close')", "await operations.setMeasurementStatus(activeMeasurementId,'close')"),
]

for old_value, new_value in replacements:
    text = text.replace(old_value, new_value)

# Guard against a regression where an existing edit can silently target another draft.
if "const activeMeasurementId=initialMeasurementId||measurementId;" not in text:
    raise SystemExit('active measurement lock not applied')
if "measurementId:targetMeasurementId" not in text:
    raise SystemExit('save is not bound to target measurement')
if "updateMeasurement({measurementId:activeMeasurementId" not in text:
    raise SystemExit('header save is not bound to active measurement')
if "const previousLines=useMemo" in text and "[targetLines,measurementId]);" in text:
    raise SystemExit('stale measurementId hook dependency remains')

path.write_text(text, encoding='utf-8')
print('Measurement active-id lock applied.')
