from pathlib import Path


def req(s, old, new, label):
    if old not in s:
        raise SystemExit(f'{label}: anchor not found')
    return s.replace(old, new, 1)

# 1) Repository contract: editable measurement header
p=Path('src/modules/engineering/application/EngineeringOperationsRepository.ts')
s=p.read_text()
s=req(s,
"export interface EngineeringMeasurementOption { id:string; contractId:string; competence:string; status:string; measurementNumber:string; dueDate:string|null; expectedPaymentDate:string|null; paymentMethod:string|null; originLabel:string|null; }",
"export interface EngineeringMeasurementOption { id:string; contractId:string; competence:string; status:string; measurementNumber:string; dueDate:string|null; expectedPaymentDate:string|null; paymentMethod:string|null; originLabel:string|null; notes:string|null; }",
'measurement option')
s=req(s,
"  createMeasurement(scope: EngineeringScope, input: { contractId:string; competence:string; measurementNumber:string; dueDate?:string|null; expectedPaymentDate?:string|null; paymentMethod?:string|null; originLabel?:string|null; notes?:string|null }): Promise<void>;\n  deleteMeasurement",
"  createMeasurement(scope: EngineeringScope, input: { contractId:string; competence:string; measurementNumber:string; dueDate?:string|null; expectedPaymentDate?:string|null; paymentMethod?:string|null; originLabel?:string|null; notes?:string|null }): Promise<void>;\n  updateMeasurement(scope: EngineeringScope, input: { measurementId:string; competence:string; measurementNumber:string; dueDate?:string|null; expectedPaymentDate?:string|null; paymentMethod?:string|null; notes?:string|null }): Promise<void>;\n  deleteMeasurement",
'update measurement interface')
p.write_text(s)

# 2) Supabase repository: read + persist header
p=Path('src/modules/engineering/infrastructure/SupabaseEngineeringOperationsRepository.ts')
s=p.read_text()
s=req(s,
"type MeasurementRow={id:string;contract_id:string;competence:string;status:string;measurement_number:string|null;due_date:string|null;expected_payment_date:string|null;payment_method:string|null;origin_label:string|null};",
"type MeasurementRow={id:string;contract_id:string;competence:string;status:string;measurement_number:string|null;due_date:string|null;expected_payment_date:string|null;payment_method:string|null;origin_label:string|null;notes:string|null};",
'measurement row')
s=req(s,
".from('measurements').select('id,contract_id,competence,status,measurement_number,due_date,expected_payment_date,payment_method,origin_label')",
".from('measurements').select('id,contract_id,competence,status,measurement_number,due_date,expected_payment_date,payment_method,origin_label,notes')",
'measurement select')
s=req(s,
"measurements:(measurements.data??[]).map(row=>({id:row.id,contractId:row.contract_id,competence:row.competence,status:row.status,measurementNumber:row.measurement_number??'',dueDate:row.due_date,expectedPaymentDate:row.expected_payment_date,paymentMethod:row.payment_method,originLabel:row.origin_label})),",
"measurements:(measurements.data??[]).map(row=>({id:row.id,contractId:row.contract_id,competence:row.competence,status:row.status,measurementNumber:row.measurement_number??'',dueDate:row.due_date,expectedPaymentDate:row.expected_payment_date,paymentMethod:row.payment_method,originLabel:row.origin_label,notes:row.notes})),",
'measurement mapping')
create_line="  async createMeasurement(scope:EngineeringScope,input:Parameters<EngineeringOperationsRepository['createMeasurement']>[1]){const measurementNumber=required(input.measurementNumber,'Número da medição');const duplicate=await this.client.from('measurements').select('id').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',required(input.contractId,'Contrato')).eq('measurement_number',measurementNumber).maybeSingle();if(duplicate.error)throw duplicate.error;if(duplicate.data)throw new Error('Já existe uma medição com este número neste contrato.');const r=await this.client.from('measurements').insert({tenant_id:scope.tenantId,company_id:scope.companyId,contract_id:input.contractId,competence:month(input.competence),measurement_number:measurementNumber,due_date:input.dueDate||null,expected_payment_date:input.expectedPaymentDate||null,payment_method:input.paymentMethod||null,origin_label:input.originLabel||null,notes:input.notes||null});if(r.error)throw r.error;}"
update_line="  async updateMeasurement(scope:EngineeringScope,input:Parameters<EngineeringOperationsRepository['updateMeasurement']>[1]){const id=required(input.measurementId,'Medição');const measurementNumber=required(input.measurementNumber,'Número da medição');const current=await this.client.from('measurements').select('id,status,contract_id').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',id).single();if(current.error)throw current.error;if(current.data.status!=='draft')throw new Error('Somente medições em rascunho podem ser editadas.');const duplicate=await this.client.from('measurements').select('id').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',current.data.contract_id).eq('measurement_number',measurementNumber).neq('id',id).maybeSingle();if(duplicate.error)throw duplicate.error;if(duplicate.data)throw new Error('Já existe outra medição com este número neste contrato.');const r=await this.client.from('measurements').update({competence:month(input.competence),measurement_number:measurementNumber,due_date:input.dueDate||null,expected_payment_date:input.expectedPaymentDate||null,payment_method:input.paymentMethod||null,notes:input.notes||null,updated_at:new Date().toISOString()}).eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',id).eq('status','draft');if(r.error)throw r.error;}"
if update_line not in s:
    s=req(s,create_line,create_line+'\n'+update_line,'insert update measurement')
