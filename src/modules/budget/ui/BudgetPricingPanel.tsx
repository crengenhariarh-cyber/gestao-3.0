import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';

type ContractRow={id:string;contract_number:string;work_name?:string|null};
type SettingsRow={id:string;contract_id:string|null;target_net_margin_percent:number|string};
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
 const [marginPercent,setMarginPercent]=useState('20');
 const [contractId,setContractId]=useState('');
 const [contracts,setContracts]=useState<ContractRow[]>([]);
 const [projection,setProjection]=useState<ProjectionRow|null>(null);

 const load=useCallback(async()=>{
  if(!tenantId||!companyId)return;
  setLoading(true);setFeedback(null);
  let settingsQuery=supabase.from('budget_planning_settings').select('id,contract_id,target_net_margin_percent').eq('tenant_id',tenantId).eq('company_id',companyId).eq('budget_year',budgetYear);
  settingsQuery=costCenterId?settingsQuery.eq('cost_center_id',costCenterId):settingsQuery.is('cost_center_id',null);
  const [settingsResult,contractsResult]=await Promise.all([
   settingsQuery.maybeSingle(),
   supabase.from('engineering_contracts').select('id,contract_number,work_name').eq('tenant_id',tenantId).eq('company_id',companyId).order('contract_number'),
  ]);
  if(settingsResult.error||contractsResult.error){setFeedback({tone:'danger',message:settingsResult.error?.message??contractsResult.error?.message??'Não foi possível carregar a formação de preço.'});setLoading(false);return;}
  const settings=(settingsResult.data??null) as SettingsRow|null;
  setSettingsId(settings?.id??null);setMarginPercent(settings?String(numberValue(settings.target_net_margin_percent)):'20');setContractId(settings?.contract_id??'');
  setContracts((contractsResult.data??[]) as ContractRow[]);
  if(settings){
   let projectionQuery=supabase.from('budget_required_revenue_projection').select('annual_expense,required_net_revenue,retention_rate_percent,fixed_retention_amount,required_gross_revenue,realized_gross_revenue,realized_retained_amount,realized_net_revenue').eq('tenant_id',tenantId).eq('company_id',companyId).eq('budget_year',budgetYear);
   projectionQuery=costCenterId?projectionQuery.eq('cost_center_id',costCenterId):projectionQuery.is('cost_center_id',null);
   const projectionResult=await projectionQuery.maybeSingle();if(!projectionResult.error)setProjection((projectionResult.data??null) as ProjectionRow|null);
  }else setProjection(null);
  setLoading(false);
 },[tenantId,companyId,costCenterId,budgetYear]);
 useEffect(()=>{void load();},[load]);

 const margin=Math.max(0,Math.min(99.99,numberValue(marginPercent)));
 const calculatedNet=annualOperationalCost>0?annualOperationalCost/(1-margin/100):0;
 const retentionRate=projection?numberValue(projection.retention_rate_percent):0;
 const fixedRetention=projection?numberValue(projection.fixed_retention_amount):0;
 const calculatedGross=contractId&&retentionRate<100?(calculatedNet+fixedRetention)/(1-retentionRate/100):calculatedNet;
 const projectedNet=projection?numberValue(projection.required_net_revenue):calculatedNet;
 const projectedGross=projection?numberValue(projection.required_gross_revenue):calculatedGross;
 const contractOptions=useMemo(()=>[{value:'',label:'Sem contrato / sem retenções'},...contracts.map(item=>({value:item.id,label:item.work_name?`${item.contract_number} · ${item.work_name}`:item.contract_number}))],[contracts]);

 async function save(){
  if(!tenantId||!companyId)return;setSaving(true);setFeedback(null);
  const payload={tenant_id:tenantId,company_id:companyId,cost_center_id:costCenterId||null,budget_year:budgetYear,contract_id:contractId||null,target_net_margin_percent:margin,updated_at:new Date().toISOString()};
  const result=settingsId?await supabase.from('budget_planning_settings').update(payload).eq('id',settingsId).eq('tenant_id',tenantId).eq('company_id',companyId):await supabase.from('budget_planning_settings').insert(payload).select('id').single();
  if(result.error)setFeedback({tone:'danger',message:result.error.message});else{setFeedback({tone:'success',message:'Margem e retenções vinculadas ao orçamento foram salvas.'});await load();}
  setSaving(false);
 }

 return <Card title="Formação de preço" description="Custos da obra, margem e retenções ficam separados. INSS, ISS e retenção contratual não entram como despesa operacional prevista.">
  <div style={{display:'grid',gap:12}}>
   {feedback&&<Feedback tone={feedback.tone} title={feedback.tone==='success'?'Concluído':'Não foi possível salvar'} message={feedback.message}/>} 
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}}>
    <div className="budget-workspace__metric"><div className="budget-workspace__metric-head"><span>Custo operacional</span><small>Previsto</small></div><strong>{money(annualOperationalCost)}</strong><div className="budget-workspace__metric-foot"><span>Base para formação de preço</span></div></div>
    <div className="budget-workspace__metric budget-workspace__metric--result"><div className="budget-workspace__metric-head"><span>Receita líquida necessária</span><small>{margin.toFixed(2)}% margem</small></div><strong>{money(projectedNet)}</strong><div className="budget-workspace__metric-foot"><span>Após custos, antes das retenções</span></div></div>
    <div className="budget-workspace__metric budget-workspace__metric--expense"><div className="budget-workspace__metric-head"><span>Retenções</span><small>Contrato</small></div><strong>{retentionRate.toFixed(2)}%</strong><div className="budget-workspace__metric-foot"><span>Fixa</span><b>{money(fixedRetention)}</b></div></div>
    <div className="budget-workspace__metric budget-workspace__metric--income"><div className="budget-workspace__metric-head"><span>Faturamento bruto</span><small>Necessário</small></div><strong>{money(projectedGross)}</strong><div className="budget-workspace__metric-foot"><span>Valor antes de INSS/ISS/RT</span></div></div>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10,alignItems:'end'}}>
    <Input label="Margem desejada (%)" type="number" min="0" max="99.99" step="0.01" value={marginPercent} onChange={event=>setMarginPercent(event.target.value)}/>
    <Select label="Contrato / regras de retenção" value={contractId} onChange={event=>setContractId(event.target.value)} options={contractOptions}/>
    <Button onClick={()=>{void save();}} disabled={saving||loading}>{saving?'Salvando…':'Salvar formação de preço'}</Button>
   </div>
   <p className="ui-muted" style={{margin:0}}>A margem de 20% é calculada sobre o custo para obter a receita líquida necessária. As retenções do contrato são acrescentadas somente para chegar ao faturamento bruto, sem inflar as despesas da obra.</p>
  </div>
 </Card>;
}
