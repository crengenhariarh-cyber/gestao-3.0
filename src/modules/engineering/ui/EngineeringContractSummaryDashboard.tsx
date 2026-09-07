import type { EngineeringContractSummary } from '../domain/overview';

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

interface Props{contract:EngineeringContractSummary;onNavigate:(section:'medicao'|'saldos')=>void;}

export function EngineeringContractSummaryDashboard({contract,onNavigate}:Props){
  const progress=Math.max(0,Math.min(100,contract.measuredPercent));
  const remaining=Math.max(0,100-progress);
  return <div className="engineering-summary-dashboard">
    <div className="engineering-summary-dashboard__kpis">
      <article><span className="engineering-summary-dashboard__kpi-icon" aria-hidden="true">▤</span><div><small>Contrato atualizado</small><strong>{currency.format(contract.updatedContractValue)}</strong><p>Valor vigente do contrato</p></div></article>
      <article><span className="engineering-summary-dashboard__kpi-icon engineering-summary-dashboard__kpi-icon--positive" aria-hidden="true">▥</span><div><small>Total medido</small><strong className="engineering-positive">{currency.format(contract.measuredNet)}</strong><p>{progress.toFixed(1)}% executado</p></div></article>
      <article><span className="engineering-summary-dashboard__kpi-icon engineering-summary-dashboard__kpi-icon--balance" aria-hidden="true">◔</span><div><small>Saldo a executar</small><strong className="engineering-danger">{currency.format(contract.grossBalance)}</strong><p>{remaining.toFixed(1)}% restante</p></div></article>
    </div>
    <div className="engineering-summary-dashboard__charts">
      <section className="engineering-summary-dashboard__panel"><h3>Evolução física do contrato</h3><div className="engineering-summary-dashboard__progress"><div style={{width:`${progress}%`}}/></div><div className="engineering-summary-dashboard__progress-label"><strong>{progress.toFixed(1)}%</strong><span>100%</span></div><p>Percentual do contrato medido</p></section>
      <section className="engineering-summary-dashboard__panel"><h3>Distribuição do contrato</h3><div className="engineering-summary-dashboard__distribution"><div className="engineering-summary-dashboard__donut" style={{background:`conic-gradient(var(--ui-success, #16a36a) 0 ${progress}%, var(--ui-border, #d9e0ea) ${progress}% 100%)`}}><div><strong>{currency.format(contract.updatedContractValue)}</strong><span>Total</span></div></div><div className="engineering-summary-dashboard__legend"><p><i className="is-measured"/>Medido <strong>{currency.format(contract.measuredNet)}</strong><span>{progress.toFixed(1)}%</span></p><p><i/>Saldo <strong>{currency.format(contract.grossBalance)}</strong><span>{remaining.toFixed(1)}%</span></p></div></div></section>
    </div>
    <div className="engineering-summary-dashboard__actions">
      <button type="button" onClick={()=>onNavigate('medicao')}><span aria-hidden="true">▥</span><div><strong>Gráficos</strong><small>Acompanhe a evolução física e financeira do contrato com gráficos detalhados.</small></div><b>›</b></button>
      <button type="button" onClick={()=>onNavigate('saldos')}><span aria-hidden="true">◔</span><div><strong>Dashboard</strong><small>Visão completa do contrato com indicadores e principais informações.</small></div><b>›</b></button>
    </div>
  </div>;
}