p.write_text(s)

# 3) Hook
p=Path('src/modules/engineering/ui/useEngineeringOperations.ts')
s=p.read_text()
s=req(s,
"    createMeasurement:(input:Parameters<typeof repository.createMeasurement>[1])=>execute(()=>repository.createMeasurement(scope,input),'Medição criada.'),\n    deleteMeasurement",
"    createMeasurement:(input:Parameters<typeof repository.createMeasurement>[1])=>execute(()=>repository.createMeasurement(scope,input),'Medição criada.'),\n    updateMeasurement:(input:Parameters<typeof repository.updateMeasurement>[1])=>execute(()=>repository.updateMeasurement(scope,input),'Dados da medição atualizados.'),\n    deleteMeasurement",
'hook update measurement')
p.write_text(s)

# 4) Workspace: Edit opens measurement hub, never an origin directly; measurements are general
p=Path('src/modules/engineering/ui/EngineeringContractWorkspace.tsx')
s=p.read_text()
s=req(s,
"  function openExistingMeasurement(measurementId:string,originLabel:string|null){setGuidedMeasurementId(measurementId);setGuidedMeasurementOriginName(originLabel??'');setGuidedMeasurementOriginId('');setGuidedMeasurementDraft(null);setGuidedMeasurementOpen(true);}",
"  function openExistingMeasurement(measurementId:string){setGuidedMeasurementId(measurementId);setGuidedMeasurementOriginName('');setGuidedMeasurementOriginId('');setGuidedMeasurementDraft(null);setGuidedMeasurementOpen(true);}",
'workspace edit target')
s=s.replace("<td>{item.originLabel||'—'}</td>","<td>{measurementValue(item.id)>0?'Múltiplas origens':'—'}</td>")
s=s.replace("disabled={item.status!=='draft'||!item.originLabel} onClick={()=>openExistingMeasurement(item.id,item.originLabel)}","disabled={item.status!=='draft'} onClick={()=>openExistingMeasurement(item.id)}")
p.write_text(s)

