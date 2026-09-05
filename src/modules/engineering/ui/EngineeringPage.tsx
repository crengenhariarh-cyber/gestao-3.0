import { useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { EngineeringContractSummary, EngineeringOverview } from '../domain/overview';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { EngineeringContractWorkspace, type EngineeringContractSection } from './EngineeringContractWorkspace';
import { NewEngineeringContractDialog } from './NewEngineeringContractDialog';
import { useEngineeringOverview } from './useEngineeringOverview';
import './engineering.css';
import './engineering-contract-workspace.css';

interface EngineeringPageProps { companies: readonly CompanySummary[]; initialCompanyId?: string; }

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function companyLabel(company:CompanySummary){const raw=`${company.tradeName??''} ${company.legalName}`.toLocaleUpperCase('pt-BR');if(raw.includes('PESSOAL'))return'Pessoal';if(raw.includes('PR-HIST')||/(^|\s)PR(\s|$)/.test(raw))return'PR';if(raw.includes('CR-HIST')||/(^|\s)CR(\s|$)/.test(raw))return'CR';return company.tradeName??company.legalName;}
function statusLabel(status:string){const labels:Record<string,string>={active:'Ativo',draft:'Rascunho',suspended:'Suspenso',completed:'Concluído',cancelled:'Cancelado'};return labels[status]??status;}

export function EngineeringPage({companies,initialCompanyId}:EngineeringPageProps){
  const [refreshToken,setRefreshToken]=useState(0);
  const [contractSearch,setContractSearch]=useState('');
  const [contractStatus,setContractStatus]=useState('all');
  const [selectedContract,setSelectedContract]=useState<EngineeringContractSummary|null>(null);
  const [contractSection,setContractSection]=useState<EngineeringContractSection>('resumo');
  const [createOpen,setCreateOpen]=useState(false);
  const selectedCompany=initialCompanyId?companies.find(item=>item.id===initialCompanyId)??null:null;
  const engineeringCompanies=companies.filter(item=>companyLabel(item)!=='Pessoal');
  const scopes=useMemo(()=>{
    const sourceCompanies=selectedCompany?[selectedCompany]:companies;
    return sourceCompanies.map(item=>({tenantId:item.tenantId,companyId:item.id}));
  },[selectedCompany,companies]);
  const overview=useEngineeringOverview(scopes,refreshToken);
  if(overview.status==='idle'||overview.status==='loading')return <LoadingState label="Carregando Engenharia…"/>;
  if(overview.status==='error')return <EmptyState title="Engenharia indisponível" message={overview.errorMessage}/>;
  if(overview.status!=='ready')return <EmptyState title="Engenharia indisponível" message="Não foi possível carregar os dados da Engenharia."/>;

  const data:EngineeringOverview=overview.data;
  const refresh=()=>setRefreshToken(value=>value+1);
  const empty=<p className="ui-muted">Nenhum contrato no filtro selecionado.</p>;
  const contractUpdatedTotal=data.contracts.reduce((sum,item)=>sum+item.updatedContractValue,0);
  const contractMeasuredTotal=data.contracts.reduce((sum,item)=>sum+item.measuredNet,0);
  const contractBalanceTotal=data.contracts.reduce((sum,item)=>sum+item.grossBalance,0);
  const contractMeasuredPercent=contractUpdatedTotal>0?(contractMeasuredTotal/contractUpdatedTotal)*100:0;
  const contractStatuses=Array.from(new Set(data.contracts.map(item=>item.status))).sort();
  const normalizedSearch=contractSearch.trim().toLocaleLowerCase('pt-BR');
  const filteredContracts=data.contracts.filter(item=>{
    const matchesStatus=contractStatus==='all'||item.status===contractStatus;
    const company=companies.find(c=>c.id===item.companyId);
    const haystack=`${item.workName} ${item.clientName??''} ${item.contractNumber} ${statusLabel(item.status)} ${company?companyLabel(company):''}`.toLocaleLowerCase('pt-BR');
    return matchesStatus&&(normalizedSearch.length===0||haystack.includes(normalizedSearch));
  });
  const maintenanceCompany=selectedContract?companies.find(item=>item.id===selectedContract.companyId)??null:null;
  const maintenanceScope=maintenanceCompany?{tenantId:maintenanceCompany.tenantId,companyId:maintenanceCompany.id}:null;
  const openContract=(contract:EngineeringContractSummary)=>{setContractSection('resumo');setSelectedContract(contract);};
  const closeContract=()=>{setSelectedContract(null);setContractSection('resumo');};
  const contractSections:{id:EngineeringContractSection;label:string;icon:string}[]=[
    {id:'resumo',label:'Resumo',icon:'⌂'},
    {id:'contrato',label:'Contrato',icon:'▣'},
    {id:'planilhas',label:'Planilhas',icon:'▤'},
    {id:'provisorios',label:'Provisórios',icon:'◫'},
    {id:'medicao',label:'Medição',icon:'▥'},
    {id:'fechamentos',label:'Fechamentos',icon:'✓'},
    {id:'impostos',label:'Impostos',icon:'%'},
    {id:'saldos',label:'Saldos',icon:'Σ'},
  ];

  return <section className="engineering-overview engineering-overview--contratos" aria-labelledby="engineering-title">
    <div className="engineering-contracts-reference__title engineering-contracts-reference__title--main"><div><h1 id="engineering-title">Engenharia</h1><p className="ui-muted">Contratos e resultados das obras</p></div><Button onClick={()=>setCreateOpen(true)} disabled={engineeringCompanies.length===0}>＋ Novo contrato</Button></div>
    <section className="engineering-contracts-reference" aria-label="Contratos">
      <div className="engineering-contracts-reference__kpis">
        <Card className="engineering-contract-stat engineering-contract-stat--count" title="Contratos"><strong>{data.contracts.length}</strong><span>{data.addenda.length} aditivo(s)</span></Card>
        <Card className="engineering-contract-stat engineering-contract-stat--contracted" title="Contratado"><strong>{currency.format(contractUpdatedTotal)}</strong><span>Valor total vigente</span></Card>
        <Card className="engineering-contract-stat engineering-contract-stat--measured" title="Medido"><strong>{currency.format(contractMeasuredTotal)}</strong><span>{contractMeasuredPercent.toFixed(1)}% executado</span></Card>
        <Card className="engineering-contract-stat engineering-contract-stat--balance" title="Saldo restante"><strong>{currency.format(contractBalanceTotal)}</strong><span>A executar e medir</span></Card>
      </div>
      <div className="engineering-contract-tools">
        <Input label="Buscar contrato" value={contractSearch} onChange={event=>setContractSearch(event.target.value)} placeholder="Buscar obra, cliente ou contrato"/>
        <Select label="Status" value={contractStatus} onChange={event=>setContractStatus(event.target.value)} options={[{value:'all',label:'Todos'},...contractStatuses.map(status=>({value:status,label:statusLabel(status)}))]}/>
      </div>
      <Button className="engineering-print-balance" onClick={()=>window.print()}>Imprimir saldo</Button>
      <div className="engineering-contract-list">
        {filteredContracts.length===0?empty:filteredContracts.map(item=>{
          const company=companies.find(c=>c.id===item.companyId);
          return <Card className="engineering-contract-card" key={item.contractId}>
            <Button variant="tertiary" className="engineering-contract-card__open" onClick={()=>openContract(item)}>
              <div className="engineering-contract-card__head"><div className="engineering-contract-card__icon" aria-hidden="true">▥</div><div className="engineering-contract-card__identity"><strong>{item.workName}</strong><span>{item.clientName??item.contractNumber} · {item.contractNumber}{company?` · ${companyLabel(company)}`:''}</span></div><div className="engineering-contract-card__percent">{item.measuredPercent.toFixed(1)}%</div><div className="engineering-contract-card__chevron" aria-hidden="true">›</div></div>
              <progress className="engineering-contract-card__progress" max={100} value={Math.max(0,Math.min(100,item.measuredPercent))} aria-label={`${item.measuredPercent.toFixed(1)}% medido`}/>
              <div className="engineering-contract-card__values"><span>Contratado <strong>{currency.format(item.updatedContractValue)}</strong></span><span>Medido <strong>{currency.format(item.measuredNet)}</strong></span><span>Saldo <strong>{currency.format(item.grossBalance)}</strong></span></div>
            </Button>
          </Card>;
        })}
      </div>
    </section>
    <NewEngineeringContractDialog open={createOpen} companies={companies} {...(selectedCompany ? { initialCompanyId: selectedCompany.id } : {})} onClose={()=>setCreateOpen(false)} onSaved={refresh}/>
    <Dialog open={selectedContract!==null} title={selectedContract?.workName??'Contrato'} description={selectedContract?`${selectedContract.clientName??'Cliente'} · ${selectedContract.contractNumber} · ${statusLabel(selectedContract.status)}`:undefined} onClose={closeContract} onBack={closeContract}>
      {selectedContract&&maintenanceScope&&<div className="engineering-contract-workspace">
        <div className="engineering-contract-workspace__summary"><span>Contratado <strong>{currency.format(selectedContract.updatedContractValue)}</strong></span><span>Medido <strong>{currency.format(selectedContract.measuredNet)}</strong></span><span>Saldo <strong>{currency.format(selectedContract.grossBalance)}</strong></span></div>
        <nav className="engineering-contract-workspace__nav" aria-label="Áreas do contrato">{contractSections.map(section=><Button key={section.id} size="sm" variant={contractSection===section.id?'primary':'secondary'} onClick={()=>setContractSection(section.id)}><span className="engineering-contract-workspace__nav-icon" aria-hidden="true">{section.icon}</span>{section.label}</Button>)}</nav>
        <EngineeringContractWorkspace section={contractSection} scope={maintenanceScope} contract={selectedContract} onChanged={refresh} onNavigate={setContractSection}/>
      </div>}
    </Dialog>
  </section>;
}