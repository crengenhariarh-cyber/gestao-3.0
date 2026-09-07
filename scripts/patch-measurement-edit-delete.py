from pathlib import Path

# Repository contract
p=Path('src/modules/engineering/application/EngineeringOperationsRepository.ts')
s=p.read_text()
anchor="  createMeasurement(scope: EngineeringScope, input: { contractId:string; competence:string; measurementNumber:string; dueDate?:string|null; expectedPaymentDate?:string|null; paymentMethod?:string|null; originLabel?:string|null; notes?:string|null }): Promise<void>;\n"
insert=anchor+"  deleteMeasurement(scope: EngineeringScope, measurementId:string): Promise<void>;\n"
if "deleteMeasurement(scope: EngineeringScope" not in s:
    if anchor not in s: raise SystemExit('repository interface anchor not found')
    s=s.replace(anchor,insert)
p.write_text(s)

# Supabase repository
p=Path('src/modules/engineering/infrastructure/SupabaseEngineeringOperationsRepository.ts')
s=p.read_text()
anchor="  async createMeasurement(scope:EngineeringScope,input:Parameters<EngineeringOperationsRepository['createMeasurement']>[1])"
pos=s.find(anchor)
if pos<0: raise SystemExit('createMeasurement method not found')
if "async deleteMeasurement(scope:EngineeringScope" not in s:
    next_method=s.find("  async addMeasurementLine",pos)
    if next_method<0: raise SystemExit('addMeasurementLine anchor not found')
    method="""  async deleteMeasurement(scope:EngineeringScope,measurementId:string){
    const id=required(measurementId,'Medição');
    const current=await this.client.from('measurements').select('status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',id).single();
    if(current.error)throw current.error;
    if(current.data.status!=='draft')throw new Error('Somente medições em rascunho podem ser excluídas. Reabra a medição antes de excluir.');
    const retentions=await this.client.from('measurement_retentions').delete().eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('measurement_id',id);if(retentions.error)throw retentions.error;
    const lines=await this.client.from('measurement_lines').delete().eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('measurement_id',id);if(lines.error)throw lines.error;
    const measurement=await this.client.from('measurements').delete().eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',id).eq('status','draft');if(measurement.error)throw measurement.error;
  }
"""
    s=s[:next_method]+method+s[next_method:]
p.write_text(s)

# UI hook
p=Path('src/modules/engineering/ui/useEngineeringOperations.ts')
s=p.read_text()
anchor="    createMeasurement:(input:Parameters<typeof repository.createMeasurement>[1])=>execute(()=>repository.createMeasurement(scope,input),'Medição criada.'),\n"
if "deleteMeasurement:(id:string)" not in s:
    if anchor not in s: raise SystemExit('use hook anchor not found')
    s=s.replace(anchor,anchor+"    deleteMeasurement:(id:string)=>execute(()=>repository.deleteMeasurement(scope,id),'Medição excluída.'),\n")
p.write_text(s)

# Guided flow: exact measurement + origin
p=Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s=p.read_text()
if "initialMeasurementId?:string;" not in s:
    s=s.replace("  initialOriginId?:string;\n", "  initialMeasurementId?:string;\n  initialOriginId?:string;\n")
s=s.replace("export function GuidedMeasurementFlow({scope,contractId,initialOriginId='',initialOriginName='',draftHeader=null,onDraftPersisted,onChanged,onClose}:Props){",
            "export function GuidedMeasurementFlow({scope,contractId,initialMeasurementId='',initialOriginId='',initialOriginName='',draftHeader=null,onDraftPersisted,onChanged,onClose}:Props){")
old="useEffect(()=>{if(measurementId&&draftMeasurements.some(item=>item.id===measurementId))return;setMeasurementId(draftMeasurements[0]?.id??'');},[draftMeasurements,measurementId]);"
new="useEffect(()=>{if(initialMeasurementId&&draftMeasurements.some(item=>item.id===initialMeasurementId)){setMeasurementId(initialMeasurementId);return;}if(measurementId&&draftMeasurements.some(item=>item.id===measurementId))return;setMeasurementId(draftMeasurements[0]?.id??'');},[draftMeasurements,measurementId,initialMeasurementId]);"
if old in s:s=s.replace(old,new)
elif new not in s: raise SystemExit('guided measurement effect anchor not found')
p.write_text(s)

# Workspace actions
p=Path('src/modules/engineering/ui/EngineeringContractWorkspace.tsx')
s=p.read_text()
if "const [guidedMeasurementId,setGuidedMeasurementId]=useState('');" not in s:
    s=s.replace("  const [guidedMeasurementOpen,setGuidedMeasurementOpen]=useState(false);\n", "  const [guidedMeasurementOpen,setGuidedMeasurementOpen]=useState(false);\n  const [guidedMeasurementId,setGuidedMeasurementId]=useState('');\n")
if "const [measurementDeleteId,setMeasurementDeleteId]=useState<string|null>(null);" not in s:
    s=s.replace("  const [structureEditId,setStructureEditId]=useState<string|null>(null);\n", "  const [structureEditId,setStructureEditId]=useState<string|null>(null);\n  const [measurementDeleteId,setMeasurementDeleteId]=useState<string|null>(null);\n")
