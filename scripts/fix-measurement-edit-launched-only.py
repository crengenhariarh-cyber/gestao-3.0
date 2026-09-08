from pathlib import Path

TSX = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s = TSX.read_text(encoding='utf-8')

# This CI repair is intentionally idempotent: the source may already contain newer
# activeMeasurementId logic applied by subsequent measurement fixes.
old_state = "  const [pickerOpen,setPickerOpen]=useState(false); const [unitPickerOpen,setUnitPickerOpen]=useState(false); const [serviceSearch,setServiceSearch]=useState(''); const [typeFilter,setTypeFilter]=useState(''); const [statusFilter,setStatusFilter]=useState(''); const [selectedUnits,setSelectedUnits]=useState<string[]>([]); const [search,setSearch]=useState(''); const [manualQuantity,setManualQuantity]=useState('');"
new_state = "  const [pickerOpen,setPickerOpen]=useState(false); const [unitPickerOpen,setUnitPickerOpen]=useState(false); const [serviceSearch,setServiceSearch]=useState(''); const [typeFilter,setTypeFilter]=useState(''); const [statusFilter,setStatusFilter]=useState(''); const [editLaunchedOnly,setEditLaunchedOnly]=useState(false); const [selectedUnits,setSelectedUnits]=useState<string[]>([]); const [search,setSearch]=useState(''); const [manualQuantity,setManualQuantity]=useState('');"
if old_state in s:
    s = s.replace(old_state, new_state, 1)

# Only patch the historical filter when it is still present. Newer source already
# contains the launched-only condition and must not fail CI just because the old
# textual anchor disappeared.
old_filter = """    const key=`${item.targetKind}:${item.targetId}`;\n    const previous=model.lines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)&&`${line.targetKind}:${line.targetId}`===key).reduce((sum,line)=>sum+line.measuredQuantity,0);\n    const remaining=Math.max(0,item.contractedQuantity-previous);\n    if(statusFilter==='balance'&&remaining<=0)return false;\n"""
new_filter = """    const key=`${item.targetKind}:${item.targetId}`;\n    const current=model.lines.filter(line=>line.measurementId===measurementId&&`${line.targetKind}:${line.targetId}`===key).reduce((sum,line)=>sum+line.measuredQuantity,0);\n    if(editLaunchedOnly&&current<=0)return false;\n    const previous=model.lines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)&&`${line.targetKind}:${line.targetId}`===key).reduce((sum,line)=>sum+line.measuredQuantity,0);\n    const remaining=Math.max(0,item.contractedQuantity-previous);\n    if(statusFilter==='balance'&&remaining<=0)return false;\n"""
if old_filter in s:
    s = s.replace(old_filter, new_filter, 1)

old_deps = "  });},[model,origin,stages,serviceSearch,typeFilter,statusFilter,measurementId]);"
new_deps = "  });},[model,origin,stages,serviceSearch,typeFilter,statusFilter,measurementId,editLaunchedOnly]);"
if old_deps in s:
    s = s.replace(old_deps, new_deps, 1)

old_open = "  async function openOrigin(nextOriginId:string){if(!nextOriginId)return;if(measurementId){try{await saveHeader();}catch{return;}}setOriginId(nextOriginId);setServiceIndex(0);setServiceSearch('');setTypeFilter('');setStatusFilter('');setUnitPickerOpen(false);setError(null);setPickerOpen(true);}\n"
new_open = "  async function openOrigin(nextOriginId:string,launchedOnly=false){if(!nextOriginId)return;if(measurementId){try{await saveHeader();}catch{return;}}setEditLaunchedOnly(launchedOnly);setOriginId(nextOriginId);setServiceIndex(0);setServiceSearch('');setTypeFilter('');setStatusFilter('');setUnitPickerOpen(false);setError(null);setPickerOpen(true);}\n"
if old_open in s:
    s = s.replace(old_open, new_open, 1)

old_close = "  function closePicker(){setUnitPickerOpen(false);setPickerOpen(false);setOriginId('');setServiceSearch('');setTypeFilter('');setStatusFilter('');setSelectedUnits([]);setManualQuantity('');setSearch('');}\n"
new_close = "  function closePicker(){setUnitPickerOpen(false);setPickerOpen(false);setEditLaunchedOnly(false);setOriginId('');setServiceSearch('');setTypeFilter('');setStatusFilter('');setSelectedUnits([]);setManualQuantity('');setSearch('');}\n"
if old_close in s:
    s = s.replace(old_close, new_close, 1)

old_edit = "onClick={()=>void openOrigin(row.origin.id)}><span><strong>{originLabel(row.origin)}</strong><small>{row.serviceCount} serviço(s) lançado(s)</small></span><b>{currency.format(row.gross)}</b><em>Editar ›</em>"
new_edit = "onClick={()=>void openOrigin(row.origin.id,true)}><span><strong>{originLabel(row.origin)}</strong><small>{row.serviceCount} serviço(s) lançado(s)</small></span><b>{currency.format(row.gross)}</b><em>Editar ›</em>"
if old_edit in s:
    s = s.replace(old_edit, new_edit, 1)

old_title = "<small>MEDIÇÃO · {originLabel(origin)}</small><h3>Medição - {originLabel(origin)}</h3><p>Pesquise os serviços, selecione apartamentos/unidades e confirme esta origem.</p>"
new_title = "<small>{editLaunchedOnly?'EDITAR LANÇAMENTOS':'MEDIÇÃO'} · {originLabel(origin)}</small><h3>{editLaunchedOnly?'Editar lançamentos':'Medição'} - {originLabel(origin)}</h3><p>{editLaunchedOnly?'Exibindo somente os serviços já lançados nesta medição.':'Pesquise os serviços, selecione apartamentos/unidades e confirme esta origem.'}</p>"
if old_title in s:
    s = s.replace(old_title, new_title, 1)

# Validate the behavior, not obsolete textual anchors.
required = [
    'editLaunchedOnly',
    'if(editLaunchedOnly&&current<=0)return false;',
    'openOrigin(row.origin.id,true)',
    "editLaunchedOnly?'EDITAR LANÇAMENTOS'",
]
missing = [item for item in required if item not in s]
if missing:
    raise SystemExit('launched-only measurement repair incomplete: ' + ', '.join(missing))

TSX.write_text(s, encoding='utf-8')
print('Launched-only measurement edit verified.')
