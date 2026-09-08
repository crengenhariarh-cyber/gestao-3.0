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
interface Props { scope:{tenantId:string;companyId:string}; workName:string; contractNumber:string; onChanged:()=>void; }

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const quantity=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3});
const dateLabel=(value:string)=>{if(!value)return'—';const [year,month,day]=value.slice(0,10).split('-');return day&&month&&year?`${day}/${month}/${year}`:value;};
const monthLabel=(value:string)=>{if(!value)return'—';const [year,month]=value.slice(0,7).split('-');return month&&year?`${month}/${year}`:value;};
const statusLabel=(status:string)=>status==='closed'?'Fechado':'Aberto';

export function EngineeringProductionWorkspace({scope,workName,contractNumber,onChanged}:Props){
  const [snapshot,setSnapshot]=useState<EngineeringProductionSnapshot|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [periodFilter,setPeriodFilter]=useState('all');
  const [action,setAction]=useState<ProductionAction>(null);
  const reload=useCallback(async()=>{setLoading(true);setError(null);try{setSnapshot(await loadEngineeringProduction(scope,workName));}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível carregar a Produção.');}finally{setLoading(false);}},[scope,workName]);
  useEffect(()=>{void reload();},[reload]);
  const periods=useMemo(()=>snapshot?.periods??[],[snapshot]);
  const entries=useMemo(()=>snapshot?.entries??[],[snapshot]);
  const normalized=search.trim().toLocaleLowerCase('pt-BR');
  const visibleEntries=useMemo(()=>entries.filter(item=>{const matchesPeriod=periodFilter==='all'||item.periodId===periodFilter;const haystack=`${item.employeeName} ${item.structureName} ${item.serviceName} ${item.productionDate} ${item.notes??''}`.toLocaleLowerCase('pt-BR');return matchesPeriod&&(!normalized||haystack.includes(normalized));}),[entries,normalized,periodFilter]);
  const totalValue=entries.reduce((sum,item)=>sum+(item.productionValue??0),0);
  const employeeCount=new Set(entries.map(item=>item.employmentContractId)).size;
  const openPeriods=periods.filter(item=>item.status==='open').length;
  const periodOptions=[{value:'all',label:'Todas as competências'},...periods.map(item=>({value:item.id,label:`${monthLabel(item.competence)} · ${statusLabel(item.status)}`}))];
  const changed=()=>{onChanged();void reload();};
  if(loading&&!snapshot)return <LoadingState label="Carregando Produção…"/>;
  if(error&&!snapshot)return <Feedback title="Produção indisponível" message={error} tone="danger"/>;
  return <section className="engineering-production-workspace" aria-label="Produção">
    <header className="engineering-production-workspace__header"><div><h2>Produção</h2><p className="ui-muted">Contrato {contractNumber} · lançamentos, equipe e fechamentos.</p></div><div className="engineering-production-workspace__actions"><Button onClick={()=>setAction('productionEntry')}>＋ Lançar produção</Button><Button variant="secondary" onClick={()=>setAction('productionPeriod')}>Nova competência</Button><Button variant="secondary" onClick={()=>setAction('productionStatus')}>Fechar / reabrir</Button></div></header>
    {error&&<Feedback title="Atualização incompleta" message={error} tone="warning"/>}
    <div className="engineering-production-workspace__kpis"><Card title="Períodos"><strong>{periods.length}</strong><span>{openPeriods} aberto(s)</span></Card><Card title="Lançamentos"><strong>{entries.length}</strong><span>Histórico da obra</span></Card><Card title="Colaboradores"><strong>{employeeCount}</strong><span>Com produção lançada</span></Card><Card title="Valor produzido"><strong>{currency.format(totalValue)}</strong><span>Total registrado</span></Card></div>
    <div className="engineering-production-workspace__tools"><Input label="Buscar" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Colaborador, torre, unidade ou serviço"/><Select label="Competência" value={periodFilter} onChange={event=>setPeriodFilter(event.target.value)} options={periodOptions}/><Button variant="secondary" onClick={()=>window.print()}>Imprimir relatório</Button></div>
    {visibleEntries.length===0?<EmptyState title="Nenhuma produção encontrada" message={entries.length===0?'Ainda não há lançamentos de produção para esta obra.':'Nenhum lançamento corresponde aos filtros atuais.'}/>:<div className="engineering-production-workspace__list">{visibleEntries.map(item=><Card key={item.id} className="engineering-production-entry"><div className="engineering-production-entry__head"><div><strong>{item.employeeName}</strong><span>{dateLabel(item.productionDate)} · {item.structureName}</span></div><Badge>{item.serviceName}</Badge></div><div className="engineering-production-entry__values"><span>Quantidade <strong>{quantity.format(item.executedQuantity)}</strong></span><span>Valor unitário <strong>{item.unitValue===null?'—':currency.format(item.unitValue)}</strong></span><span>Total <strong>{item.productionValue===null?'—':currency.format(item.productionValue)}</strong></span></div>{item.notes&&<p className="ui-muted engineering-production-entry__notes">{item.notes}</p>}</Card>)}</div>}
    {action&&<EngineeringOperationsPanel activeTab="producao" scope={scope} onChanged={changed} initialKind={action} hideActions onDialogClosed={()=>setAction(null)}/>} 
  </section>;
}