# 5) Guided flow: editable professional hub + safe finalization
p=Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s=p.read_text()
s=req(s,
"  const [retentions,setRetentions]=useState({inss:0,iss:0,rt:0});\n  const operations=useEngineeringOperations(scope); const draftMode=Boolean(draftHeader);",
"  const [retentions,setRetentions]=useState({inss:0,iss:0,rt:0});\n  const [header,setHeader]=useState({measurementNumber:'',competence:'',dueDate:'',expectedPaymentDate:'',paymentMethod:'PIX',notes:''});\n  const [headerSaving,setHeaderSaving]=useState(false);\n  const operations=useEngineeringOperations(scope); const draftMode=Boolean(draftHeader);",
'header state')
# Do not auto-open by legacy origin label when editing a whole measurement.
s=req(s,
"  useEffect(()=>{if(!model)return;if(initialOriginId&&model.origins.some(item=>item.id===initialOriginId)){setOriginId(initialOriginId);setPickerOpen(true);return;}if(initialOriginName){const match=model.origins.find(item=>normalize(item.name)===normalize(initialOriginName.replace(/^Aditivo\\s*·\\s*/i,'')));if(match){setOriginId(match.id);setPickerOpen(true);}}},[initialOriginId,initialOriginName,model]);",
"  useEffect(()=>{if(!model)return;if(initialOriginId&&model.origins.some(item=>item.id===initialOriginId)){setOriginId(initialOriginId);setPickerOpen(true);}},[initialOriginId,model]);",
'legacy auto open')
# Insert header source/effect after drafts effect.
anchor="  useEffect(()=>{if(initialMeasurementId&&drafts.some(item=>item.id===initialMeasurementId)){setMeasurementId(initialMeasurementId);return;}if(measurementId&&drafts.some(item=>item.id===measurementId))return;setMeasurementId(drafts[0]?.id??'');},[drafts,measurementId,initialMeasurementId]);"
insert=anchor+"\n  const snapshotMeasurement=operations.state.data?.measurements.find(item=>item.id===measurementId);\n  useEffect(()=>{const source=snapshotMeasurement;setHeader({measurementNumber:draftHeader?.measurementNumber??source?.measurementNumber??'',competence:(draftHeader?.competence??source?.competence??'').slice(0,7),dueDate:draftHeader?.dueDate??source?.dueDate??'',expectedPaymentDate:draftHeader?.expectedPaymentDate??source?.expectedPaymentDate??'',paymentMethod:draftHeader?.paymentMethod??source?.paymentMethod??'PIX',notes:draftHeader?.notes??source?.notes??''});},[measurementId,snapshotMeasurement?.id,draftHeader]);"
s=req(s,anchor,insert,'header source')
# Add save/finalize before closeFlow.
anchor="  function closeFlow(){onChanged();onClose();}"
new="  async function saveHeader(){if(!measurementId)return;const measurementNumber=header.measurementNumber.trim(),competence=header.competence.trim();if(!measurementNumber){setError('Informe o número da medição.');return;}if(!competence){setError('Informe a competência.');return;}setHeaderSaving(true);setError(null);try{await operations.updateMeasurement({measurementId,measurementNumber,competence,dueDate:header.dueDate||null,expectedPaymentDate:header.expectedPaymentDate||null,paymentMethod:header.paymentMethod||null,notes:header.notes||null});await reload();onChanged();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar os dados da medição.');throw cause;}finally{setHeaderSaving(false);}}\n  async function finalizeMeasurement(){if(!measurementId){setError('Salve ao menos um serviço antes de finalizar a medição.');return;}try{await saveHeader();await operations.setMeasurementStatus(measurementId,'close');onChanged();onClose();}catch{}}\n  function closeFlow(){onChanged();onClose();}"
s=req(s,anchor,new,'save header')
# Remove obsolete currentDraft declaration if present.
s=s.replace("  const currentDraft=drafts.find(item=>item.id===measurementId);\n","")
# Replace header section with editable fields.
old="      <section className=\"approved-measurement-sheet__header-fields\">\n        <div><span>Nº da medição</span><strong>{draftHeader?.measurementNumber||currentDraft?.measurementNumber||'—'}</strong></div><div><span>Competência</span><strong>{draftHeader?.competence||currentDraft?.competence?.slice(0,7)||'—'}</strong></div><div><span>Vencimento previsto</span><strong>{draftHeader?.dueDate||'—'}</strong></div><div><span>Data prevista para pagamento</span><strong>{draftHeader?.expectedPaymentDate||'—'}</strong></div><div><span>Forma de pagamento</span><strong>{draftHeader?.paymentMethod||'PIX'}</strong></div><Button variant=\"secondary\">▣ Observações</Button>\n      </section>"
new="      <section className=\"measurement-hub__header-card\"><div className=\"measurement-hub__header-title\"><div><small>MEDIÇÃO EM RASCUNHO</small><h3>Dados da medição</h3><p>Revise datas e condições antes de finalizar.</p></div><span>#{header.measurementNumber||'—'}</span></div><div className=\"measurement-hub__header-grid\"><Input label=\"Nº da medição\" value={header.measurementNumber} onChange={event=>setHeader(current=>({...current,measurementNumber:event.target.value}))}/><Input label=\"Competência\" type=\"month\" value={header.competence} onChange={event=>setHeader(current=>({...current,competence:event.target.value}))}/><Input label=\"Vencimento previsto\" type=\"date\" value={header.dueDate} onChange={event=>setHeader(current=>({...current,dueDate:event.target.value}))}/><Input label=\"Data prevista para pagamento\" type=\"date\" value={header.expectedPaymentDate} onChange={event=>setHeader(current=>({...current,expectedPaymentDate:event.target.value}))}/><Select label=\"Forma de pagamento\" value={header.paymentMethod} onChange={event=>setHeader(current=>({...current,paymentMethod:event.target.value}))} options={[{value:'PIX',label:'PIX'},{value:'TED',label:'TED'},{value:'Boleto',label:'Boleto'},{value:'Transferência',label:'Transferência'},{value:'Outro',label:'Outro'}]}/><Input label=\"Observações\" value={header.notes} onChange={event=>setHeader(current=>({...current,notes:event.target.value}))} placeholder=\"Observações da medição\"/></div></section>"
s=req(s,old,new,'editable header')
# Picker opening should save edited header first for existing measurement.
s=req(s,
"  function openOrigin(nextOriginId:string){setOriginId(nextOriginId);setServiceIndex(0);setError(null);setPickerOpen(Boolean(nextOriginId));}",
"  async function openOrigin(nextOriginId:string){if(!nextOriginId)return;if(measurementId){try{await saveHeader();}catch{return;}}setOriginId(nextOriginId);setServiceIndex(0);setError(null);setPickerOpen(true);}",
'origin open save header')
s=s.replace("onChange={event=>openOrigin(event.target.value)}","onChange={event=>void openOrigin(event.target.value)}")
s=s.replace("onClick={()=>openOrigin(row.origin.id)}","onClick={()=>void openOrigin(row.origin.id)}")
# Footer real actions.
old="      <footer className=\"approved-measurement-sheet__bottom-actions\"><Button variant=\"secondary\" onClick={closeFlow}>Cancelar medição</Button><div><Button variant=\"secondary\" onClick={onChanged}>▣ Salvar rascunho</Button><Button onClick={closeFlow}>✓ Finalizar medição</Button></div></footer>"
new="      <footer className=\"approved-measurement-sheet__bottom-actions measurement-hub__footer\"><Button variant=\"secondary\" onClick={closeFlow}>Cancelar medição</Button><div><Button variant=\"secondary\" disabled={headerSaving||!measurementId} onClick={()=>void saveHeader()}>{headerSaving?'Salvando…':'▣ Salvar rascunho'}</Button><Button disabled={headerSaving||!measurementId||measurementGross<=0} onClick={()=>void finalizeMeasurement()}>✓ Finalizar medição</Button></div></footer>"
s=req(s,old,new,'footer actions')
p.write_text(s)

