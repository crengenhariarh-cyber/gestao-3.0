import { useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { EngineeringProductionSnapshot } from '../infrastructure/EngineeringProductionReadRepository';

interface Props {
  open:boolean;
  snapshot:EngineeringProductionSnapshot;
  onClose:()=>void;
  onChanged:()=>void;
}
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const monthLabel=(value:string)=>{const [y,m]=value.slice(0,7).split('-');return m&&y?`${m}/${y}`:value;};

export function EngineeringProductionClosingDialog({open,snapshot,onClose,onChanged}:Props){
  const periods=snapshot.periods;
  const [periodId,setPeriodId]=useState(periods[0]?.id??'');
  const [action,setAction]=useState<'close'|'reopen'>('close');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const period=periods.find(item=>item.id===periodId);
  const rows=useMemo(()=>snapshot.entries.filter(item=>item.periodId===periodId),[snapshot.entries,periodId]);
  const total=rows.reduce((sum,item)=>sum+(item.productionValue??0),0);
  const participants=useMemo(()=>{
    const map=new Map<string,{name:string;value:number;entries:number}>();
    for(const entry of rows){
      const shares=entry.participants.length?entry.participants:[{employmentContractId:entry.employmentContractId,employeeName:entry.employeeName,percentage:100,value:entry.productionValue??0}];
      for(const share of shares){const current=map.get(share.employmentContractId)??{name:share.employeeName,value:0,entries:0};current.value+=share.value;current.entries+=1;map.set(share.employmentContractId,current);}
    }
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  },[rows]);
  async function confirm(){
    if(!periodId)return;
    if(action==='reopen'&&!reason.trim()){setError('Informe o motivo da reabertura.');return;}
    setBusy(true);setError(null);
    try{
      const client=getSupabaseClient();
      const result=await client.rpc('set_engineering_production_period_status',{p_period_id:periodId,p_action:action,p_reason:action==='reopen'?reason.trim():null});
      if(result.error)throw result.error;
      onChanged();onClose();
    }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível atualizar o fechamento.');}
    finally{setBusy(false);}
  }
  return <Dialog open={open} title="Fechamento da produção" description="Confira a competência e os valores antes de confirmar." onClose={onClose} onBack={onClose} footer={<Button loading={busy} onClick={confirm}>{action==='close'?'Confirmar fechamento':'Confirmar reabertura'}</Button>}>
    <div className="engineering-production-closing">
      {error&&<Feedback tone="danger" title="Operação não concluída" message={error}/>} 
      <div className="engineering-production-closing__filters"><Select label="Competência" value={periodId} onChange={event=>{setPeriodId(event.target.value);setReason('');setError(null);}} options={periods.map(item=>({value:item.id,label:`${monthLabel(item.competence)} · ${item.status==='closed'?'Fechado':'Aberto'}`}))}/><Select label="Ação" value={action} onChange={event=>{setAction(event.target.value as 'close'|'reopen');setError(null);}} options={[{value:'close',label:'Fechar competência'},{value:'reopen',label:'Reabrir competência'}]}/>{action==='reopen'&&<Input label="Motivo da reabertura" value={reason} onChange={event=>setReason(event.target.value)} required/>}</div>
      <div className="engineering-production-closing__summary"><Card title="Competência"><strong>{period?monthLabel(period.competence):'—'}</strong><span>{period?.status==='closed'?'Fechada':'Aberta'}</span></Card><Card title="Lançamentos"><strong>{rows.length}</strong><span>Incluídos na conferência</span></Card><Card title="Colaboradores"><strong>{participants.length}</strong><span>Com participação</span></Card><Card title="Valor total"><strong>{currency.format(total)}</strong><span>Produção da competência</span></Card></div>
      <section className="engineering-production-closing__review"><header><div><h4>Conferência por colaborador</h4><span>{participants.length} colaborador(es)</span></div><strong>{currency.format(total)}</strong></header>{participants.length===0?<p className="ui-muted">Nenhum lançamento nesta competência.</p>:participants.map(item=><div className="engineering-production-closing__employee" key={item.name}><div><strong>{item.name}</strong><span>{item.entries} participação(ões)</span></div><b>{currency.format(item.value)}</b></div>)}</section>
    </div>
  </Dialog>;
}