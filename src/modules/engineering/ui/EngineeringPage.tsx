import { useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { Tabs } from '../../../shared/ui/Tabs';
import { useEngineeringOverview } from './useEngineeringOverview';
import './engineering.css';

interface EngineeringPageProps { company: CompanySummary; }
const currency = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export function EngineeringPage({company}:EngineeringPageProps) {
  const [activeTab,setActiveTab]=useState('contratos');
  const tabs=useMemo(()=>[
    {id:'contratos',label:'Contratos'},{id:'medicoes',label:'Medições'},{id:'producao',label:'Produção'},{id:'aditivos',label:'Aditivos'},{id:'provisorios',label:'Provisórios'},
  ],[]);
  const overview=useEngineeringOverview({tenantId:company.tenantId,companyId:company.id});
  if(overview.status==='idle'||overview.status==='loading') return <LoadingState label="Carregando Engenharia…"/>;
  if(overview.status==='error') return <EmptyState title="Engenharia indisponível" message={overview.errorMessage}/>;
  const data=overview.data;

  const empty=<p className="ui-muted">Nenhum registro nesta empresa.</p>;
  return <section className="engineering-overview" aria-labelledby="engineering-title">
    <div className="engineering-overview__heading"><div><span className="ui-muted">Módulo operacional</span><h1 id="engineering-title">Engenharia</h1></div><p className="ui-muted">Contratos, medições, produção, provisórios e aditivos integrados à empresa selecionada.</p></div>
    <Tabs items={tabs} activeId={activeTab} onChange={setActiveTab} ariaLabel="Seções da engenharia"/>
    <div className="engineering-workspace" role="tabpanel" tabIndex={0}><div className="engineering-workspace__canvas">
      {activeTab==='contratos'&&<Card title="Contratos" description="Valor atualizado, medido e saldo">{data.contracts.length===0?empty:<div className="engineering-data-list">{data.contracts.map(item=><div className="engineering-data-row" key={item.contractId}><div><strong>{item.contractNumber}</strong><span>{item.status}</span></div><div><span>{currency.format(item.updatedContractValue)}</span><span>Medido {currency.format(item.measuredNet)} · {item.measuredPercent.toFixed(2)}%</span><span>Saldo {currency.format(item.grossBalance)}</span></div></div>)}</div>}</Card>}
      {activeTab==='medicoes'&&<Card title="Medições" description="Competência, retenções e valor líquido">{data.measurements.length===0?empty:<div className="engineering-data-list">{data.measurements.map(item=><div className="engineering-data-row" key={item.measurementId}><div><strong>{item.competence}</strong><span>{item.status}</span></div><div><span>Bruto {currency.format(item.grossAmount)}</span><span>Retido {currency.format(item.retainedAmount)}</span><span>Líquido {currency.format(item.netAmount)}</span></div></div>)}</div>}</Card>}
      {activeTab==='producao'&&<Card title="Produção" description="Produção registrada por vínculo e competência">{data.production.length===0?empty:<div className="engineering-data-list">{data.production.map((item,index)=><div className="engineering-data-row" key={`${item.employmentContractId}-${item.competence}-${index}`}><div><strong>{item.competence}</strong><span>Vínculo {item.employmentContractId.slice(0,8)}</span></div><div><span>Qtd. {item.executedQuantity}</span><span>{currency.format(item.productionValue)}</span></div></div>)}</div>}</Card>}
      {activeTab==='aditivos'&&<Card title="Aditivos" description="Aditivos vinculados aos contratos">{data.addenda.length===0?empty:<div className="engineering-data-list">{data.addenda.map(item=><div className="engineering-data-row" key={item.id}><div><strong>{item.addendumNumber}</strong><span>{item.addendumType} · {item.status}</span></div><div><span>{item.statedValue===null?'Valor por linhas':currency.format(item.statedValue)}</span></div></div>)}</div>}</Card>}
      {activeTab==='provisorios'&&<Card title="Provisórios" description="Negociações editáveis antes da conversão">{data.provisionals.length===0?empty:<div className="engineering-data-list">{data.provisionals.map(item=><div className="engineering-data-row" key={item.id}><div><strong>{item.provisionalNumber}</strong><span>{item.title??'Sem título'}</span></div><div><span>{item.status}</span><span>{item.clientName??'Cliente não informado'}</span></div></div>)}</div>}</Card>}
    </div></div>
  </section>;
}
