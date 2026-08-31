import { useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import { useEngineeringOperations } from './useEngineeringOperations';

interface Props { scope:{tenantId:string;companyId:string}; onChanged:()=>void; }
type Mode='header'|'line'|null;

export function EngineeringProvisionalMaintenance({scope,onChanged}:Props){
  const client=useMemo(()=>getSupabaseClient(),[]);
  const operations=useEngineeringOperations(scope);
  const data=operations.state.data;
  const [mode,setMode]=useState<Mode>(null);
  const [form,setForm]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);
  const [errorMessage,setErrorMessage]=useState<string|null>(null);
  const field=(name:string,value:string)=>setForm(current=>({...current,[name]:value}));
  const editable=(data?.provisionals??[]).filter(item=>item.status!=='converted'&&item.status!=='cancelled');
  const provisionalOptions=[{value:'',label:'Selecione…'},...editable.map(item=>({value:item.id,label:`${item.number} · ${item.status}`}))];
  const lineOptions=[{value:'',label:'Selecione…'},...(data?.provisionalLines??[]).filter(item=>!form.provisionalId||item.provisionalId===form.provisionalId).map(item=>({value:item.id,label:`${item.description} · ${item.quantity} × ${item.unitPrice}`}))];
  const serviceOptions=[{value:'',label:'Sem vínculo'},...(data?.services??[]).map(item=>({value:item.id,label:`${item.name} · ${item.unit}`}))];

  function close(){if(saving)return;setMode(null);setErrorMessage(null);}
  function chooseProvisional(id:string){
    const item=editable.find(row=>row.id===id);
    setForm({provisionalId:id,title:item?.title??'',clientName:item?.clientName??'',status:item?.status??'draft'});
  }
  function chooseLine(id:string){
    const item=data?.provisionalLines.find(row=>row.id===id);
    setForm(current=>({...current,lineId:id,serviceId:item?.serviceId??'',description:item?.description??'',unit:item?.unit??'un',quantity:item?String(item.quantity):'',unitPrice:item?String(item.unitPrice):''}));
  }
  async function save(){
    setSaving(true);setErrorMessage(null);
    try{
      if(mode==='header'){
        const result=await client.from('provisional_contracts').update({title:form.title||null,client_name:form.clientName||null,status:(form.status??'draft') as 'draft'|'negotiation'|'approved'}).eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',form.provisionalId??'').in('status',['draft','negotiation','approved']);
        if(result.error)throw result.error;
      }
      if(mode==='line'){
        const quantity=Number((form.quantity??'0').replace(',','.'));
        const unitPrice=Number((form.unitPrice??'0').replace(',','.'));
        if(!Number.isFinite(quantity)||quantity<0||!Number.isFinite(unitPrice)||unitPrice<0)throw new Error('Quantidade ou valor unitário inválido.');
        const result=await client.from('provisional_contract_lines').update({service_id:form.serviceId||null,description:(form.description??'').trim(),unit:(form.unit??'').trim(),quantity,unit_price:unitPrice}).eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('provisional_id',form.provisionalId??'').eq('id',form.lineId??'');
        if(result.error)throw result.error;
      }
      await operations.reload();
      onChanged();setMode(null);
    }catch(error){setErrorMessage(error instanceof Error?error.message:'Não foi possível salvar o provisório.');}
    finally{setSaving(false);}
  }

  return <>
    <div className="engineering-actions"><Button size="sm" variant="secondary" onClick={()=>{setForm({provisionalId:'',title:'',clientName:'',status:'draft'});setErrorMessage(null);setMode('header');}}>Editar provisório</Button><Button size="sm" variant="secondary" onClick={()=>{setForm({provisionalId:'',lineId:'',serviceId:'',description:'',unit:'un',quantity:'',unitPrice:''});setErrorMessage(null);setMode('line');}}>Editar item</Button></div>
    <Dialog open={mode!==null} title={mode==='line'?'Editar item do provisório':'Editar provisório'} description="Alterações permitidas somente antes da conversão ou cancelamento." loading={saving||operations.state.busy} onClose={close} onBack={close} onConfirm={mode?()=>{void save();}:undefined}>
      {errorMessage&&<Feedback tone="danger" title="Não foi possível salvar" message={errorMessage}/>} 
      {mode==='header'&&<div className="engineering-form-grid"><Select label="Provisório" value={form.provisionalId??''} onChange={event=>chooseProvisional(event.target.value)} options={provisionalOptions} required/><Input label="Título" value={form.title??''} onChange={event=>field('title',event.target.value)}/><Input label="Cliente" value={form.clientName??''} onChange={event=>field('clientName',event.target.value)}/><Select label="Status" value={form.status??'draft'} onChange={event=>field('status',event.target.value)} options={[{value:'draft',label:'Rascunho'},{value:'negotiation',label:'Negociação'},{value:'approved',label:'Aprovado'}]}/></div>}
      {mode==='line'&&<div className="engineering-form-grid"><Select label="Provisório" value={form.provisionalId??''} onChange={event=>{field('provisionalId',event.target.value);field('lineId','');}} options={provisionalOptions} required/><Select label="Item" value={form.lineId??''} onChange={event=>chooseLine(event.target.value)} options={lineOptions} required/><Select label="Serviço" value={form.serviceId??''} onChange={event=>field('serviceId',event.target.value)} options={serviceOptions}/><Input label="Descrição" value={form.description??''} onChange={event=>field('description',event.target.value)} required/><Input label="Unidade" value={form.unit??'un'} onChange={event=>field('unit',event.target.value)} required/><Input label="Quantidade" type="number" step="0.01" min="0" value={form.quantity??''} onChange={event=>field('quantity',event.target.value)} required/><Input label="Valor unitário" type="number" step="0.01" min="0" value={form.unitPrice??''} onChange={event=>field('unitPrice',event.target.value)} required/></div>}
    </Dialog>
  </>;
}
