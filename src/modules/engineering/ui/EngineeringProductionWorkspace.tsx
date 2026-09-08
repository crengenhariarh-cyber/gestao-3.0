import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { loadEngineeringProduction, type EngineeringProductionSnapshot } from '../infrastructure/EngineeringProductionReadRepository';
import { EngineeringOperationsPanel } from './EngineeringOperationsPanel';

type ProductionAction='productionPeriod'|'productionEntry'|'productionStatus'|null;
interface Props { scope:{tenantId:string;companyId:string}; workId:string; contractId:string; contractNumber:string; onChanged:()=>void; }

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const quantity=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3});
const dateLabel=(value:string)=>{if(!value)return'—';const [year,month,day]=value.slice(0,10).split('-');return day&&month&&year?`${day}/${month}/${year}`:value;};
const monthLabel=(value:string)=>{if(!value)return'—';const [year,month]=value.slice(0,7).split('-');return month&&year?`${month}/${year}`:value;};
const statusLabel=(status:string)=>status==='closed'?'Fechado':'Aberto';

export function EngineeringProductionWorkspace({scope,workId,contractId,contractNumber,onChanged}:Props){
  const [snapshot,setSnapshot]=useState<EngineeringProductionSnapshot|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [periodFilter,setPeriodFilter]=useState('all');
  const [action,setAction]=useState<ProductionAction>(null);
  const reload=useCallback(async()=>{setLoading(true);setError(null);try{setSnapshot(await loadEngineeringProduction(scope,workId));}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível carregar a Produção.');}finally{setLoading(false);}},[scope,workId]);
  useEffect(()=>{void reload();},[reload]);
  const periods=snapshot?.periods??[];
  const entries=snapshot?.entries??[];
  const normalized=search.trim().toLocaleLowerCase('pt-BR');
  const visibleEntries=useMemo(()=>entries.filter(item=>{
    const matchesPeriod=periodFilter==='all'||item.periodId===periodFilter;
    const haystack=`${item.employeeName} ${item.structureName} ${item.serviceName} ${item.productionDate} ${item.notes??''}`.toLocaleLowerCase('pt-BR');
    return matchesPeriod&&(!normalized||haystack.includes(normalized));
  }),[entries,normalized,periodFilter]);
  const totalValue=entries.reduce((sum,item)=>sum+(item.productionValue??0),0);
  const employeeCount=new Set(entries.map(item=>item.employmentContractId)).size;
  const openPeriods=periods.filter(item=>item.status==='open').length;
  const periodOptions=[{value:'all',label:'Todas as competências'},...periods.map(item=>({value:item.id,label:`${monthLabel(item.competence)} · ${statusLabel(item.status)}`}))];
  const changed=()=>{onChanged();void reload();};

  if(loading&&!snapshot)return <LoadingState label="Carregando Produção…"/>;
  if(error&&!snapshot)return <Feedback title="Produção indisponível" message={error} tone="danger"/>;

  return <section className="engineering-production-parity" aria-label="Produção">
    <header className="engineering-production-parity__head">
      <div><small>EXECUÇÃO DA EQUIPE</small><h3>Produção</h3><p>Produção por colaborador, estrutura e serviço, com fechamento por competência.</p></div>
      <span>{contractNumber}</span>
    </header>

    <div className="engineering-production-parity__actions">
      <Button onClick={()=>setAction('productionEntry')} disabled={periods.length===0}>＋ Lançar produção</Button>
      <Button variant="secondary" onClick={()=>setAction('productionPeriod')}>＋ Novo período</Button>
      <Button variant="secondary" onClick={()=>setAction('productionStatus')} disabled={periods.length===0}>Fechar / reabrir</Button>
    </div>

    {error&&<Feedback title="Atenção" message={error} tone="warning"/>}

    <div className="engineering-production-parity__kpis">
      <Card title="Períodos"><strong>{periods.length}</strong><span>{openPeriods} aberto(s)</span></Card>
      <Card title="Lançamentos"><strong>{entries.length}</strong><span>Registros preservados</span></Card>
      <Card title="Colaboradores"><strong>{employeeCount}</strong><span>Com produção lançada</span></Card>
      <Card title="Valor produzido"><strong>{currency.format(totalValue)}</strong><span>Somatório dos lançamentos</span></Card>
    </div>

    <div className="engineering-production-parity__filters">
      <Input label="Buscar" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Colaborador, torre, serviço ou observação"/>
      <Select label="Competência" value={periodFilter} onChange={event=>setPeriodFilter(event.target.value)} options={periodOptions}/>
    </div>

    <section className="engineering-production-parity__periods" aria-label="Períodos de produção">
      <h4>Competências</h4>
      {periods.length===0?<EmptyState title="Nenhum período de produção" message="Abra uma competência para começar os lançamentos."/>:<div className="engineering-production-parity__period-list">{periods.map(period=>{const periodEntries=entries.filter(item=>item.periodId===period.id);const value=periodEntries.reduce((sum,item)=>sum+(item.productionValue??0),0);return <Card key={period.id} className="engineering-production-parity__period"><div><strong>{monthLabel(period.competence)}</strong><Badge tone={period.status==='closed'?'success':'info'}>{statusLabel(period.status)}</Badge></div><span>{periodEntries.length} lançamento(s)</span><b>{currency.format(value)}</b></Card>;})}</div>}
    </section>

    <section className="engineering-production-parity__entries" aria-label="Lançamentos de produção">
      <div className="engineering-production-parity__section-head"><div><h4>Lançamentos</h4><span>{visibleEntries.length} de {entries.length} registro(s)</span></div></div>
      {entries.length===0?<EmptyState title="Nenhuma produção lançada" message="Use Lançar produção para registrar a execução da equipe."/>:<div className="engineering-production-parity__table-wrap"><table className="engineering-production-parity__table"><thead><tr><th>Data</th><th>Colaborador</th><th>Estrutura</th><th>Serviço</th><th>Quantidade</th><th>Valor unit.</th><th>Total</th></tr></thead><tbody>{visibleEntries.map(item=><tr key={item.id}><td>{dateLabel(item.productionDate)}</td><td><strong>{item.employeeName}</strong></td><td>{item.structureName}</td><td>{item.serviceName}</td><td>{quantity.format(item.executedQuantity)}</td><td>{item.unitValue===null?'—':currency.format(item.unitValue)}</td><td><strong>{item.productionValue===null?'—':currency.format(item.productionValue)}</strong></td></tr>)}</tbody></table>{visibleEntries.length===0&&<EmptyState title="Nenhum lançamento no filtro" message="Altere a busca ou a competência selecionada."/>}</div>}
    </section>

    {action&&<EngineeringOperationsPanel key={action} activeTab="producao" scope={scope} focusedContractId={contractId} initialKind={action} hideActions onChanged={changed} onDialogClosed={()=>setAction(null)}/>}
  </section>;
}
