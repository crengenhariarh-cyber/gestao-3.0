import { useMemo, useState } from 'react';
import type { EngineeringContractSummary } from '../domain/overview';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { EngineeringOperationsPanel } from './EngineeringOperationsPanel';
import { useEngineeringOperations } from './useEngineeringOperations';

export type EngineeringContractSection='resumo'|'contrato'|'planilhas'|'provisorios'|'medicao'|'fechamentos'|'impostos'|'saldos';
type FormKind='contractStatus'|'structure'|'contractService'|'allocation'|'provisional'|'provisionalLine'|'convert'|'addendum'|'addendumLine'|'measurement'|'measurementLine'|'retention'|'measurementStatus'|'receivable'|'receive';

interface Props {
  section: EngineeringContractSection;
  scope:{tenantId:string;companyId:string};
  contract:EngineeringContractSummary;
  onChanged:()=>void;
  onNavigate:(section:EngineeringContractSection)=>void;
}

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const statusLabels:Record<string,string>={draft:'Rascunho',active:'Ativo',suspended:'Suspenso',completed:'Concluído',cancelled:'Cancelado',negotiation:'Negociação',approved:'Aprovado',closed:'Fechado',converted:'Convertido',open:'Aberto'};
const sectionMeta:Record<Exclude<EngineeringContractSection,'resumo'>,{eyebrow:string;title:string;description:string}>={
  contrato:{eyebrow:'DADOS E ESTRUTURA',title:'Contrato',description:'Dados, estruturas, torres, blocos, pavimentos e aditivos vinculados ao contrato.'},
  planilhas:{eyebrow:'BASE CONTRATUAL',title:'Planilhas e serviços',description:'Serviços, unidades, valores e distribuição por estrutura em uma única base operacional.'},
  provisorios:{eyebrow:'NEGOCIAÇÃO',title:'Provisórios',description:'Propostas em negociação, itens, valores e conversão para contrato ou aditivo.'},
  medicao:{eyebrow:'EXECUÇÃO',title:'Medições',description:'Competências, serviços medidos e evolução da execução contratual.'},
  fechamentos:{eyebrow:'HISTÓRICO FINANCEIRO',title:'Fechamentos e contas a receber',description:'Fechamento, aprovação, geração de contas e registro de recebimentos.'},
  impostos:{eyebrow:'CONTROLE FISCAL',title:'INSS, ISS e retenção técnica',description:'Retenções e revisão fiscal vinculadas às medições do contrato.'},
  saldos:{eyebrow:'DISPONIBILIDADE CONTRATUAL',title:'Saldos',description:'Contratado, medido e saldo disponível, com visão operacional do contrato.'},
};

function labelStatus(status:string){return statusLabels[status]??status;}
function monthLabel(value:string){if(!value)return'—';const [y,m]=value.slice(0,7).split('-');return m&&y?`${m}/${y}`:value;}

