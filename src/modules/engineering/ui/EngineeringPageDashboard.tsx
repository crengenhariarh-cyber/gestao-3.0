import { useMemo } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Card } from '../../../shared/ui/Card';
import { EngineeringPage } from './EngineeringPage';
import { useEngineeringOverview } from './useEngineeringOverview';
import './engineering-dashboard.css';

interface Props { companies: readonly CompanySummary[]; initialCompanyId?: string; }
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const monthLabels=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function EngineeringPageDashboard({companies,initialCompanyId}:Props){
  const scopes=useMemo(()=>companies.map(item=>({tenantId:item.tenantId,companyId:item.id})),[companies]);
  const overview=useEngineeringOverview(scopes,0);
  const data=overview.status==='ready'?overview.data:null;
  const contracted=data?.contracts.reduce((sum,item)=>sum+item.updatedContractValue,0)??0;
  const measured=data?.contracts.reduce((sum,item)=>sum+item.measuredNet,0)??0;
  const balance=data?.contracts.reduce((sum,item)=>sum+item.grossBalance,0)??0;
  const percent=contracted>0?Math.min(100,(measured/contracted)*100):0;
  const monthValues=monthLabels.map((_,index)=>data?.measurements.filter(item=>{const raw=String(item.competence);const match=raw.match(/(?:^|[-/])(\d{1,2})(?:[-/]|$)/);const month=match?Number(match[1]):Number(raw.slice(5,7));return month===index+1;}).reduce((sum,item)=>sum+item.netAmount,0)??0);
  const maxMonth=Math.max(1,...monthValues);
  const active=data?.contracts.filter(item=>item.status==='active').length??0;
  const negotiating=(data?.provisionals.filter(item=>item.status==='draft'||item.status==='negotiation').length??0)+(data?.contracts.filter(item=>item.status==='draft'||item.status==='negotiation').length??0);
  const completed=data?.contracts.filter(item=>item.status==='completed').length??0;
  return <>
    <EngineeringPage companies={companies} {...(initialCompanyId?{initialCompanyId}:{})}/>
    {data&&<section className="engineering-dashboard" aria-label="Dashboard da Engenharia">
      <div className="engineering-dashboard__head"><div><h2>Dashboard</h2><p>Visão geral dos contratos e medições</p></div><div className="engineering-dashboard__tabs" aria-label="Visão do dashboard"><strong>Geral</strong><span>Por empresa</span><span>Por obra</span></div></div>
      <div className="engineering-dashboard__main">
        <Card className="engineering-dashboard__progress" title="Execução geral"><div className="engineering-dashboard__donut"><strong>{percent.toFixed(1)}%</strong><span>Executado</span></div><progress className="engineering-dashboard__progress-meter" max={100} value={percent} aria-label={`${percent.toFixed(1)}% executado`}/><div className="engineering-dashboard__legend"><span><i className="is-measured"/>Medido <strong>{currency.format(measured)}</strong></span><span><i className="is-balance"/>Saldo <strong>{currency.format(balance)}</strong></span><span><i className="is-contract"/>Contratado <strong>{currency.format(contracted)}</strong></span></div></Card>
        <Card className="engineering-dashboard__evolution" title="Evolução das medições"><div className="engineering-dashboard__bars">{monthValues.map((value,index)=><div className="engineering-dashboard__bar" key={monthLabels[index]}><div><progress max={maxMonth} value={value} aria-label={`${monthLabels[index]}: ${currency.format(value)}`}/></div><span>{monthLabels[index]}</span></div>)}</div></Card>
      </div>
      <div className="engineering-dashboard__status"><Card title="Obras"><strong>{data.contracts.length}</strong><span>{active} em execução</span></Card><Card title="Em execução"><strong>{active}</strong><span>Contratos ativos</span></Card><Card title="Em negociação"><strong>{negotiating}</strong><span>Provisórios e contratos</span></Card><Card title="Concluídas"><strong>{completed}</strong><span>Contratos concluídos</span></Card></div>
    </section>}
  </>;
}
