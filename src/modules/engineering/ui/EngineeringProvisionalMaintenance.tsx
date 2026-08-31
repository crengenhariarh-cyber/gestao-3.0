import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { useEngineeringOperations } from './useEngineeringOperations';

interface Props { scope:{tenantId:string;companyId:string}; onChanged:()=>void; }
type Mode='header'|'line'|null;

export function EngineeringProvisionalMaintenance({scope,onChanged}:Props){
  const operations=useEngineeringOperations(scope);
  const data=operations.state.data;
  const [mode,setMode]=useState<Mode>(null);
  const [form,setForm]=useState<Record<string,string>>({});
  const field=(name:string,value:string)=>setForm(current=>({...current,[name]:value}));
  const editable=(data?.provisionals??[]).filter(item=>item.status!=='converted');
  const provisionalOptions=[{value:'',label:'Selecione…'},...editable.map(item=>({value:item.id,label:`${item.number} · ${item.status}`}))];
  const lineOptions=[{value:'',label:'Selecione…'},...(data?.provisionalLines??[]).filter(item=>!form.provisionalId||item.provisionalId===form.provisionalId).map(item=>({value:item.id,label:`${item.description} · ${item.quantity} × ${item.unitPrice}`}))];
  const serviceOptions=[{value:'',label:'Sem vínculo'},...(data?.services??[]).map(item=>({value:item.id,label:`${item.name} · ${item.unit}`}))];

  function close(){setMode(null);operations.clearFeedback();}
  function chooseProvisional(id:string){
    const item=editable.find(row=>row.id===id);
    setForm({provisionalId:id,title:item?.title??'',clientName:item?.clientName??'',status:item?.status??'draft',notes:''});
  }
  function chooseLine(id:string){
    const item=data?.provisionalLines.find(row=>row.id===id);
    setForm(current=>({...current,lineId:id,serviceId:item?.serviceId??'',description:item?.description??'',unit:item?.unit??'un',quantity:item?String(item.quantity):'',unitPrice:item?String(item.unitPrice):'',notes:''}));
  }
  async function save(){
    try{
      if(mode==='header') await operations.updateProvisional({provisionalId:form.provisionalId??'',title:form.title||null,clientName:form.clientName||null,status:(form.status??'draft') as 'draft'|'negotiation'|'approved'|'cancelled',notes:form.notes||null});
      if(mode==='line') await operations.updateProvisionalLine({lineId:form.lineId??'',provisionalId:form.provisionalId??'',serviceId:form.serviceId||null,description:form.description??'',unit:form.unit??'un',quantity:Number((form.quantity??'0').replace(',','.')),unitPrice:Number((form.unitPrice??'0').replace(',','.')),notes:form.notes||null});
      onChanged();setMode(null);
    }catch{return;}
  }

  return <>
    <div className="engineering-actions"><Button size="sm" variant="secondary" onClick={()=>{setForm({provisionalId:'',title:'',clientName:'',status:'draft',notes:''});setMode('header');}}>Editar provisório</Button><Button size="sm" variant="secondary" onClick={()=>{setForm({provisionalId:'',lineId:'',serviceId:'',description:'',unit:'un',quantity:'',unitPrice:'',notes:''});setMode('line');}}>Editar item</Button></div>
    <Dialog open={mode!==null} title={mode==='line'?'Editar item do provisório':'Editar provisório'} description="Alterações permitidas somente antes da conversão." loading={operations.state.busy} onClose={close} onBack={close} onConfirm={mode?()=>{void save();}:undefined}>
      {operations.state.errorMessage&&<Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage}/>} 
      {mode==='header'&&<div className="engineering-form-grid"><Select label="Provisório" value={form.provisionalId??''} onChange={event=>chooseProvisional(event.target.value)} options={provisionalOptions} required/><Input label="Título" value={form.title??''} onChange={event=>field('title',event.target.value)}/><Input label="Cliente" value={form.clientName??''} onChange={event=>field('clientName',event.target.value)}/><Select label="Status" value={form.status??'draft'} onChange={event=>field('status',event.target.value)} options={[{value:'draft',label:'Rascunho'},{value:'negotiation',label:'Negociação'},{value:'approved',label:'Aprovado'},{value:'cancelled',label:'Cancelado'}]}/><Input label="Observação" value={form.notes??''} onChange={event=>field('notes',event.target.value)}/></div>}
      {mode==='line'&&<div className="engineering-form-grid"><Select label="Provisório" value={form.provisionalId??''} onChange={event=>{field('provisionalId',event.target.value);field('lineId','');}} options={provisionalOptions} required/><Select label="Item" value={form.lineId??''} onChange={event=>chooseLine(event.target.value)} options={lineOptions} required/><Select label="Serviço" value={form.serviceId??''} onChange={event=>field('serviceId',event.target.value)} options={serviceOptions}/><Input label="Descrição" value={form.description??''} onChange={event=>field('description',event.target.value)} required/><Input label="Unidade" value={form.unit??'un'} onChange={event=>field('unit',event.target.value)} required/><Input label="Quantidade" type="number" step="0.01" min="0" value={form.quantity??''} onChange={event=>field('quantity',event.target.value)} required/><Input label="Valor unitário" type="number" step="0.01" min="0" value={form.unitPrice??''} onChange={event=>field('unitPrice',event.target.value)} required/><Input label="Observação" value={form.notes??''} onChange={event=>field('notes',event.target.value)}/></div>}
    </Dialog>
  </>;
}
