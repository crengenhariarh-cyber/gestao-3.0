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
  const visibleEntries=useMemo(()=>entries.filter(item=>{const participants=item.participants.map(p=>p.employeeName).join(' ');const matchesPeriod=periodFilter==='all'||item.periodId===periodFilter;const haystack=`${item.employeeName} ${participants} ${item.structureName} ${item.serviceName} ${item.productionDate} ${item.notes??''}`.toLocaleLowerCase('pt-BR');return matchesPeriod&&(!normalized||haystack.includes(normalized));}),[entries,normalized,periodFilter]);
  const totalValue=entries.reduce((sum,item)=>sum+(item.productionValue??0),0);
  const employeeCount=new Set(entries.flatMap(item=>item.participants.length?item.participants.map(p=>p.employmentContractId):[item.employmentContractId])).size;
  const splitEntries=entries.filter(item=>item.participants.length>1).length;
  const openPeriods=periods.filter(item=>item.status==='open').length;
  const periodOptions=[{value:'all',label:'Todas as competências'},...periods.map(item=>({value:item.id,label:`${monthLabel(item.competence)} · ${statusLabel(item.status)}`}))];
  const changed=()=>{onChanged();void reload();};
  if(loading&&!snapshot)return <LoadingState label="Carregando Produção…"/>;
  if(error&&!snapshot)return <Feedback title="Produção indisponível" message={error} tone="danger"/>;

  return <section className="engineering-production-parity" aria-label="Produção">
    <header className="engineering-production-parity__head"><div><small>PRODUÇÃO</small><h3>{workName}</h3><p>Contrato {contractNumber} · acompanhamento, lançamentos e fechamentos.</p></div><span>{entries.length} lançamento(s)</span></header>
    {error&&<Feedback title="Atualização incompleta" message={error} tone="warning"/>}

    <div className="engineering-production-parity__actions"><Button onClick={()=>setAction('productionEntry')}>＋ Lançar produção</Button><Button variant="secondary" onClick={()=>setAction('productionPeriod')}>Nova competência</Button><Button variant="secondary" onClick={()=>setAction('productionStatus')}>Fechar / reabrir</Button><Button variant="secondary" onClick={()=>window.print()}>Imprimir relatório</Button></div>

    <div className="engineering-production-parity__kpis"><Card title="Produção registrada"><strong>{currency.format(totalValue)}</strong><span>Histórico da obra</span></Card><Card title="Lançamentos"><strong>{entries.length}</strong><span>{splitEntries} dividido(s)</span></Card><Card title="Colaboradores"><strong>{employeeCount}</strong><span>Com participação</span></Card><Card title="Competências"><strong>{periods.length}</strong><span>{openPeriods} aberta(s)</span></Card></div>

    <section className="engineering-production-parity__periods"><div className="engineering-production-parity__section-head"><div><h4>Competências</h4><span>Abertas e fechadas, sem esconder o histórico.</span></div></div>{periods.length===0?<EmptyState title="Nenhuma competência" message="Abra uma competência para iniciar novos lançamentos."/>:<div className="engineering-production-parity__period-list">{periods.map(period=>{const periodEntries=entries.filter(item=>item.periodId===period.id);const periodTotal=periodEntries.reduce((sum,item)=>sum+(item.productionValue??0),0);return <Card key={period.id} className="engineering-production-parity__period"><div><b>{monthLabel(period.competence)}</b><Badge>{statusLabel(period.status)}</Badge></div><span>{periodEntries.length} lançamento(s)</span><strong>{currency.format(periodTotal)}</strong><Button size="sm" variant="tertiary" onClick={()=>setPeriodFilter(period.id)}>Ver lançamentos</Button></Card>;})}</div>}</section>

    <div className="engineering-production-parity__filters"><Input label="Buscar lançamento" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Colaborador, torre, unidade ou serviço"/><Select label="Competência" value={periodFilter} onChange={event=>setPeriodFilter(event.target.value)} options={periodOptions}/></div>

    <section className="engineering-production-parity__entries"><div className="engineering-production-parity__section-head"><div><h4>Lançamentos</h4><span>{visibleEntries.length} registro(s) no filtro atual</span></div>{periodFilter!=='all'&&<Button size="sm" variant="tertiary" onClick={()=>setPeriodFilter('all')}>Limpar competência</Button>}</div>{visibleEntries.length===0?<EmptyState title="Nenhuma produção encontrada" message={entries.length===0?'Ainda não há lançamentos de produção para esta obra.':'Nenhum lançamento corresponde aos filtros atuais.'}/>:<div className="engineering-production-parity__table-wrap"><table className="engineering-production-parity__table"><thead><tr><th>Data</th><th>Colaborador(es)</th><th>Estrutura</th><th>Serviço</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>{visibleEntries.map(item=>{const participants=item.participants.length?item.participants:[{employmentContractId:item.employmentContractId,employeeName:item.employeeName,percentage:100,value:item.productionValue??0}];return <tr key={item.id}><td>{dateLabel(item.productionDate)}</td><td>{participants.map(p=><div key={p.employmentContractId}><strong>{p.employeeName}</strong>{participants.length>1&&<span> · {quantity.format(p.percentage)}% · {currency.format(p.value)}</span>}</div>)}</td><td>{item.structureName}</td><td>{item.serviceName}</td><td>{quantity.format(item.executedQuantity)}</td><td>{item.unitValue===null?'—':currency.format(item.unitValue)}</td><td><strong>{item.productionValue===null?'—':currency.format(item.productionValue)}</strong></td></tr>;})}</tbody></table></div>}</section>

    {action&&<EngineeringOperationsPanel activeTab="producao" scope={scope} onChanged={changed} initialKind={action} hideActions onDialogClosed={()=>setAction(null)}/>} 
  </section>;
}