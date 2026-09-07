from pathlib import Path
import re

p = Path('src/modules/engineering/ui/EngineeringContractWorkspace.tsx')
s = p.read_text()

if "import { Dialog } from '../../../shared/ui/Dialog';" not in s:
    s = s.replace("import { Card } from '../../../shared/ui/Card';", "import { Card } from '../../../shared/ui/Card';\nimport { Dialog } from '../../../shared/ui/Dialog';")
if "EditEngineeringContractRetentionDialog" not in s:
    s = s.replace("import { GuidedMeasurementFlow } from './GuidedMeasurementFlow';", "import { GuidedMeasurementFlow } from './GuidedMeasurementFlow';\nimport { EditEngineeringContractRetentionDialog } from './EditEngineeringContractRetentionDialog';\nimport { EngineeringAddendumSheetDialog } from './EngineeringAddendumSheetDialog';")

anchor = "  const [allocationError,setAllocationError]=useState<string|null>(null);"
if "contractRetentionEditOpen" not in s:
    if anchor not in s:
        raise SystemExit('state anchor not found')
    s = s.replace(anchor, anchor + "\n  const [contractRetentionEditOpen,setContractRetentionEditOpen]=useState(false);", 1)

old_header = "    content=<div className=\"engineering-contract-workspace__page engineering-sheet\"><header className=\"engineering-sheet__head\"><div><small>{meta.eyebrow}</small><h3>{meta.title}</h3><p>{meta.description}</p></div><span className=\"engineering-sheet__contract-badge\">{contract.contractNumber}</span></header>{body}</div>;"
new_header = "    content=<div className=\"engineering-contract-workspace__page engineering-sheet\"><header className=\"engineering-sheet__head\"><div><small>{meta.eyebrow}</small><h3>{meta.title}</h3><p>{meta.description}</p></div><div><span className=\"engineering-sheet__contract-badge\">{contract.contractNumber}</span>{section==='contrato'&&<Button size=\"sm\" onClick={()=>setContractRetentionEditOpen(true)}>Editar contrato</Button>}</div></header>{body}</div>;"
if old_header in s:
    s = s.replace(old_header, new_header, 1)
elif 'setContractRetentionEditOpen(true)' not in s:
    raise SystemExit('header anchor not found')

pattern = r'\{selectedStructure&&<div className="engineering-sheet__detail-card">.*?</div>\}\n        \{selectedAddendum&&<div className="engineering-sheet__detail-card">.*?</div>\}'
replacement = '''{selectedStructure&&<Dialog open title={selectedStructure.name} description={`${structureAllocations.length} serviço(s) com quantitativo definido`} onClose={()=>setSheetGroup(null)} onBack={()=>setSheetGroup(null)} footer={<Button onClick={()=>open('allocation')}>＋ Distribuir serviço</Button>}><div className="engineering-sheet"><div className="engineering-sheet__live-filter"><span aria-hidden="true">⌕</span><input autoFocus value={serviceSearch} onChange={event=>setServiceSearch(event.target.value)} placeholder="Filtrar serviços enquanto digita: código, descrição, unidade ou quantitativo…" aria-label={`Filtrar serviços da ${selectedStructure.name}`}/>{serviceSearch&&<button type="button" onClick={()=>setServiceSearch('')} aria-label="Limpar filtro">×</button>}<small>{structureRows.length} de {structureAllocations.length}</small></div><div className="engineering-sheet__table-wrap engineering-sheet__table-wrap--detail"><table className="engineering-sheet__table engineering-sheet__table--services"><thead><tr><th>#</th><th>Serviço</th><th>Unidade</th><th>Valor unit.</th><th>Quantitativo</th><th>Ações</th></tr></thead><tbody>{structureRows.map(row=><tr key={row.service.id}><td>{String(row.index+1).padStart(3,'0')}</td><td><strong>{row.service.description}</strong></td><td>{row.service.unit}</td><td>{currency.format(row.service.unitPrice)}</td><td><strong>{quantity.format(row.allocation.allocatedQuantity)}</strong></td><td><Button size="sm" variant="tertiary" onClick={()=>{const cfg=towerConfig(selectedStructure.metadata);const availableFloors=cfg?Array.from({length:cfg.floorCount},(_,offset)=>String(cfg.firstFloor+offset)):[];const savedFloors=Array.isArray(row.allocation.scopeConfig?.floors)?row.allocation.scopeConfig.floors.map(String):[];setAllocationError(null);setAllocationEdit({contractServiceId:row.service.id,structureId:selectedStructure.id,serviceLabel:row.service.description,structureLabel:selectedStructure.name,unit:row.service.unit,quantity:String(row.allocation.allocatedQuantity),maxQuantity:row.service.quantity,notes:row.allocation.notes??'',availableFloors,selectedFloors:savedFloors,unitsPerFloor:cfg?.unitsPerFloor??0});}}>Editar quantitativo</Button></td></tr>)}</tbody></table>{structureRows.length===0&&emptyRow(serviceSearch?'Nenhum serviço corresponde ao filtro digitado.':'Nenhum serviço distribuído para esta estrutura.')}</div></div></Dialog>}
        {selectedAddendum&&<EngineeringAddendumSheetDialog open scope={scope} addendumId={selectedAddendum.id} addendumNumber={selectedAddendum.number} statusLabel={labelStatus(selectedAddendum.status)} onClose={()=>setSheetGroup(null)} onEditLine={()=>open('addendumLine')}/>}'''
