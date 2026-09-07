from pathlib import Path
import re

root=Path('.')

def rep(s, old, new, label):
    if new in s: return s
    if old not in s: raise SystemExit(f'{label} not found')
    return s.replace(old,new)

p=root/'src/modules/engineering/ui/EngineeringOperationsPanel.tsx'
s=p.read_text()

s=rep(s,
"interface Props { activeTab:TabId; scope:{tenantId:string;companyId:string}; onChanged:()=>void; actionsMode?:ActionsMode; focusedContractId?:string|null; initialKind?:Exclude<Kind,null>; hideActions?:boolean; onDialogClosed?:()=>void; }",
"interface Props { activeTab:TabId; scope:{tenantId:string;companyId:string}; onChanged:()=>void; actionsMode?:ActionsMode; focusedContractId?:string|null; initialKind?:Exclude<Kind,null>; hideActions?:boolean; onDialogClosed?:()=>void; onMeasurementCreated?:(originId:string)=>void; }",
'panel props')
s=rep(s,
"export function EngineeringOperationsPanel({activeTab,scope,onChanged,actionsMode='default',focusedContractId=null,initialKind,hideActions=false,onDialogClosed}:Props){",
"export function EngineeringOperationsPanel({activeTab,scope,onChanged,actionsMode='default',focusedContractId=null,initialKind,hideActions=false,onDialogClosed,onMeasurementCreated}:Props){",
'panel signature')
s=rep(s,
"measurement:{contractId:'',competence:currentMonth(),measurementNumber:'',dueDate:'',expectedPaymentDate:'',paymentMethod:'PIX',originLabel:'',notes:''}",
"measurement:{contractId:'',competence:currentMonth(),measurementNumber:'',dueDate:'',expectedPaymentDate:'',paymentMethod:'PIX',originKey:'',notes:''}",
'measurement defaults')

anchor="  const structureOptions=options((data?.structures??[]).filter(item=>!selectedWork||item.workId===selectedWork));\n"
addition="""  const measurementContractId=form.contractId||focusedContractId||'';
  const measurementContract=data?.contracts.find(item=>item.id===measurementContractId);
  const measurementWorkId=measurementContract?.workId??'';
  const paymentMethodOptions:Option[]=[
    {value:'PIX',label:'PIX'},
    {value:'TRANSFERENCIA',label:'Transferência bancária'},
    {value:'BOLETO',label:'Boleto'},
    {value:'DINHEIRO',label:'Dinheiro'},
    {value:'CHEQUE',label:'Cheque'},
  ];
  const measurementOrigins=[
    ...(data?.structures??[]).filter(item=>item.workId===measurementWorkId&&['tower','block'].includes(item.type)).map(item=>({key:`structure:${item.id}`,id:item.id,label:item.name})),
    ...(data?.addenda??[]).filter(item=>item.contractId===measurementContractId).map(item=>({key:`addendum:${item.id}`,id:item.id,label:`Aditivo · ${item.number}`})),
  ];
  const measurementOriginOptions:Option[]=[{value:'',label:'Selecione…'},...measurementOrigins.map(item=>({value:item.key,label:item.label}))];
  const selectedMeasurementOrigin=measurementOrigins.find(item=>item.key===(form.originKey??''));
"""
if addition not in s:
    if anchor not in s: raise SystemExit('origin options anchor not found')
    s=s.replace(anchor,anchor+addition)

s=rep(s,
"  async function done(action:()=>Promise<unknown>){await action();onChanged();setKind(null);onDialogClosed?.();}",
"  async function done(action:()=>Promise<unknown>,after?:()=>void){await action();onChanged();after?.();setKind(null);onDialogClosed?.();}",
'done callback')

old_submit="case 'measurement':await done(()=>operations.createMeasurement({contractId:form.contractId||focusedContractId||'',competence:form.competence??currentMonth(),measurementNumber:form.measurementNumber??'',dueDate:form.dueDate||null,expectedPaymentDate:form.expectedPaymentDate||null,paymentMethod:form.paymentMethod||null,originLabel:form.originLabel||null,notes:form.notes||null}));break;"
new_submit="case 'measurement':await done(()=>operations.createMeasurement({contractId:form.contractId||focusedContractId||'',competence:form.competence??currentMonth(),measurementNumber:form.measurementNumber??'',dueDate:form.dueDate||null,expectedPaymentDate:form.expectedPaymentDate||null,paymentMethod:form.paymentMethod||null,originLabel:selectedMeasurementOrigin?.label??null,notes:form.notes||null}),()=>onMeasurementCreated?.(selectedMeasurementOrigin?.id??''));break;"
s=rep(s,old_submit,new_submit,'measurement submit')

