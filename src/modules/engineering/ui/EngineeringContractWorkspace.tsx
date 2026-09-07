import { useMemo, useState } from 'react';
import type { EngineeringContractSummary } from '../domain/overview';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { EngineeringOperationsPanel } from './EngineeringOperationsPanel';
import { GuidedMeasurementFlow } from './GuidedMeasurementFlow';
import { useEngineeringOperations } from './useEngineeringOperations';

export type EngineeringContractSection='resumo'|'contrato'|'planilhas'|'provisorios'|'medicao'|'fechamentos'|'impostos'|'saldos';
type FormKind='contractStatus'|'structure'|'contractService'|'allocation'|'provisional'|'provisionalLine'|'convert'|'addendum'|'addendumLine'|'measurement'|'measurementLine'|'retention'|'measurementStatus'|'receivable'|'receive';
type SheetGroup={type:'structure'|'addendum';id:string}|null;

interface Props {
  section: EngineeringContractSection;
  scope:{tenantId:string;companyId:string};
  contract:EngineeringContractSummary;
  onChanged:()=>void;
  onNavigate:(section:EngineeringContractSection)=>void;
}

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const quantity=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3});
const statusLabels:Record<string,string>={draft:'Rascunho',active:'Ativo',suspended:'Suspenso',completed:'Concluído',cancelled:'Cancelado',negotiation:'Negociação',approved:'Aprovado',closed:'Fechado',converted:'Convertido',open:'Aberto'};
const sectionMeta:Record<Exclude<EngineeringContractSection,'resumo'>,{eyebrow:string;title:string;description:string}>={
  contrato:{eyebrow:'DADOS E ESTRUTURA',title:'Contrato',description:'Dados, estruturas, torres, blocos, pavimentos e aditivos vinculados ao contrato.'},
  planilhas:{eyebrow:'BASE CONTRATUAL',title:'Planilhas e serviços',description:'Planilhas separadas por torre, estrutura e aditivo, com acesso direto aos quantitativos.'},
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
  const [guidedMeasurementOpen,setGuidedMeasurementOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [sheetGroup,setSheetGroup]=useState<SheetGroup>(null);
  const data=operations.state.data;
  const normalized=search.trim().toLocaleLowerCase('pt-BR');
  const activeContract=data?.contracts.find(item=>item.id===contract.contractId);
  const workId=activeContract?.workId??'';
  const structures=(data?.structures??[]).filter(item=>item.workId===workId);
  const contractServices=(data?.contractServices??[]).filter(item=>item.contractId===contract.contractId);
  const contractServiceIds=new Set(contractServices.map(item=>item.id));
  const allocations=(data?.allocations??[]).filter(item=>contractServiceIds.has(item.contractServiceId));
  const measurements=(data?.measurements??[]).filter(item=>item.contractId===contract.contractId);
  const addenda=(data?.addenda??[]).filter(item=>item.contractId===contract.contractId);
  const provisionals=(data?.provisionals??[]).filter(item=>item.workId===workId);
  const provisionalRows=useMemo(()=>provisionals.map(item=>{
    const lines=(data?.provisionalLines??[]).filter(line=>line.provisionalId===item.id);
    return {...item,itemCount:lines.length,total:lines.reduce((sum,line)=>sum+(line.quantity*line.unitPrice),0)};
  }),[provisionals,data?.provisionalLines]);
  const progress=Math.max(0,Math.min(100,contract.measuredPercent));

  function open(kind:FormKind){if(kind==='measurementLine'){setGuidedMeasurementOpen(true);return;}setFormKind(kind);}
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
      const selectedStructure=sheetGroup?.type==='structure'?structures.find(item=>item.id===sheetGroup.id):undefined;
      const selectedAddendum=sheetGroup?.type==='addendum'?addenda.find(item=>item.id===sheetGroup.id):undefined;
      const structureAllocations=selectedStructure?allocations.filter(item=>item.structureId===selectedStructure.id):[];
      const structureRows=selectedStructure?contractServices.map((service,index)=>({service,index,allocation:structureAllocations.find(item=>item.contractServiceId===service.id)})).filter(row=>match(row.service.description,row.service.unit,selectedStructure.name)):[];
      body=<>{toolbar('Adicionar serviço','contractService',{label:'Distribuir quantitativo',kind:'allocation'})}{sheetHead(contractServices.length,'Distribuições',String(allocations.length))}
        <div className="engineering-sheet__subsection"><div className="engineering-sheet__subhead"><div><strong>Planilhas por torre / estrutura</strong><span>Abra uma torre para consultar e alterar os quantitativos distribuídos.</span></div></div>
          <div className="engineering-sheet__chips">{structures.length?structures.map(item=>{const count=allocations.filter(allocation=>allocation.structureId===item.id).length;const active=sheetGroup?.type==='structure'&&sheetGroup.id===item.id;return <button key={item.id} type="button" className={active?'engineering-status engineering-status--active':'engineering-status'} onClick={()=>setSheetGroup({type:'structure',id:item.id})}><b>{item.name}</b> · {count} item(ns)</button>}):<em>Nenhuma torre ou estrutura cadastrada.</em>}</div>
        </div>
        <div className="engineering-sheet__subsection"><div className="engineering-sheet__subhead"><div><strong>Aditivos</strong><span>Cada aditivo permanece separado da planilha-base do contrato.</span></div><Button size="sm" variant="secondary" onClick={()=>open('addendum')}>＋ Novo aditivo</Button></div>
          <div className="engineering-sheet__chips">{addenda.length?addenda.map(item=>{const active=sheetGroup?.type==='addendum'&&sheetGroup.id===item.id;return <button key={item.id} type="button" className={active?'engineering-status engineering-status--approved':'engineering-status'} onClick={()=>setSheetGroup({type:'addendum',id:item.id})}><b>Aditivo {item.number}</b> · {labelStatus(item.status)}</button>}):<em>Nenhum aditivo cadastrado.</em>}</div>
        </div>
        {!sheetGroup&&emptyRow('Selecione uma torre/estrutura ou um aditivo para abrir a planilha correspondente.')}
        {selectedStructure&&<><div className="engineering-sheet__subhead"><div><strong>{selectedStructure.name}</strong><span>Quantitativos desta estrutura. O mesmo serviço/estrutura é atualizado, não duplicado.</span></div><Button size="sm" onClick={()=>open('allocation')}>Editar quantitativo</Button></div><div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table engineering-sheet__table--services"><thead><tr><th>#</th><th>Serviço</th><th>Unidade</th><th>Valor unit.</th><th>Quantitativo</th><th>Ações</th></tr></thead><tbody>{structureRows.map(row=><tr key={row.service.id}><td>{String(row.index+1).padStart(3,'0')}</td><td><strong>{row.service.description}</strong></td><td>{row.service.unit}</td><td>{currency.format(row.service.unitPrice)}</td><td><strong>{row.allocation?quantity.format(row.allocation.allocatedQuantity):'—'}</strong></td><td><Button size="sm" variant="tertiary" onClick={()=>open('allocation')}>{row.allocation?'Editar quantitativo':'Definir quantitativo'}</Button></td></tr>)}</tbody></table>{structureRows.length===0&&emptyRow('Nenhum serviço encontrado para esta estrutura.')}</div></>}
        {selectedAddendum&&<div className="engineering-sheet__subsection"><div className="engineering-sheet__subhead"><div><strong>Aditivo {selectedAddendum.number}</strong><span>{labelStatus(selectedAddendum.status)} · planilha de alterações contratuais separada da base.</span></div><Button size="sm" onClick={()=>open('addendumLine')}>Editar quantitativo</Button></div><div className="engineering-sheet__empty"><strong>Planilha do aditivo</strong><span>Use “Editar quantitativo” para incluir ou ajustar as linhas quantitativas deste aditivo.</span></div></div>}
        <div className="engineering-sheet__footer"><div><span>Serviços cadastrados</span><strong>{contractServices.length}</strong></div><div className="engineering-sheet__progress"><span>Progresso medido: <b>{progress.toFixed(1)}%</b></span><progress max={100} value={progress}/></div></div></>;
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
      body=<>{toolbar('Lançar retenção','retention',{label:'Revisar medição',kind:'measurementStatus'})}{sheetHead(measurements.length,'Retenções','Por medição')}<div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table"><thead><tr><th>Competência</th><th>Medição</th><th>INSS</th><th>ISS</th><th>RT</th><th>Status</th><th>Ações</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td><strong>{monthLabel(item.competence)}</strong></td><td>{contract.contractNumber}</td><td>Regra contratual</td><td>Regra contratual</td><td>Regra contratual</td><td><span className={`engineering-status engineering-status--${item.status}`}>{labelStatus(item.status)}</span></td><td><Button size="sm" variant="tertiary" onClick={()=>open('retention')}>Revisar</Button></td></tr>)}</tbody></table>{rows.length===0&&emptyRow('As retenções serão organizadas por medição.')}</div></>;
    } else {
      body=<>{sheetHead(contractServices.length)}<div className="engineering-balance-hero"><div><span>Saldo contratual disponível</span><strong>{currency.format(contract.grossBalance)}</strong><small>{(100-progress).toFixed(1)}% do contrato ainda disponível</small></div><progress max={100} value={progress}/></div><div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table"><thead><tr><th>Indicador</th><th>Valor</th><th>Participação</th><th>Situação</th></tr></thead><tbody><tr><td><strong>Contrato atualizado</strong></td><td>{currency.format(contract.updatedContractValue)}</td><td>100%</td><td><span className="engineering-status engineering-status--active">Vigente</span></td></tr><tr><td><strong>Total medido</strong></td><td>{currency.format(contract.measuredNet)}</td><td>{progress.toFixed(1)}%</td><td><span className="engineering-status engineering-status--approved">Executado</span></td></tr><tr><td><strong>Saldo restante</strong></td><td>{currency.format(contract.grossBalance)}</td><td>{(100-progress).toFixed(1)}%</td><td><span className="engineering-status">Disponível</span></td></tr></tbody></table></div></>;
    }
    content=<div className="engineering-contract-workspace__page engineering-sheet"><header className="engineering-sheet__head"><div><small>{meta.eyebrow}</small><h3>{meta.title}</h3><p>{meta.description}</p></div><span className="engineering-sheet__contract-badge">{contract.contractNumber}</span></header>{body}</div>;
  }

  const formMode={
    contractStatus:{tab:'contratos',mode:'contract-data'},structure:{tab:'contratos',mode:'contract-data'},contractService:{tab:'contratos',mode:'contract-services'},allocation:{tab:'contratos',mode:'contract-services'},provisional:{tab:'provisorios',mode:'default'},provisionalLine:{tab:'provisorios',mode:'default'},convert:{tab:'provisorios',mode:'default'},addendum:{tab:'contratos',mode:'contract-data'},addendumLine:{tab:'contratos',mode:'contract-services'},measurement:{tab:'medicoes',mode:'measurement-create'},measurementLine:{tab:'medicoes',mode:'measurement-create'},retention:{tab:'medicoes',mode:'contract-taxes'},measurementStatus:{tab:'medicoes',mode:'measurement-close'},receivable:{tab:'medicoes',mode:'measurement-close'},receive:{tab:'medicoes',mode:'measurement-close'},
  } as const;
  const activeForm=formKind?formMode[formKind]:null;
  return <>{content}{activeForm&&formKind&&<div className="engineering-sheet-form"><div className="engineering-sheet-form__backdrop" onClick={()=>setFormKind(null)}/><div className="engineering-sheet-form__panel"><div className="engineering-sheet-form__head"><div><small>ENGENHARIA</small><strong>{section==='resumo'?'Contrato':sectionMeta[section].title}</strong></div><Button variant="secondary" size="sm" onClick={()=>setFormKind(null)}>Fechar</Button></div><div className="engineering-sheet-form__content"><EngineeringOperationsPanel activeTab={activeForm.tab} scope={scope} onChanged={changed} actionsMode={activeForm.mode} focusedContractId={contract.contractId} initialKind={formKind} hideActions onDialogClosed={()=>setFormKind(null)}/></div></div></div>}{guidedMeasurementOpen&&<GuidedMeasurementFlow scope={scope} contractId={contract.contractId} onChanged={changed} onClose={()=>setGuidedMeasurementOpen(false)}/>}</>;
}