if 'selectedStructure&&<Dialog' not in s:
    s, count = re.subn(pattern, replacement, s, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'plan sheet detail replacement count={count}')

pattern = r'\{allocationEdit&&<div className="engineering-sheet-form">.*?</div>\}\{guidedMeasurementOpen&&'
replacement = '''{allocationEdit&&<Dialog open title="Editar quantitativo" description={`${allocationEdit.structureLabel} · ${allocationEdit.serviceLabel}`} loading={allocationSaving} onClose={()=>!allocationSaving&&setAllocationEdit(null)} onBack={()=>!allocationSaving&&setAllocationEdit(null)} onConfirm={()=>void saveAllocationEdit()} confirmLabel="Salvar quantitativo"><div className="engineering-sheet__subsection engineering-allocation-editor"><div className="engineering-sheet__subhead"><div><strong>{allocationEdit.serviceLabel}</strong><span>Serviço e torre já definidos pela linha selecionada.</span></div></div>{allocationEdit.availableFloors.length>0&&<div className="engineering-allocation-editor__floors"><div><strong>Distribuição por pavimento</strong><span>Selecione os pavimentos deste serviço, como no Gestão 2.0.</span></div><div className="engineering-allocation-editor__floor-grid">{allocationEdit.availableFloors.map(floor=><button key={floor} type="button" className={allocationEdit.selectedFloors.includes(floor)?'is-selected':''} onClick={()=>toggleAllocationFloor(floor)}>{floor}º</button>)}</div>{allocationEdit.unit.trim().toLocaleUpperCase('pt-BR')==='APTO'&&allocationEdit.unitsPerFloor>0&&<small>{allocationEdit.selectedFloors.length} pavimento(s) × {allocationEdit.unitsPerFloor} aptos = {quantity.format(numberValue(allocationEdit.quantity))} · quantitativo anterior {quantity.format(allocationEdit.maxQuantity)}</small>}</div>}<label><span>Quantitativo</span><input autoFocus inputMode="decimal" value={allocationEdit.quantity} onChange={event=>{setAllocationError(null);setAllocationEdit(current=>current?{...current,quantity:event.target.value}:current);}}/></label>{allocationError&&<div className="engineering-allocation-editor__error" role="alert">{allocationError}</div>}<label><span>Observações</span><textarea rows={3} value={allocationEdit.notes} onChange={event=>setAllocationEdit(current=>current?{...current,notes:event.target.value}:current)}/></label></div></Dialog>}{guidedMeasurementOpen&&'''
if 'allocationEdit&&<Dialog' not in s:
    s, count = re.subn(pattern, replacement, s, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'allocation modal replacement count={count}')

old_tail = "{guidedMeasurementOpen&&<GuidedMeasurementFlow scope={scope} contractId={contract.contractId} onChanged={changed} onClose={()=>setGuidedMeasurementOpen(false)}/>}</>;"
if 'contractRetentionEditOpen&&<EditEngineeringContractRetentionDialog' not in s:
    if old_tail not in s:
        raise SystemExit('tail anchor not found')
    s = s.replace(old_tail, "{contractRetentionEditOpen&&<EditEngineeringContractRetentionDialog open scope={scope} contractId={contract.contractId} contractNumber={contract.contractNumber} onClose={()=>setContractRetentionEditOpen(false)} onSaved={changed}/>}" + old_tail, 1)

p.write_text(s)
