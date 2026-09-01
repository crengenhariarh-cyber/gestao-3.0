import { useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { EngineeringOverview } from '../domain/overview';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Tabs } from '../../../shared/ui/Tabs';
import { EngineeringAddendumMaintenance } from './EngineeringAddendumMaintenance';
import { EngineeringOperationsPanel } from './EngineeringOperationsPanel';
import { EngineeringProvisionalMaintenance } from './EngineeringProvisionalMaintenance';
import { useEngineeringOverview } from './useEngineeringOverview';
import './engineering.css';

interface EngineeringPageProps { company: CompanySummary; }
type TabId='contratos'|'medicoes'|'producao'|'aditivos'|'provisorios';
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export function EngineeringPage({company}:EngineeringPageProps){
  const [activeTab,setActiveTab]=useState<TabId>('contratos');
  const [refreshToken,setRefreshToken]=useState(0);
  const scope=useMemo(()=>({tenantId:company.tenantId,companyId:company.id}),[company.id,company.tenantId]);
  const overview=useEngineeringOverview(scope,refreshToken);
  const tabs=useMemo(()=>[
    {id:'contratos',label:'Contratos'},{id:'medicoes',label:'Medições'},{id:'producao',label:'Produção'},{id:'aditivos',label:'Aditivos'},{id:'provisorios',label:'Provisórios'},
  ],[]);
  if(overview.status==='idle'||overview.status==='loading')return <LoadingState label="Carregando Engenharia…"/>;
  if(overview.status==='error')return <EmptyState title="Engenharia indisponível" message={overview.errorMessage}/>;
  if(overview.status!=='ready')return <EmptyState title="Engenharia indisponível" message="Não foi possível carregar os dados da Engenharia."/>;
  const data:EngineeringOverview=overview.data;
  const empty=<p className="ui-muted">Nenhum registro nesta empresa.</p>;
  const refresh=()=>setRefreshToken(value=>value+1);
  const contractUpdatedTotal=data.contracts.reduce((sum,item)=>sum+item.updatedContractValue,0);
  const contractMeasuredTotal=data.contracts.reduce((sum,item)=>sum+item.measuredNet,0);
  const contractBalanceTotal=data.contracts.reduce((sum,item)=>sum+item.grossBalance,0);
  const contractMeasuredPercent=contractUpdatedTotal>0?(contractMeasuredTotal/contractUpdatedTotal)*100:0;
  const measurementGrossTotal=data.measurements.reduce((sum,item)=>sum+item.grossAmount,0);
  const measurementRetainedTotal=data.measurements.reduce((sum,item)=>sum+item.retainedAmount,0);
  const measurementNetTotal=data.measurements.reduce((sum,item)=>sum+item.netAmount,0);
  const productionQuantityTotal=data.production.reduce((sum,item)=>sum+item.executedQuantity,0);
  const productionValueTotal=data.production.reduce((sum,item)=>sum+item.productionValue,0);
  const productionCompetences=new Set(data.production.map(item=>item.competence)).size;
  const addendaWithStatedValue=data.addenda.filter(item=>item.statedValue!==null);
  const addendaStatedTotal=addendaWithStatedValue.reduce((sum,item)=>sum+(item.statedValue??0),0);
  const provisionalClients=new Set(data.provisionals.map(item=>item.clientName).filter((value):value is string=>Boolean(value))).size;
  return <section className="engineering-overview" aria-labelledby="engineering-title">
    <PageHeader id="engineering-title" eyebrow="Módulo operacional" title="Engenharia" description="Contratos, medições, produção, provisórios e aditivos integrados à empresa selecionada."/>
    <Tabs items={tabs} activeId={activeTab} onChange={id=>setActiveTab(id as TabId)} ariaLabel="Seções da engenharia"/>
    <EngineeringOperationsPanel activeTab={activeTab} scope={scope} onChanged={refresh}/>
    {activeTab==='aditivos'&&<EngineeringAddendumMaintenance addenda={data.addenda} onChanged={refresh}/>} 
    {activeTab==='provisorios'&&<EngineeringProvisionalMaintenance scope={scope} onChanged={refresh}/>} 
    <div className="engineering-workspace" role="tabpanel" tabIndex={0}><div className="engineering-workspace__canvas">
      {activeTab==='contratos'&&<><div className="engineering-kpis engineering-kpis--contracts"><Card title="Valor contratado"><strong>{currency.format(contractUpdatedTotal)}</strong></Card><Card title="Valor medido"><strong>{currency.format(contractMeasuredTotal)}</strong><span>{contractMeasuredPercent.toFixed(2)}% do contratado</span></Card><Card className="engineering-kpi--primary" title="Saldo contratual"><strong>{currency.format(contractBalanceTotal)}</strong></Card><Card title="Contratos"><strong>{data.contracts.length}</strong><span>registros nesta empresa</span></Card></div><Card className="engineering-primary-card" title="Contratos" description="Valor atualizado, medido e saldo">{data.contracts.length===0?empty:<div className="engineering-data-list engineering-data-list--contracts">{data.contracts.map(item=><div className="engineering-data-row" key={item.contractId}><div><strong>{item.contractNumber}</strong><span>{item.status}</span></div><div><span>{currency.format(item.updatedContractValue)}</span><span>Medido {currency.format(item.measuredNet)} · {item.measuredPercent.toFixed(2)}%</span><span>Saldo {currency.format(item.grossBalance)}</span></div></div>)}</div>}</Card></>}
      {activeTab==='medicoes'&&<><div className="engineering-kpis engineering-kpis--measurements"><Card title="Bruto medido"><strong>{currency.format(measurementGrossTotal)}</strong></Card><Card title="Retenções"><strong>{currency.format(measurementRetainedTotal)}</strong></Card><Card className="engineering-kpi--primary" title="Líquido"><strong>{currency.format(measurementNetTotal)}</strong></Card><Card title="Medições"><strong>{data.measurements.length}</strong><span>registros nesta empresa</span></Card></div><Card className="engineering-primary-card" title="Medições" description="Competência, retenções e valor líquido">{data.measurements.length===0?empty:<div className="engineering-data-list engineering-data-list--measurements">{data.measurements.map(item=><div className="engineering-data-row" key={item.measurementId}><div><strong>{item.competence}</strong><span>{item.status}</span></div><div><span>Bruto {currency.format(item.grossAmount)}</span><span>Retido {currency.format(item.retainedAmount)}</span><span>Líquido {currency.format(item.netAmount)}</span></div></div>)}</div>}</Card></>}
      {activeTab==='producao'&&<><div className="engineering-kpis engineering-kpis--production"><Card className="engineering-kpi--primary" title="Produção acumulada"><strong>{currency.format(productionValueTotal)}</strong></Card><Card title="Quantidade executada"><strong>{productionQuantityTotal.toLocaleString('pt-BR')}</strong></Card><Card title="Competências"><strong>{productionCompetences}</strong><span>períodos com produção</span></Card><Card title="Lançamentos"><strong>{data.production.length}</strong><span>registros nesta empresa</span></Card></div><Card className="engineering-primary-card" title="Produção" description="Produção registrada por vínculo e competência">{data.production.length===0?empty:<div className="engineering-data-list engineering-data-list--production">{data.production.map((item,index)=><div className="engineering-data-row" key={`${item.employmentContractId}-${item.competence}-${index}`}><div><strong>{item.competence}</strong><span>Vínculo {item.employmentContractId.slice(0,8)}</span></div><div><span>Qtd. {item.executedQuantity}</span><span>{currency.format(item.productionValue)}</span></div></div>)}</div>}</Card></>}
      {activeTab==='aditivos'&&<><div className="engineering-kpis engineering-kpis--addenda"><Card title="Aditivos"><strong>{data.addenda.length}</strong><span>registros nesta empresa</span></Card><Card title="Com valor informado"><strong>{addendaWithStatedValue.length}</strong></Card><Card className="engineering-kpi--primary" title="Valor informado"><strong>{currency.format(addendaStatedTotal)}</strong><span>somente valores declarados</span></Card></div><Card className="engineering-primary-card" title="Aditivos" description="Aditivos vinculados aos contratos">{data.addenda.length===0?empty:<div className="engineering-data-list engineering-data-list--addenda">{data.addenda.map(item=><div className="engineering-data-row" key={item.id}><div><strong>{item.addendumNumber}</strong><span>{item.addendumType} · {item.status}</span></div><div><span>{item.statedValue===null?'Valor por linhas':currency.format(item.statedValue)}</span></div></div>)}</div>}</Card></>}
      {activeTab==='provisorios'&&<><div className="engineering-kpis engineering-kpis--provisionals"><Card className="engineering-kpi--primary" title="Provisórios"><strong>{data.provisionals.length}</strong><span>negociações registradas</span></Card><Card title="Clientes"><strong>{provisionalClients}</strong><span>clientes identificados</span></Card></div><Card className="engineering-primary-card" title="Provisórios" description="Negociações editáveis antes da conversão">{data.provisionals.length===0?empty:<div className="engineering-data-list engineering-data-list--provisionals">{data.provisionals.map(item=><div className="engineering-data-row" key={item.id}><div><strong>{item.provisionalNumber}</strong><span>{item.title??'Sem título'}</span></div><div><span>{item.status}</span><span>{item.clientName??'Cliente não informado'}</span></div></div>)}</div>}</Card></>}
    </div></div>
  </section>;
}
