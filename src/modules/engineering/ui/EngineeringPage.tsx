import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { EngineeringOverview } from '../domain/overview';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { Tabs } from '../../../shared/ui/Tabs';
import { EngineeringAddendumMaintenance } from './EngineeringAddendumMaintenance';
import { EngineeringOperationsPanel } from './EngineeringOperationsPanel';
import { EngineeringProvisionalMaintenance } from './EngineeringProvisionalMaintenance';
import { useEngineeringOverview } from './useEngineeringOverview';
import './engineering.css';

interface EngineeringPageProps { company: CompanySummary; companies?: readonly CompanySummary[]; }
type TabId='contratos'|'medicoes'|'producao'|'aditivos'|'provisorios';
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function companyLabel(company:CompanySummary){const raw=`${company.tradeName??''} ${company.legalName}`.toLocaleUpperCase('pt-BR');if(raw.includes('PESSOAL'))return'Pessoal';if(raw.includes('PR-HIST')||/(^|\s)PR(\s|$)/.test(raw))return'PR';if(raw.includes('CR-HIST')||/(^|\s)CR(\s|$)/.test(raw))return'CR';return company.tradeName??company.legalName;}

export function EngineeringPage({company,companies=[company]}:EngineeringPageProps){
  const [activeTab,setActiveTab]=useState<TabId>('contratos');
  const [refreshToken,setRefreshToken]=useState(0);
  const [contractSearch,setContractSearch]=useState('');
  const [contractStatus,setContractStatus]=useState('all');
  const [selectedCompanyId,setSelectedCompanyId]=useState(company.id);
  useEffect(()=>setSelectedCompanyId(company.id),[company.id]);
  const selectedCompany=companies.find(item=>item.id===selectedCompanyId)??company;
  const scope=useMemo(()=>({tenantId:selectedCompany.tenantId,companyId:selectedCompany.id}),[selectedCompany.id,selectedCompany.tenantId]);
  const overview=useEngineeringOverview(scope,refreshToken);
  const companyOptions=companies.map(item=>({value:item.id,label:companyLabel(item)}));
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
  const contractStatuses=Array.from(new Set(data.contracts.map(item=>item.status))).sort();
  const normalizedSearch=contractSearch.trim().toLocaleLowerCase('pt-BR');
  const filteredContracts=data.contracts.filter(item=>{
    const matchesStatus=contractStatus==='all'||item.status===contractStatus;
    const matchesSearch=normalizedSearch.length===0||`${item.contractNumber} ${item.status}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch);
    return matchesStatus&&matchesSearch;
  });
  const measurementGrossTotal=data.measurements.reduce((sum,item)=>sum+item.grossAmount,0);
  const measurementRetainedTotal=data.measurements.reduce((sum,item)=>sum+item.retainedAmount,0);
  const measurementNetTotal=data.measurements.reduce((sum,item)=>sum+item.netAmount,0);
  const productionQuantityTotal=data.production.reduce((sum,item)=>sum+item.executedQuantity,0);
  const productionValueTotal=data.production.reduce((sum,item)=>sum+item.productionValue,0);
  const productionCompetences=new Set(data.production.map(item=>item.competence)).size;
  const addendaWithStatedValue=data.addenda.filter(item=>item.statedValue!==null);
  const addendaStatedTotal=addendaWithStatedValue.reduce((sum,item)=>sum+(item.statedValue??0),0);
  const provisionalClients=new Set(data.provisionals.map(item=>item.clientName).filter((value):value is string=>Boolean(value))).size;
  return <section className={`engineering-overview engineering-overview--${activeTab}`} aria-labelledby="engineering-title">
    <Card className="engineering-module-header" title="Engenharia"><div className="engineering-module-header__filter"><Select label="Empresa" value={selectedCompany.id} options={companyOptions} onChange={event=>setSelectedCompanyId(event.target.value)}/></div></Card>
    <Tabs items={tabs} activeId={activeTab} onChange={id=>setActiveTab(id as TabId)} ariaLabel="Seções da engenharia"/>
    {activeTab==='contratos'&&<section className="engineering-contracts-reference" aria-label="Contratos">
      <div className="engineering-contracts-reference__title"><h2>Contratos</h2></div>
      <EngineeringOperationsPanel activeTab={activeTab} scope={scope} onChanged={refresh}/>
      <div className="engineering-contracts-reference__kpis">
        <Card className="engineering-contract-stat engineering-contract-stat--count" title="Contratos"><strong>{data.contracts.length}</strong><span>contratos cadastrados</span></Card>
        <Card className="engineering-contract-stat engineering-contract-stat--contracted" title="Contratado"><strong>{currency.format(contractUpdatedTotal)}</strong><span>Valor total vigente</span></Card>
        <Card className="engineering-contract-stat engineering-contract-stat--measured" title="Medido"><strong>{currency.format(contractMeasuredTotal)}</strong><span>{contractMeasuredPercent.toFixed(1)}% executado</span></Card>
        <Card className="engineering-contract-stat engineering-contract-stat--balance" title="Saldo restante"><strong>{currency.format(contractBalanceTotal)}</strong><span>A executar e medir</span></Card>
      </div>
      <div className="engineering-contract-tools">
        <Input label="Buscar contrato" value={contractSearch} onChange={event=>setContractSearch(event.target.value)} placeholder="Buscar obra, cliente ou contrato"/>
        <Select label="Status" value={contractStatus} onChange={event=>setContractStatus(event.target.value)} options={[{value:'all',label:'Todos'},...contractStatuses.map(status=>({value:status,label:status}))]}/>
      </div>
      <Button variant="secondary" className="engineering-print-balance" onClick={()=>window.print()}>Imprimir saldo</Button>
      <div className="engineering-contract-list">
        {filteredContracts.length===0?empty:filteredContracts.map(item=><Card className="engineering-contract-card" key={item.contractId}>
          <div className="engineering-contract-card__head"><div className="engineering-contract-card__icon" aria-hidden="true">▥</div><div className="engineering-contract-card__identity"><strong>{item.contractNumber}</strong><span>{item.status}</span></div><div className="engineering-contract-card__percent">{item.measuredPercent.toFixed(1)}%</div><div className="engineering-contract-card__chevron" aria-hidden="true">›</div></div>
          <progress className="engineering-contract-card__progress" max={100} value={Math.max(0,Math.min(100,item.measuredPercent))} aria-label={`${item.measuredPercent.toFixed(1)}% medido`}/>
          <div className="engineering-contract-card__values"><span>Contratado <strong>{currency.format(item.updatedContractValue)}</strong></span><span>Medido <strong>{currency.format(item.measuredNet)}</strong></span><span>Saldo <strong>{currency.format(item.grossBalance)}</strong></span></div>
        </Card>)}
      </div>
    </section>}
    {activeTab!=='contratos'&&<EngineeringOperationsPanel activeTab={activeTab} scope={scope} onChanged={refresh}/>} 
    {activeTab==='aditivos'&&<EngineeringAddendumMaintenance addenda={data.addenda} onChanged={refresh}/>} 
    {activeTab==='provisorios'&&<EngineeringProvisionalMaintenance scope={scope} onChanged={refresh}/>} 
    {activeTab!=='contratos'&&<div className="engineering-workspace" role="tabpanel" tabIndex={0}><div className="engineering-workspace__canvas">
      {activeTab==='medicoes'&&<><div className="engineering-kpis engineering-kpis--measurements"><Card title="Bruto medido"><strong>{currency.format(measurementGrossTotal)}</strong></Card><Card title="Retenções"><strong>{currency.format(measurementRetainedTotal)}</strong></Card><Card className="engineering-kpi--primary" title="Líquido"><strong>{currency.format(measurementNetTotal)}</strong></Card><Card title="Medições"><strong>{data.measurements.length}</strong><span>registros nesta empresa</span></Card></div><Card className="engineering-primary-card" title="Medições" description="Competência, retenções e valor líquido">{data.measurements.length===0?empty:<div className="engineering-data-list engineering-data-list--measurements">{data.measurements.map(item=><div className="engineering-data-row" key={item.measurementId}><div className="engineering-data-row__identity"><strong>{item.competence}</strong><span>{item.status}</span></div><div className="engineering-data-row__values"><span className="engineering-data-row__value--primary">Bruto {currency.format(item.grossAmount)}</span><span>Retido {currency.format(item.retainedAmount)}</span><span className="engineering-data-row__value--primary">Líquido {currency.format(item.netAmount)}</span></div></div>)}</div>}</Card></>}
      {activeTab==='producao'&&<><div className="engineering-kpis engineering-kpis--production"><Card className="engineering-kpi--primary" title="Produção acumulada"><strong>{currency.format(productionValueTotal)}</strong></Card><Card title="Quantidade executada"><strong>{productionQuantityTotal.toLocaleString('pt-BR')}</strong></Card><Card title="Competências"><strong>{productionCompetences}</strong><span>períodos com produção</span></Card><Card title="Lançamentos"><strong>{data.production.length}</strong><span>registros nesta empresa</span></Card></div><Card className="engineering-primary-card" title="Produção" description="Produção registrada por vínculo e competência">{data.production.length===0?empty:<div className="engineering-data-list engineering-data-list--production">{data.production.map((item,index)=><div className="engineering-data-row" key={`${item.employmentContractId}-${item.competence}-${index}`}><div className="engineering-data-row__identity"><strong>{item.competence}</strong><span>Vínculo {item.employmentContractId.slice(0,8)}</span></div><div className="engineering-data-row__values"><span className="engineering-data-row__value--primary">Qtd. {item.executedQuantity}</span><span className="engineering-data-row__value--primary">{currency.format(item.productionValue)}</span></div></div>)}</div>}</Card></>}
      {activeTab==='aditivos'&&<><div className="engineering-kpis engineering-kpis--addenda"><Card title="Aditivos"><strong>{data.addenda.length}</strong><span>registros nesta empresa</span></Card><Card title="Com valor informado"><strong>{addendaWithStatedValue.length}</strong></Card><Card className="engineering-kpi--primary" title="Valor informado"><strong>{currency.format(addendaStatedTotal)}</strong><span>somente valores declarados</span></Card></div><Card className="engineering-primary-card" title="Aditivos" description="Aditivos vinculados aos contratos">{data.addenda.length===0?empty:<div className="engineering-data-list engineering-data-list--addenda">{data.addenda.map(item=><div className="engineering-data-row" key={item.id}><div className="engineering-data-row__identity"><strong>{item.addendumNumber}</strong><span>{item.addendumType} · {item.status}</span></div><div className="engineering-data-row__values"><span className="engineering-data-row__value--primary">{item.statedValue===null?'Valor por linhas':currency.format(item.statedValue)}</span></div></div>)}</div>}</Card></>}
      {activeTab==='provisorios'&&<><div className="engineering-kpis engineering-kpis--provisionals"><Card className="engineering-kpi--primary" title="Provisórios"><strong>{data.provisionals.length}</strong><span>negociações registradas</span></Card><Card title="Clientes"><strong>{provisionalClients}</strong><span>clientes identificados</span></Card></div><Card className="engineering-primary-card" title="Provisórios" description="Negociações editáveis antes da conversão">{data.provisionals.length===0?empty:<div className="engineering-data-list engineering-data-list--provisionals">{data.provisionals.map(item=><div className="engineering-data-row" key={item.id}><div className="engineering-data-row__identity"><strong>{item.provisionalNumber}</strong><span>{item.title??'Sem título'}</span></div><div className="engineering-data-row__values"><span className="engineering-data-row__value--primary">{item.status}</span><span>{item.clientName??'Cliente não informado'}</span></div></div>)}</div>}</Card></>}
    </div></div>}
  </section>;
}
