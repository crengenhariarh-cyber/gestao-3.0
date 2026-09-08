import { useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { SearchableSelect } from '../../../shared/ui/SearchableSelect';
import { Select } from '../../../shared/ui/Select';
import type { EngineeringProductionSnapshot } from '../infrastructure/EngineeringProductionReadRepository';
import { createSharedProductionEntry, type SharedProductionParticipantInput } from '../infrastructure/EngineeringProductionWriteRepository';
import './engineering-production-entry-dialog.css';

type DivisionMode='equal'|'percentage'|'value';
interface ParticipantDraft { id:string; name:string; percentage:string; value:string; }
interface Props {
  open:boolean;
  scope:{tenantId:string;companyId:string};
  snapshot:EngineeringProductionSnapshot;
  onClose:()=>void;
  onSaved:()=>void;
}
const today=()=>new Date().toISOString().slice(0,10);
const numberValue=(value:string)=>{const parsed=Number(value.replace(',','.'));return Number.isFinite(parsed)?parsed:0;};
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export function EngineeringProductionEntryDialog({open,scope,snapshot,onClose,onSaved}:Props){
  const [periodId,setPeriodId]=useState('');
  const [structureId,setStructureId]=useState('');
  const [serviceId,setServiceId]=useState('');
  const [productionDate,setProductionDate]=useState(today());
  const [executedQuantity,setExecutedQuantity]=useState('');
  const [unitValue,setUnitValue]=useState('');
  const [notes,setNotes]=useState('');
  const [divisionMode,setDivisionMode]=useState<DivisionMode>('equal');
  const [participants,setParticipants]=useState<ParticipantDraft[]>([]);
  const [employeeSearch,setEmployeeSearch]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const total=numberValue(executedQuantity)*numberValue(unitValue);
  const openPeriods=snapshot.periods.filter(item=>item.status==='open');
  const availableEmployees=useMemo(()=>snapshot.employees.filter(item=>!participants.some(p=>p.id===item.id)).map(item=>({value:item.id,label:item.name})),[snapshot.employees,participants]);
  const periodOptions=[{value:'',label:'Selecione…'},...openPeriods.map(item=>({value:item.id,label:item.competence.slice(0,7).split('-').reverse().join('/')}))];
  const structureOptions=[{value:'',label:'Selecione…'},...snapshot.structures.map(item=>({value:item.id,label:item.name}))];
  const serviceOptions=[{value:'',label:'Selecione…'},...snapshot.services.map(item=>({value:item.id,label:item.name}))];

  function addParticipant(id:string){
    const employee=snapshot.employees.find(item=>item.id===id);if(!employee)return;
    const next=[...participants,{id:employee.id,name:employee.name,percentage:'',value:''}];
    setParticipants(next);setEmployeeSearch('');
    if(divisionMode==='percentage'){const share=(100/next.length).toFixed(2);setParticipants(next.map(item=>({...item,percentage:share})));}
    if(divisionMode==='value'&&total>0){const share=(total/next.length).toFixed(2);setParticipants(next.map(item=>({...item,value:share})));}
  }
  function removeParticipant(id:string){setParticipants(current=>current.filter(item=>item.id!==id));}
  function updateParticipant(id:string,key:'percentage'|'value',value:string){setParticipants(current=>current.map(item=>item.id===id?{...item,[key]:value}:item));}
  function changeDivision(mode:DivisionMode){setDivisionMode(mode);if(mode==='percentage'&&participants.length){const share=(100/participants.length).toFixed(2);setParticipants(current=>current.map(item=>({...item,percentage:share})));}if(mode==='value'&&participants.length&&total>0){const share=(total/participants.length).toFixed(2);setParticipants(current=>current.map(item=>({...item,value:share})));}}
  function reset(){setPeriodId('');setStructureId('');setServiceId('');setProductionDate(today());setExecutedQuantity('');setUnitValue('');setNotes('');setDivisionMode('equal');setParticipants([]);setEmployeeSearch('');setError(null);}
  function close(){if(busy)return;reset();onClose();}

  async function submit(){
    setError(null);
    if(!periodId||!structureId||!serviceId){setError('Selecione competência, estrutura e serviço.');return;}
    if(numberValue(executedQuantity)<=0){setError('Informe uma quantidade maior que zero.');return;}
    if(numberValue(unitValue)<0||unitValue.trim()===''){setError('Informe o valor unitário.');return;}
    if(participants.length===0){setError('Selecione ao menos um colaborador.');return;}
    const payload:SharedProductionParticipantInput[]=participants.map(item=>({employmentContractId:item.id,...(divisionMode==='percentage'?{percentage:numberValue(item.percentage)}:{}),...(divisionMode==='value'?{value:numberValue(item.value)}:{})}));
    if(divisionMode==='percentage'&&Math.abs(payload.reduce((sum,item)=>sum+(item.percentage??0),0)-100)>0.01){setError('A soma dos percentuais deve ser 100%.');return;}
    if(divisionMode==='value'&&Math.abs(payload.reduce((sum,item)=>sum+(item.value??0),0)-total)>0.01){setError(`A soma dos valores deve ser ${currency.format(total)}.`);return;}
    setBusy(true);
    try{await createSharedProductionEntry({tenantId:scope.tenantId,companyId:scope.companyId,periodId,structureId,serviceId,productionDate,executedQuantity:numberValue(executedQuantity),unitValue:numberValue(unitValue),notes:notes||null,divisionMode,participants:payload});reset();onSaved();onClose();}
    catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar a produção.');}
    finally{setBusy(false);}
  }

  return <Dialog open={open} title="Lançar produção" description="Selecione o serviço executado e divida entre um ou mais colaboradores." onClose={close} onBack={close} onConfirm={()=>void submit()} confirmLabel="Salvar produção" loading={busy}>
    <div className="engineering-production-entry-form">
      {error&&<Feedback tone="danger" title="Não foi possível salvar" message={error}/>} 
      <div className="engineering-production-entry-form__grid">
        <Select label="Competência" value={periodId} onChange={event=>setPeriodId(event.target.value)} options={periodOptions} required/>
        <Select label="Estrutura" value={structureId} onChange={event=>setStructureId(event.target.value)} options={structureOptions} required/>
        <Select label="Serviço" value={serviceId} onChange={event=>setServiceId(event.target.value)} options={serviceOptions} required/>
        <Input label="Data" type="date" value={productionDate} onChange={event=>setProductionDate(event.target.value)} required/>
        <Input label="Quantidade" type="number" value={executedQuantity} onChange={event=>setExecutedQuantity(event.target.value)} required/>
        <Input label="Valor unitário" type="number" value={unitValue} onChange={event=>setUnitValue(event.target.value)} required/>
      </div>
      <div className="engineering-production-entry-form__total"><span>Total da produção</span><strong>{currency.format(total)}</strong></div>
      <section className="engineering-production-entry-form__participants">
        <div className="engineering-production-entry-form__participant-head"><div><h3>Colaboradores</h3><p className="ui-muted">O mesmo serviço pode ser dividido entre várias pessoas.</p></div><Select label="Divisão" value={divisionMode} onChange={event=>changeDivision(event.target.value as DivisionMode)} options={[{value:'equal',label:'Igual'},{value:'percentage',label:'Percentual'},{value:'value',label:'Valor'}]}/></div>
        <SearchableSelect label="Adicionar colaborador" options={availableEmployees} value={employeeSearch} onChange={addParticipant} placeholder="Digite o nome do colaborador" emptyMessage="Todos os colaboradores já foram selecionados."/>
        {participants.length===0?<p className="ui-muted engineering-production-entry-form__empty">Nenhum colaborador selecionado.</p>:<div className="engineering-production-entry-form__participant-list">{participants.map(item=><div key={item.id} className="engineering-production-entry-form__participant"><strong>{item.name}</strong><span>{divisionMode==='equal'?`${(100/participants.length).toFixed(2)}% · ${currency.format(participants.length?total/participants.length:0)}`:''}</span>{divisionMode==='percentage'&&<Input label="Percentual (%)" type="number" value={item.percentage} onChange={event=>updateParticipant(item.id,'percentage',event.target.value)}/>} {divisionMode==='value'&&<Input label="Valor" type="number" value={item.value} onChange={event=>updateParticipant(item.id,'value',event.target.value)}/>}<Button size="sm" variant="tertiary" onClick={()=>removeParticipant(item.id)}>Remover</Button></div>)}</div>}
      </section>
      <Input label="Observações" value={notes} onChange={event=>setNotes(event.target.value)}/>
    </div>
  </Dialog>;
}