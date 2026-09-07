from pathlib import Path

root=Path('.')

def req(s, old, new, label):
    if new in s:
        return s
    if old not in s:
        raise SystemExit(f'{label} not found')
    return s.replace(old,new)

# EngineeringOperationsPanel: selecting an origin immediately opens the staged editor with current header draft.
p=root/'src/modules/engineering/ui/EngineeringOperationsPanel.tsx'
s=p.read_text()
s=req(s,
"interface Props { activeTab:TabId; scope:{tenantId:string;companyId:string}; onChanged:()=>void; actionsMode?:ActionsMode; focusedContractId?:string|null; initialKind?:Exclude<Kind,null>; hideActions?:boolean; onDialogClosed?:()=>void; onMeasurementCreated?:(originId:string)=>void; }",
"interface Props { activeTab:TabId; scope:{tenantId:string;companyId:string}; onChanged:()=>void; actionsMode?:ActionsMode; focusedContractId?:string|null; initialKind?:Exclude<Kind,null>; hideActions?:boolean; onDialogClosed?:()=>void; onMeasurementCreated?:(originId:string)=>void; onMeasurementOriginSelected?:(originName:string,draft:Record<string,string>)=>void; }",
'panel props')
s=req(s,
"export function EngineeringOperationsPanel({activeTab,scope,onChanged,actionsMode='default',focusedContractId=null,initialKind,hideActions=false,onDialogClosed,onMeasurementCreated}:Props){",
"export function EngineeringOperationsPanel({activeTab,scope,onChanged,actionsMode='default',focusedContractId=null,initialKind,hideActions=false,onDialogClosed,onMeasurementCreated,onMeasurementOriginSelected}:Props){",
'panel signature')
old="case 'measurement':content=shell(<>{!focusedContractId&&select('Contrato','contractId',contractOptions,true)}{input('Nº da medição','measurementNumber','text',true)}{input('Competência','competence','month',true)}{select('Torre / Aditivo','originKey',measurementOriginOptions,true)}{input('Vencimento previsto','dueDate','date')}{input('Data prevista para pagamento','expectedPaymentDate','date')}{select('Forma de pagamento','paymentMethod',paymentMethodOptions,true)}{input('Observações','notes')}</>,'INSS, ISS e retenção técnica serão tratados na etapa Valores / Impostos e herdados do contrato.');break;"
new="case 'measurement':content=shell(<>{!focusedContractId&&select('Contrato','contractId',contractOptions,true)}{input('Nº da medição','measurementNumber','text',true)}{input('Competência','competence','month',true)}<Select label=\"Torre / Aditivo\" value={form.originKey??''} options={measurementOriginOptions} required onChange={event=>{const originKey=event.target.value;field('originKey',originKey);const selected=measurementOrigins.find(item=>item.key===originKey);if(selected)onMeasurementOriginSelected?.(selected.label,{...form,originKey});}}/>{input('Vencimento previsto','dueDate','date')}{input('Data prevista para pagamento','expectedPaymentDate','date')}{select('Forma de pagamento','paymentMethod',paymentMethodOptions,true)}{input('Observações','notes')}</>,'Selecione a Torre/Aditivo para abrir imediatamente a elaboração da medição. Os dados acima permanecem como rascunho até o primeiro serviço ser salvo.');break;"
s=req(s,old,new,'measurement staged origin selector')
p.write_text(s)

# Workspace: keep the header draft underneath and open the fullscreen editor immediately.
p=root/'src/modules/engineering/ui/EngineeringContractWorkspace.tsx'
s=p.read_text()
anchor="  const [guidedMeasurementOriginId,setGuidedMeasurementOriginId]=useState('');\n"
addition="  const [guidedMeasurementOriginName,setGuidedMeasurementOriginName]=useState('');\n  const [guidedMeasurementDraft,setGuidedMeasurementDraft]=useState<Record<string,string>|null>(null);\n"
if addition not in s:
    if anchor not in s: raise SystemExit('workspace guided state anchor not found')
    s=s.replace(anchor,anchor+addition)
old="<EngineeringOperationsPanel activeTab={activeForm.tab} scope={scope} onChanged={changed} actionsMode={activeForm.mode} focusedContractId={contract.contractId} initialKind={formKind} hideActions onDialogClosed={()=>setFormKind(null)} onMeasurementCreated={originId=>{setGuidedMeasurementOriginId(originId);setGuidedMeasurementOpen(true);}}/>"
new="<EngineeringOperationsPanel activeTab={activeForm.tab} scope={scope} onChanged={changed} actionsMode={activeForm.mode} focusedContractId={contract.contractId} initialKind={formKind} hideActions onDialogClosed={()=>setFormKind(null)} onMeasurementCreated={originId=>{setGuidedMeasurementOriginId(originId);setGuidedMeasurementOpen(true);}} onMeasurementOriginSelected={(originName,draft)=>{setGuidedMeasurementOriginName(originName);setGuidedMeasurementDraft(draft);setGuidedMeasurementOpen(true);}}/>"
s=req(s,old,new,'workspace panel origin callback')
old="{guidedMeasurementOpen&&<GuidedMeasurementFlow scope={scope} contractId={contract.contractId} initialOriginId={guidedMeasurementOriginId} onChanged={changed} onClose={()=>{setGuidedMeasurementOpen(false);setGuidedMeasurementOriginId('');}}/>}"
new="{guidedMeasurementOpen&&<GuidedMeasurementFlow scope={scope} contractId={contract.contractId} initialOriginId={guidedMeasurementOriginId} initialOriginName={guidedMeasurementOriginName} draftHeader={guidedMeasurementDraft} onDraftPersisted={()=>setFormKind(null)} onChanged={changed} onClose={()=>{setGuidedMeasurementOpen(false);setGuidedMeasurementOriginId('');setGuidedMeasurementOriginName('');setGuidedMeasurementDraft(null);}}/>}"
s=req(s,old,new,'workspace guided flow props')
p.write_text(s)

