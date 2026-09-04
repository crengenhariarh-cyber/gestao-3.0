import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';

type ContractRow={id:string;contract_number:string;client_name?:string|null};
type SettingsRow={id:string;contract_id:string|null;target_markup_percent:number|string};
type ProjectionRow={annual_expense:number|string;required_net_revenue:number|string;retention_rate_percent:number|string;fixed_retention_amount:number|string;required_gross_revenue:number|string;realized_gross_revenue:number|string;realized_retained_amount:number|string;realized_net_revenue:number|string};

const supabase=getSupabaseClient();
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const money=(value:number)=>currency.format(Number.isFinite(value)?value:0);
const numberValue=(value:number|string|null|undefined)=>{const parsed=Number(String(value??0).replace(',','.'));return Number.isFinite(parsed)?parsed:0;};

export function BudgetPricingPanel({tenantId,companyId,costCenterId,budgetYear,annualOperationalCost}:{tenantId:string;companyId:string;costCenterId:string;budgetYear:number;annualOperationalCost:number}){
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [feedback,setFeedback]=useState<{tone:'danger'|'success';message:string}|null>(null);
 const [settingsId,setSettingsId]=useState<string|null>(null);
 const [markupPercent,setMarkupPercent]=useState('20');
 const [contractId,setContractId]=useState('');
 const [contracts,setContracts]=useState<ContractRow[]>([]);
 const [projection,setProjection]=useState<ProjectionRow|null>(null);

 const load=useCallback(async()=>{
  if(!tenantId||!companyId)return;
  setLoading(true);setFeedback(null);
  let settingsQuery=supabase.from('budget_planning_settings').select('id,contract_id,target_markup_percent').eq('tenant_id',tenantId).eq('company_id',companyId).eq('budget_year',budgetYear);
  settingsQuery=costCenterId?settingsQuery.eq('cost_center_id',costCenterId):settingsQuery.is('cost_center_id',null);
  const [settingsResult,contractsResult]=await Promise.all([
   settingsQuery.maybeSingle(),
   supabase.from('engineering_contracts').select('id,contract_number,client_name').eq('tenant_id',tenantId).eq('company_id',companyId).order('contract_number'),
  ]);
  if(settingsResult.error||contractsResult.error){setFeedback({tone:'danger',message:settingsResult.error?.message??contractsResult.error?.message??'Não foi possível carregar a formação de preço.'});setLoading(false);return;}
  const settings=(settingsResult.data??null) as SettingsRow|null;
  setSettingsId(settings?.id??null);setMarkupPercent(settings?String(numberValue(settings.target_markup_percent)):'20');setContractId(settings?.contract_id??'');
  setContracts((contractsResult.data??[]) as ContractRow[]);
  if(settings){
   let projectionQuery=supabase.from('budget_required_revenue_projection').select('annual_expense,required_net_revenue,retention_rate_percent,fixed_retention_amount,required_gross_revenue,realized_gross_revenue,realized_retained_amount,realized_net_revenue').eq('tenant_id',tenantId).eq('company_id',companyId).eq('budget_year',budgetYear);
   projectionQuery=costCenterId?projectionQuery.eq('cost_center_id',costCenterId):projectionQuery.is('cost_center_id',null);
   const projectionResult=await projectionQuery.maybeSingle();if(!projectionResult.error)setProjection((projectionResult.data??null) as ProjectionRow|null);
  }else setProjection(null);
  setLoading(false);
 },[tenantId,companyId,costCenterId,budgetYear]);
 useEffect(()=>{void load();},[load]);

 const targetNetMargin=Math.max(0,Math.min(99.99,numberValue(markupPercent)));
 const calculatedNet=annualOperationalCost>0?annualOperationalCost/(1-targetNetMargin/100):0;
 const retentionRate=projection?numberValue(projection.retention_rate_percent):0;
 const fixedRetention=projection?numberValue(projection.fixed_retention_amount):0;
 const calculatedGross=contractId&&retentionRate<100?(calculatedNet+fixedRetention)/(1-retentionRate/100):calculatedNet;
 const projectedNet=projection?numberValue(projection.required_net_revenue):calculatedNet;
 const projectedGross=projection?numberValue(projection.required_gross_revenue):calculatedGross;
 const projectedProfit=Math.max(0,projectedNet-annualOperationalCost);
 const contractOptions=useMemo(()=>[{value:'',label:'Sem contrato / sem retenções'},...contracts.map(item=>({value:item.id,label:item.client_name?`${item.contract_number} · ${item.client_name}`:item.contract_number}))],[contracts]);

 async function save(){
  if(!tenantId||!companyId)return;setSaving(true);setFeedback(null);
  const payload={tenant_id:tenantId,company_id:companyId,cost_center_id:costCenterId||null,budget_year:budgetYear,contract_id:contractId||null,target_markup_percent:targetNetMargin,updated_at:new Date().toISOString()};
  const result=settingsId?await supabase.from('budget_planning_settings').update(payload).eq('id',settingsId).eq('tenant_id',tenantId).eq('company_id',companyId):await supabase.from('budget_planning_settings').insert(payload).select('id').single();
  if(result.error)setFeedback({tone:'danger',message:result.error.message});else{setFeedback({tone:'success',message:'Margem líquida desejada e retenções vinculadas ao orçamento foram salvas.'});await load();}
  setSaving(false);
 }

 return <Card title="Formação de preço" description="O preço é calculado para que, depois de pagar todas as despesas previstas, reste a margem líquida desejada. Retenções contratuais são compensadas no faturamento bruto.">
  <div style={{display:'grid',gap:12}}>
   {feedback&&<Feedback tone={feedback.tone} title={feedback.tone==='success'?'Concluído':'Não foi possível salvar'} message={feedback.message}/>} 
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}}>
    <div className="budget-workspace__metric"><div className="budget-workspace__metric-head"><span>Custo operacional</span><small>Previsto</small></div><strong>{money(annualOperationalCost)}</strong><div className="budget-workspace__metric-foot"><span>Base da formação de preço</span></div></div>
    <div className="budget-workspace__metric budget-workspace__metric--result"><div className="budget-workspace__metric-head"><span>Receita líquida necessária</span><small>Margem líquida {targetNetMargin.toFixed(2)}%</small></div><strong>{money(projectedNet)}</strong><div className="budget-workspace__metric-foot"><span>Lucro líquido projetado</span><b>{money(projectedProfit)}</b></div></div>
    <div className="budget-workspace__metric budget-workspace__metric--expense"><div className="budget-workspace__metric-head"><span>Retenções</span><small>Contrato</small></div><strong>{retentionRate.toFixed(2)}%</strong><div className="budget-workspace__metric-foot"><span>Fixa</span><b>{money(fixedRetention)}</b></div></div>
    <div className="budget-workspace__metric budget-workspace__metric--income"><div className="budget-workspace__metric-head"><span>Faturamento bruto</span><small>Necessário</small></div><strong>{money(projectedGross)}</strong><div className="budget-workspace__metric-foot"><span>Antes das retenções contratuais</span></div></div>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10,alignItems:'end'}}>
    <Input label="Margem líquida desejada (%)" type="number" min="0" max="99.99" step="0.01" value={markupPercent} onChange={event=>setMarkupPercent(event.target.value)}/>
    <Select label="Contrato / regras de retenção" value={contractId} onChange={event=>setContractId(event.target.value)} options={contractOptions}/>
    <Button onClick={()=>{void save();}} disabled={saving||loading}>{saving?'Salvando…':'Salvar formação de preço'}</Button>
   </div>
   <p className="ui-muted" style={{margin:0}}>Exemplo: custo de R$ 100.000,00 com margem líquida desejada de 20% exige receita líquida de R$ 125.000,00. Depois de pagar os R$ 100.000,00 de despesas, sobram R$ 25.000,00, que representam 20% da receita. Retenções contratuais, quando existentes, aumentam apenas o faturamento bruto necessário para preservar essa margem líquida.</p>
  </div>
 </Card>;
}