# 6) CSS professional polish for all measurement screens
p=Path('src/modules/engineering/ui/guided-measurement-flow.css')
s=p.read_text()
extra='''\n/* Measurement flow audit 2026-09-07 */\n.measurement-hub__header-card{border:1px solid #dbe5ef;border-radius:20px;background:linear-gradient(180deg,#fff,#fbfdff);padding:18px 20px;box-shadow:0 8px 24px rgba(15,23,42,.045);display:grid;gap:16px}.measurement-hub__header-title{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.measurement-hub__header-title small{display:block;color:#2563eb;font-size:.72rem;font-weight:900;letter-spacing:.08em}.measurement-hub__header-title h3{margin:3px 0 2px;font-size:1.18rem}.measurement-hub__header-title p{margin:0;color:#64748b;font-size:.86rem}.measurement-hub__header-title>span{padding:8px 12px;border-radius:999px;background:#eef5ff;color:#1d4ed8;font-weight:900}.measurement-hub__header-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.measurement-hub__financial{border:1px solid #dbe5ef;border-radius:20px;padding:12px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.04)}.measurement-hub__origin-picker,.measurement-hub__origins{border:1px solid #dbe5ef;border-radius:20px;background:#fff;padding:18px;box-shadow:0 8px 24px rgba(15,23,42,.04)}.measurement-hub__origin-picker>div:first-child strong,.measurement-hub__origins header strong{font-size:1.02rem;color:#172554}.measurement-hub__origin-picker>div:first-child span,.measurement-hub__origins header span{display:block;margin-top:3px;color:#64748b;font-size:.86rem}.measurement-hub__footer{position:sticky;bottom:0;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid #e2e8f0;padding:12px 0 4px;z-index:8}.guided-measurement-picker__panel{border:1px solid rgba(255,255,255,.2)}.guided-measurement-picker__panel>header{background:linear-gradient(180deg,#fff,#f8fbff)}.guided-measurement-picker__panel>footer{display:grid;grid-template-columns:.65fr 1.35fr;gap:10px;background:#fff}.guided-measurement-picker__panel>footer button{width:100%}@media(max-width:900px){.measurement-hub__header-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.measurement-hub__header-card,.measurement-hub__origin-picker,.measurement-hub__origins{padding:14px;border-radius:16px}.measurement-hub__header-grid{grid-template-columns:1fr}.measurement-hub__header-title>span{display:none}.guided-measurement-picker__panel>footer{grid-template-columns:1fr}}\n'''
if 'Measurement flow audit 2026-09-07' not in s:s+=extra
p.write_text(s)

print('measurement audit patch applied')