anchor="  function open(kind:FormKind){if(kind==='measurementLine'){setGuidedMeasurementOpen(true);return;}setFormKind(kind);}\n"
if "function openExistingMeasurement" not in s:
    if anchor not in s: raise SystemExit('workspace open anchor not found')
    s=s.replace(anchor,anchor+"  function openExistingMeasurement(measurementId:string,originLabel:string|null){setGuidedMeasurementId(measurementId);setGuidedMeasurementOriginName(originLabel??'');setGuidedMeasurementOriginId('');setGuidedMeasurementDraft(null);setGuidedMeasurementOpen(true);}\n  async function confirmDeleteMeasurement(){if(!measurementDeleteId)return;await operations.deleteMeasurement(measurementDeleteId);setMeasurementDeleteId(null);onChanged();}\n")
old="""      body=<>{toolbar('Nova medição','measurement',{label:'Adicionar serviço medido',kind:'measurementLine'})}{sheetHead(measurements.length)}<div className=\"engineering-sheet__table-wrap\"><table className=\"engineering-sheet__table\"><thead><tr><th>Competência</th><th>Status</th><th>Contrato</th><th>Evolução geral</th><th>Ações</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td><strong>{monthLabel(item.competence)}</strong></td><td><span className={`engineering-status engineering-status--${item.status}`}>{labelStatus(item.status)}</span></td><td>{contract.contractNumber}</td><td>{progress.toFixed(1)}%</td><td><Button size=\"sm\" variant=\"tertiary\" onClick={()=>open('measurementLine')}>Itens</Button></td></tr>)}</tbody></table>{rows.length===0&&emptyRow('Crie a primeira medição do contrato.')}</div></>;"""
new="""      body=<>{toolbar('Nova medição','measurement')}{sheetHead(measurements.length)}<div className=\"engineering-sheet__table-wrap\"><table className=\"engineering-sheet__table\"><thead><tr><th>Competência</th><th>Nº medição</th><th>Origem</th><th>Status</th><th>Contrato</th><th>Evolução geral</th><th>Ações</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td><strong>{monthLabel(item.competence)}</strong></td><td>{item.measurementNumber||'—'}</td><td>{item.originLabel||'—'}</td><td><span className={`engineering-status engineering-status--${item.status}`}>{labelStatus(item.status)}</span></td><td>{contract.contractNumber}</td><td>{progress.toFixed(1)}%</td><td><div className=\"engineering-sheet__row-actions\"><Button size=\"sm\" variant=\"tertiary\" disabled={item.status!=='draft'||!item.originLabel} onClick={()=>openExistingMeasurement(item.id,item.originLabel)}>Editar</Button><Button size=\"sm\" variant=\"secondary\" disabled={item.status!=='draft'} onClick={()=>setMeasurementDeleteId(item.id)}>Excluir</Button></div></td></tr>)}</tbody></table>{rows.length===0&&emptyRow('Crie a primeira medição do contrato.')}</div></>;"""
if old in s:s=s.replace(old,new)
elif new not in s: raise SystemExit('measurement table anchor not found')
old="{guidedMeasurementOpen&&<GuidedMeasurementFlow scope={scope} contractId={contract.contractId} initialOriginId={guidedMeasurementOriginId}"
new="{guidedMeasurementOpen&&<GuidedMeasurementFlow scope={scope} contractId={contract.contractId} initialMeasurementId={guidedMeasurementId} initialOriginId={guidedMeasurementOriginId}"
if old in s:s=s.replace(old,new)
elif new not in s: raise SystemExit('guided render anchor not found')
s=s.replace("setGuidedMeasurementOpen(false);setGuidedMeasurementOriginId('');setGuidedMeasurementOriginName('');setGuidedMeasurementDraft(null);",
            "setGuidedMeasurementOpen(false);setGuidedMeasurementId('');setGuidedMeasurementOriginId('');setGuidedMeasurementOriginName('');setGuidedMeasurementDraft(null);")
end="</>;\n}"
confirm="{measurementDeleteId&&<Dialog open title=\"Excluir medição\" description=\"Esta ação apaga o rascunho e todos os itens medidos desta medição.\" onClose={()=>setMeasurementDeleteId(null)} onBack={()=>setMeasurementDeleteId(null)} onConfirm={()=>void confirmDeleteMeasurement()} confirmLabel=\"Excluir medição\"><p>Confirme somente se esta medição foi criada ou lançada incorretamente.</p></Dialog>}"
if confirm not in s:
    marker="{guidedMeasurementOpen&&<GuidedMeasurementFlow"
    idx=s.find(marker)
    if idx<0: raise SystemExit('guided marker not found')
    close_idx=s.rfind("/>}</>;",idx)
    if close_idx<0: raise SystemExit('return tail not found')
    s=s[:close_idx+3]+confirm+s[close_idx+3:]
p.write_text(s)