# GuidedMeasurementFlow: permit a local new-measurement draft, load services immediately, persist header only when first service is saved.
p=root/'src/modules/engineering/ui/GuidedMeasurementFlow.tsx'
s=p.read_text()
if "useEngineeringOperations" not in s:
    s=s.replace("import { Select } from '../../../shared/ui/Select';", "import { Select } from '../../../shared/ui/Select';\nimport { useEngineeringOperations } from './useEngineeringOperations';")
s=req(s,
"  initialOriginId?:string;\n  onChanged:()=>void;",
"  initialOriginId?:string;\n  initialOriginName?:string;\n  draftHeader?:Record<string,string>|null;\n  onDraftPersisted?:()=>void;\n  onChanged:()=>void;",
'guided props')
s=req(s,
"export function GuidedMeasurementFlow({scope,contractId,initialOriginId='',onChanged,onClose}:Props){",
"export function GuidedMeasurementFlow({scope,contractId,initialOriginId='',initialOriginName='',draftHeader=null,onDraftPersisted,onChanged,onClose}:Props){",
'guided signature')
anchor="  const [finished,setFinished]=useState(false);\n"
addition="  const operations=useEngineeringOperations(scope);\n  const draftMode=Boolean(draftHeader);\n"
if addition not in s:
    if anchor not in s: raise SystemExit('guided state anchor not found')
    s=s.replace(anchor,anchor+addition)
old="  useEffect(()=>{if(!initialOriginId||!model?.origins.some(item=>item.id===initialOriginId))return;setOriginId(initialOriginId);},[initialOriginId,model?.origins]);\n  useEffect(()=>{if(measurementId&&originId&&model?.origins.some(item=>item.id===originId))setServicePickerOpen(true);},[measurementId,originId,model?.origins]);"
new="  useEffect(()=>{if(initialOriginId&&model?.origins.some(item=>item.id===initialOriginId)){setOriginId(initialOriginId);return;}if(initialOriginName&&model){const match=model.origins.find(item=>normalize(item.name)===normalize(initialOriginName.replace(/^Aditivo\\s*·\\s*/i,'')));if(match)setOriginId(match.id);}},[initialOriginId,initialOriginName,model]);\n  useEffect(()=>{if(originId&&(measurementId||draftMode)&&model?.origins.some(item=>item.id===originId))setServicePickerOpen(true);},[measurementId,originId,draftMode,model?.origins]);"
s=req(s,old,new,'guided origin auto-open')
s=s.replace("    setServicePickerOpen(Boolean(value&&measurementId));", "    setServicePickerOpen(Boolean(value&&(measurementId||draftMode)));" )
old_start="  async function saveCurrent(){\n    if(!measurementId){setError('Crie ou selecione uma medição em rascunho antes de lançar os serviços.');return;}\n    if(!origin||!stage){setError('Selecione uma origem e um serviço.');return;}"
new_start="  async function saveCurrent(){\n    let activeMeasurementId=measurementId;\n    if(!origin||!stage){setError('Selecione uma origem e um serviço.');return;}\n    if(!activeMeasurementId&&draftMode){\n      const measurementNumber=(draftHeader?.measurementNumber??'').trim();\n      if(!measurementNumber){setError('Volte em Dados e informe o Nº da medição antes de salvar o primeiro serviço.');return;}\n      const competence=(draftHeader?.competence??'').trim();\n      if(!competence){setError('Volte em Dados e informe a competência antes de salvar o primeiro serviço.');return;}\n      try{\n        await operations.createMeasurement({contractId,competence,measurementNumber,dueDate:draftHeader?.dueDate||null,expectedPaymentDate:draftHeader?.expectedPaymentDate||null,paymentMethod:draftHeader?.paymentMethod||'PIX',originLabel:originLabel(origin),notes:draftHeader?.notes||null});\n        const refreshed=await loadMeasurementParity(scope,contractId);\n        const created=refreshed.measurements.find(item=>item.measurementNumber===measurementNumber&&item.status==='draft');\n        if(!created)throw new Error('A medição foi criada, mas não pôde ser reaberta para lançar os serviços.');\n        activeMeasurementId=created.id;setMeasurementId(created.id);setModel(refreshed);onDraftPersisted?.();onChanged();\n      }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível criar a medição.');return;}\n    }\n    if(!activeMeasurementId){setError('Crie ou selecione uma medição em rascunho antes de lançar os serviços.');return;}"
s=req(s,old_start,new_start,'guided draft creation')
s=s.replace("measurementId,targetKind:stage.targetKind", "measurementId:activeMeasurementId,targetKind:stage.targetKind")
# Do not block the staged editor merely because the measurement row is not persisted yet.
s=s.replace("      {!measurementId&&<div className=\"guided-measurement__empty\"><strong>Crie a competência primeiro</strong><span>Use “Nova medição” e depois selecione a origem.</span></div>}", "      {!measurementId&&!draftMode&&<div className=\"guided-measurement__empty\"><strong>Crie a competência primeiro</strong><span>Use “Nova medição” e depois selecione a origem.</span></div>}")
s=s.replace("      {measurementId&&!originId&&", "      {(measurementId||draftMode)&&!originId&&")
s=s.replace("      {measurementId&&originId&&stages.length===0&&", "      {(measurementId||draftMode)&&originId&&stages.length===0&&")
s=s.replace("      {measurementId&&origin&&stage&&!finished&&", "      {(measurementId||draftMode)&&origin&&stage&&!finished&&")
p.write_text(s)