new_form="case 'measurement':content=shell(<>{!focusedContractId&&select('Contrato','contractId',contractOptions,true)}{input('Nº da medição','measurementNumber','text',true)}{input('Competência','competence','month',true)}{select('Torre / Aditivo','originKey',measurementOriginOptions,true)}{input('Vencimento previsto','dueDate','date')}{input('Data prevista para pagamento','expectedPaymentDate','date')}{select('Forma de pagamento','paymentMethod',paymentMethodOptions,true)}{input('Observações','notes')}</>,'Dados principais da medição. INSS, ISS e retenção técnica serão tratados na etapa de valores/impostos.');break;"
if new_form not in s:
    pattern=r"case 'measurement':content=shell\(<>{!focusedContractId&&select\('Contrato','contractId',contractOptions,true\)}.*?</>,'[^']*'\);break;"
    m=re.search(pattern,s)
    if not m: raise SystemExit('measurement form not found')
    s=s[:m.start()]+new_form+s[m.end():]

old_dialog="<Dialog open={kind!==null} title={kind?titles[kind]:'Engenharia'} description={kind?descriptions[kind]:'Operação de Engenharia'} loading={operations.state.busy} onClose={close} onBack={close} onConfirm={kind?()=>{void submit();}:undefined} confirmLabel=\"Salvar\">"
new_dialog="<Dialog open={kind!==null} variant={kind==='measurement'?'measurement-fullscreen':undefined} title={kind?titles[kind]:'Engenharia'} description={kind?descriptions[kind]:'Operação de Engenharia'} loading={operations.state.busy} onClose={close} onBack={close} onConfirm={kind?()=>{void submit();}:undefined} confirmLabel={kind==='measurement'?'Salvar e continuar':'Salvar'}>"
if new_dialog not in s and old_dialog in s:s=s.replace(old_dialog,new_dialog)
p.write_text(s)

p=root/'src/modules/engineering/ui/EngineeringContractWorkspace.tsx'
s=p.read_text()
anchor="  const [guidedMeasurementOpen,setGuidedMeasurementOpen]=useState(false);\n"
addition="  const [guidedMeasurementOriginId,setGuidedMeasurementOriginId]=useState('');\n"
if addition not in s:
    if anchor not in s: raise SystemExit('workspace state anchor not found')
    s=s.replace(anchor,anchor+addition)
old="<EngineeringOperationsPanel activeTab={activeForm.tab} scope={scope} onChanged={changed} actionsMode={activeForm.mode} focusedContractId={contract.contractId} initialKind={formKind} hideActions onDialogClosed={()=>setFormKind(null)}/>"
new="<EngineeringOperationsPanel activeTab={activeForm.tab} scope={scope} onChanged={changed} actionsMode={activeForm.mode} focusedContractId={contract.contractId} initialKind={formKind} hideActions onDialogClosed={()=>setFormKind(null)} onMeasurementCreated={originId=>{setGuidedMeasurementOriginId(originId);setGuidedMeasurementOpen(true);}}/>"
s=rep(s,old,new,'workspace panel callback')
old="{guidedMeasurementOpen&&<GuidedMeasurementFlow scope={scope} contractId={contract.contractId} onChanged={changed} onClose={()=>setGuidedMeasurementOpen(false)}/>}"
new="{guidedMeasurementOpen&&<GuidedMeasurementFlow scope={scope} contractId={contract.contractId} initialOriginId={guidedMeasurementOriginId} onChanged={changed} onClose={()=>{setGuidedMeasurementOpen(false);setGuidedMeasurementOriginId('');}}/>}"
s=rep(s,old,new,'workspace guided flow')
p.write_text(s)

p=root/'src/modules/engineering/ui/GuidedMeasurementFlow.tsx'
s=p.read_text()
s=rep(s,"  contractId:string;\n  onChanged:()=>void;","  contractId:string;\n  initialOriginId?:string;\n  onChanged:()=>void;",'guided props')
s=rep(s,"export function GuidedMeasurementFlow({scope,contractId,onChanged,onClose}:Props){","export function GuidedMeasurementFlow({scope,contractId,initialOriginId='',onChanged,onClose}:Props){",'guided signature')
s=rep(s,"  const [originId,setOriginId]=useState('');","  const [originId,setOriginId]=useState(initialOriginId);",'guided origin initial')
anchor="  useEffect(()=>{if(measurementId&&draftMeasurements.some(item=>item.id===measurementId))return;setMeasurementId(draftMeasurements[0]?.id??'');},[draftMeasurements,measurementId]);\n"
addition="""  useEffect(()=>{if(!initialOriginId||!model?.origins.some(item=>item.id===initialOriginId))return;setOriginId(initialOriginId);},[initialOriginId,model?.origins]);
  useEffect(()=>{if(measurementId&&originId&&model?.origins.some(item=>item.id===originId))setServicePickerOpen(true);},[measurementId,originId,model?.origins]);
"""
if addition not in s:
    if anchor not in s: raise SystemExit('guided auto-open anchor not found')
    s=s.replace(anchor,anchor+addition)
p.write_text(s)