export function EngineeringContractWorkspace({section,scope,contract,onChanged,onNavigate}:Props){
  const operations=useEngineeringOperations(scope);
  const [formKind,setFormKind]=useState<FormKind|null>(null);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const data=operations.state.data;
  const normalized=search.trim().toLocaleLowerCase('pt-BR');
  const activeContract=data?.contracts.find(item=>item.id===contract.contractId);
  const workId=activeContract?.workId??'';
  const structures=(data?.structures??[]).filter(item=>item.workId===workId);
  const contractServices=(data?.contractServices??[]).filter(item=>item.contractId===contract.contractId);
  const measurements=(data?.measurements??[]).filter(item=>item.contractId===contract.contractId);
  const addenda=(data?.addenda??[]).filter(item=>item.contractId===contract.contractId);
  const provisionals=(data?.provisionals??[]).filter(item=>item.workId===workId);
  const provisionalRows=useMemo(()=>provisionals.map(item=>{
    const lines=(data?.provisionalLines??[]).filter(line=>line.provisionalId===item.id);
    return {...item,itemCount:lines.length,total:lines.reduce((sum,line)=>sum+(line.quantity*line.unitPrice),0)};
  }),[provisionals,data?.provisionalLines]);
  const progress=Math.max(0,Math.min(100,contract.measuredPercent));
  const servicePriceTotal=contractServices.reduce((sum,item)=>sum+item.unitPrice,0);

  function open(kind:FormKind){setFormKind(kind);}
  function changed(){onChanged();void operations.reload().catch(()=>undefined);}
  function match(...values:(string|null|undefined)[]){return normalized.length===0||values.some(value=>(value??'').toLocaleLowerCase('pt-BR').includes(normalized));}
  const emptyRow=(message:string)=><div className="engineering-sheet__empty"><strong>Nenhum registro</strong><span>{message}</span></div>;
  const toolbar=(primaryLabel:string,primary:FormKind,secondary?:{label:string;kind:FormKind})=><div className="engineering-sheet__toolbar">
    <div className="engineering-sheet__search"><span aria-hidden="true">⌕</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar nesta planilha…" aria-label="Buscar nesta planilha"/></div>
    <select value={filter} onChange={event=>setFilter(event.target.value)} aria-label="Filtrar planilha"><option value="all">Todos</option><option value="active">Ativos</option><option value="draft">Rascunhos</option><option value="approved">Aprovados</option><option value="closed">Fechados</option></select>
    {secondary&&<Button variant="secondary" size="sm" onClick={()=>open(secondary.kind)}>{secondary.label}</Button>}
    <Button size="sm" onClick={()=>open(primary)}>＋ {primaryLabel}</Button>
  </div>;
  const sheetHead=(count:number,totalLabel?:string,totalValue?:string)=><div className="engineering-sheet__stats">
    <div><span>Registros</span><strong>{count}</strong></div>
    <div><span>Contrato</span><strong>{currency.format(contract.updatedContractValue)}</strong></div>
    <div><span>Medido</span><strong className="engineering-positive">{currency.format(contract.measuredNet)}</strong></div>
    <div><span>{totalLabel??'Saldo'}</span><strong>{totalValue??currency.format(contract.grossBalance)}</strong></div>
  </div>;

  if(operations.state.busy&&!data)return <LoadingState label="Carregando dados do contrato…"/>;
  if(!data)return <EmptyState title="Dados indisponíveis" message={operations.state.errorMessage??'Não foi possível carregar a base operacional.'}/>;

  let content;
  if(section==='resumo') content=<div className="engineering-contract-workspace__page engineering-contract-dashboard">
    <div className="engineering-contract-workspace__kpis engineering-contract-workspace__kpis--hero">
      <Card title="Contrato atualizado"><strong>{currency.format(contract.updatedContractValue)}</strong><span>Valor vigente do contrato</span></Card>
      <Card title="Total medido"><strong className="engineering-positive">{currency.format(contract.measuredNet)}</strong><span>{contract.measuredPercent.toFixed(1)}% executado</span></Card>
      <Card title="Saldo a executar"><strong className="engineering-danger">{currency.format(contract.grossBalance)}</strong><span>{(100-progress).toFixed(1)}% restante</span></Card>
    </div>
    <Card className="engineering-contract-workspace__progress-card" title="Progresso físico e financeiro"><progress max={100} value={progress}/><div><strong>{progress.toFixed(1)}%</strong><span className="ui-muted"> do contrato medido</span></div></Card>
    <div className="engineering-module-grid">
      {([{id:'contrato',icon:'▣',title:'Contrato',text:`${structures.length} estrutura(s) · ${addenda.length} aditivo(s)`},{id:'planilhas',icon:'▤',title:'Planilhas e serviços',text:`${contractServices.length} serviço(s) cadastrado(s)`},{id:'provisorios',icon:'◫',title:'Provisórios',text:`${provisionals.length} negociação(ões)`},{id:'medicao',icon:'▥',title:'Medições',text:`${measurements.length} competência(s)`},{id:'fechamentos',icon:'✓',title:'Fechamentos',text:'Aprovação e contas a receber'},{id:'impostos',icon:'%',title:'Impostos',text:'INSS, ISS e retenção técnica'},{id:'saldos',icon:'Σ',title:'Saldos',text:currency.format(contract.grossBalance)}] as const).map(item=><button key={item.id} className="engineering-module-card" onClick={()=>onNavigate(item.id)}><span className="engineering-module-card__icon">{item.icon}</span><span><strong>{item.title}</strong><small>{item.text}</small></span><b>›</b></button>)}
    </div>
  </div>;
  else {
    const meta=sectionMeta[section];
    let body;
    if(section==='contrato'){
      const rows=structures.filter(item=>match(item.name));
      body=<>{toolbar('Nova estrutura','structure',{label:'Novo aditivo',kind:'addendum'})}{sheetHead(structures.length,'Aditivos',String(addenda.length))}<div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table"><thead><tr><th>Estrutura</th><th>Obra</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td><strong>{item.name}</strong></td><td>{contract.workName}</td><td><span className="engineering-status engineering-status--active">Ativa</span></td><td><Button size="sm" variant="tertiary" onClick={()=>open('structure')}>Editar</Button></td></tr>)}</tbody></table>{rows.length===0&&emptyRow('Cadastre torres, blocos, pavimentos ou unidades.')}</div><div className="engineering-sheet__subsection"><div className="engineering-sheet__subhead"><div><strong>Aditivos do contrato</strong><span>Alterações contratuais preservando o histórico.</span></div><Button size="sm" variant="secondary" onClick={()=>open('addendumLine')}>＋ Item de aditivo</Button></div><div className="engineering-sheet__chips">{addenda.length?addenda.map(item=><span key={item.id}><b>{item.number}</b>{labelStatus(item.status)}</span>):<em>Nenhum aditivo cadastrado.</em>}</div></div></>;
    } else if(section==='planilhas'){
      const rows=contractServices.filter(item=>match(item.description,item.unit));
      body=<>{toolbar('Adicionar serviço','contractService',{label:'Distribuir',kind:'allocation'})}{sheetHead(contractServices.length,'Soma preços unit.',currency.format(servicePriceTotal))}<div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table engineering-sheet__table--services"><thead><tr><th>#</th><th>Serviço</th><th>Unidade</th><th>Valor unit.</th><th>Estrutura</th><th>Ações</th></tr></thead><tbody>{rows.map((item,index)=><tr key={item.id}><td>{String(index+1).padStart(3,'0')}</td><td><strong>{item.description}</strong></td><td>{item.unit}</td><td>{currency.format(item.unitPrice)}</td><td><span className="engineering-status">Distribuição</span></td><td><Button size="sm" variant="tertiary" onClick={()=>open('allocation')}>Distribuir</Button></td></tr>)}</tbody></table>{rows.length===0&&emptyRow('Adicione os serviços da planilha contratual.')}</div><div className="engineering-sheet__footer"><div><span>Serviços cadastrados</span><strong>{contractServices.length}</strong></div><div className="engineering-sheet__progress"><span>Progresso medido: <b>{progress.toFixed(1)}%</b></span><progress max={100} value={progress}/></div></div></>;
    } else if(section==='provisorios'){
      const rows=provisionalRows.filter(item=>(filter==='all'||item.status===filter)&&match(item.number,item.title,item.clientName,item.status));
      body=<>{toolbar('Novo provisório','provisional',{label:'Adicionar item',kind:'provisionalLine'})}{sheetHead(provisionals.length,'Valor em negociação',currency.format(provisionalRows.reduce((sum,item)=>sum+item.total,0)))}<div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table"><thead><tr><th>Número</th><th>Descrição</th><th>Cliente</th><th>Itens</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td><strong>{item.number}</strong></td><td>{item.title??'Provisório'}</td><td>{item.clientName??'—'}</td><td>{item.itemCount}</td><td>{currency.format(item.total)}</td><td><span className={`engineering-status engineering-status--${item.status}`}>{labelStatus(item.status)}</span></td><td><Button size="sm" variant="tertiary" onClick={()=>open('convert')}>Converter</Button></td></tr>)}</tbody></table>{rows.length===0&&emptyRow('Crie um provisório para iniciar uma negociação.')}</div></>;
    } else if(section==='medicao'){
      const rows=measurements.filter(item=>(filter==='all'||item.status===filter)&&match(item.competence,item.status));
      body=<>{toolbar('Nova medição','measurement',{label:'Adicionar serviço medido',kind:'measurementLine'})}{sheetHead(measurements.length)}<div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table"><thead><tr><th>Competência</th><th>Status</th><th>Contrato</th><th>Evolução geral</th><th>Ações</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td><strong>{monthLabel(item.competence)}</strong></td><td><span className={`engineering-status engineering-status--${item.status}`}>{labelStatus(item.status)}</span></td><td>{contract.contractNumber}</td><td>{progress.toFixed(1)}%</td><td><Button size="sm" variant="tertiary" onClick={()=>open('measurementLine')}>Itens</Button></td></tr>)}</tbody></table>{rows.length===0&&emptyRow('Crie a primeira medição do contrato.')}</div></>;
    } else if(section==='fechamentos'){
      const rows=measurements.filter(item=>(filter==='all'||item.status===filter)&&match(item.competence,item.status));
      body=<>{toolbar('Fechar / aprovar','measurementStatus',{label:'Gerar conta a receber',kind:'receivable'})}{sheetHead(measurements.length,'Recebido','Consultar financeiro')}<div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table"><thead><tr><th>Competência</th><th>Status</th><th>Etapa financeira</th><th>Conta a receber</th><th>Ações</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td><strong>{monthLabel(item.competence)}</strong></td><td><span className={`engineering-status engineering-status--${item.status}`}>{labelStatus(item.status)}</span></td><td>{item.status==='approved'?'Liberada para financeiro':'Aguardando aprovação'}</td><td>{item.status==='approved'?'Disponível':'—'}</td><td><Button size="sm" variant="tertiary" onClick={()=>open('receive')}>Receber</Button></td></tr>)}</tbody></table>{rows.length===0&&emptyRow('As medições aparecerão aqui para fechamento e recebimento.')}</div></>;
    } else if(section==='impostos'){
      const rows=measurements.filter(item=>match(item.competence,item.status));
      body=<>{toolbar('Lançar retenção','retention',{label:'Revisar medição',kind:'measurementStatus'})}{sheetHead(measurements.length,'Retenções','Por medição')}<div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table"><thead><tr><th>Competência</th><th>Status</th><th>INSS</th><th>ISS</th><th>Retenção técnica</th><th>Ações</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td><strong>{monthLabel(item.competence)}</strong></td><td><span className={`engineering-status engineering-status--${item.status}`}>{labelStatus(item.status)}</span></td><td>Vinculada à medição</td><td>Vinculada à medição</td><td>Vinculada à medição</td><td><Button size="sm" variant="tertiary" onClick={()=>open('retention')}>Revisar</Button></td></tr>)}</tbody></table>{rows.length===0&&emptyRow('As retenções serão organizadas por competência de medição.')}</div></>;
    } else {
      const remaining=Math.max(0,100-progress);
      body=<>{sheetHead(contractServices.length)}<div className="engineering-balance-grid"><Card title="Contratado"><strong>{currency.format(contract.updatedContractValue)}</strong><span>100,0% do contrato vigente</span></Card><Card title="Medido"><strong className="engineering-positive">{currency.format(contract.measuredNet)}</strong><span>{progress.toFixed(1)}% executado</span></Card><Card title="Saldo"><strong className="engineering-danger">{currency.format(contract.grossBalance)}</strong><span>{remaining.toFixed(1)}% disponível</span></Card></div><div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table"><thead><tr><th>Composição</th><th>Quantidade de registros</th><th>Participação</th><th>Referência</th></tr></thead><tbody><tr><td><strong>Serviços contratuais</strong></td><td>{contractServices.length}</td><td>Base vigente</td><td>{currency.format(contract.updatedContractValue)}</td></tr><tr><td><strong>Medições</strong></td><td>{measurements.length}</td><td>{progress.toFixed(1)}%</td><td>{currency.format(contract.measuredNet)}</td></tr><tr><td><strong>Aditivos</strong></td><td>{addenda.length}</td><td>Histórico contratual</td><td>Incluído no valor vigente</td></tr></tbody></table></div><div className="engineering-sheet__footer"><div><span>Saldo disponível</span><strong>{currency.format(contract.grossBalance)}</strong></div><div className="engineering-sheet__progress"><span>Disponível: <b>{remaining.toFixed(1)}%</b></span><progress max={100} value={remaining}/></div></div></>;
    }
    content=<div className="engineering-contract-workspace__page"><div className="engineering-contract-workspace__section-head engineering-contract-workspace__section-head--sheet"><div><small>{meta.eyebrow}</small><h3>{meta.title}</h3><p className="ui-muted">{meta.description}</p></div></div><section className="engineering-sheet">{body}</section></div>;
  }

  return <>{content}{formKind&&<EngineeringOperationsPanel key={formKind} activeTab={formKind==='provisional'||formKind==='provisionalLine'||formKind==='convert'?'provisorios':formKind==='addendum'||formKind==='addendumLine'?'aditivos':'medicoes'} scope={scope} onChanged={changed} focusedContractId={contract.contractId} initialKind={formKind} hideActions onDialogClosed={()=>setFormKind(null)}/>}</>;
}
