import { useMemo, useState } from 'react';
import type { EngineeringContractSummary } from '../domain/overview';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { EngineeringOperationsPanel } from './EngineeringOperationsPanel';
import { GuidedMeasurementFlow } from './GuidedMeasurementFlow';
import { EditEngineeringContractRetentionDialog } from './EditEngineeringContractRetentionDialog';
import { EngineeringAddendumSheetDialog } from './EngineeringAddendumSheetDialog';
import { EditEngineeringStructureDialog } from './EditEngineeringStructureDialog';
import { useEngineeringOperations } from './useEngineeringOperations';

export type EngineeringContractSection='resumo'|'contrato'|'planilhas'|'provisorios'|'medicao'|'fechamentos'|'impostos'|'saldos';
type FormKind='contractStatus'|'structure'|'contractService'|'allocation'|'provisional'|'provisionalLine'|'convert'|'addendum'|'addendumLine'|'measurement'|'measurementLine'|'retention'|'measurementStatus'|'receivable'|'receive';
type SheetGroup={type:'structure'|'addendum';id:string}|null;
type AllocationEdit={contractServiceId:string;structureId:string;serviceLabel:string;structureLabel:string;unit:string;quantity:string;maxQuantity:number;notes:string;availableFloors:string[];selectedFloors:string[];unitsPerFloor:number;floorUnits:Record<string,number>}|null;

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
function numberValue(value:string){const parsed=Number(value.replace(',','.'));return Number.isFinite(parsed)?parsed:0;}
function towerConfig(metadata:Record<string,unknown>|null|undefined){const raw=metadata?.towerConfig;if(!raw||typeof raw!=='object')return null;const cfg=raw as Record<string,unknown>;const floorCount=Number(cfg.floorCount);const unitsPerFloor=Number(cfg.unitsPerFloor);const firstFloor=Number(cfg.firstFloor??1);const hasGroundFloor=Boolean(cfg.hasGroundFloor??false);const groundFloorUnits=Math.max(0,Number(cfg.groundFloorUnits)||0);const hasRoof=Boolean(cfg.hasRoof??false);const roofUnits=Math.max(0,Number(cfg.roofUnits)||0);const totalUnits=Math.max(0,Number(cfg.totalUnits)||0);return Number.isFinite(floorCount)&&floorCount>0&&Number.isFinite(unitsPerFloor)&&unitsPerFloor>0?{floorCount,unitsPerFloor,firstFloor,hasGroundFloor,groundFloorUnits,hasRoof,roofUnits,totalUnits}:null;}

export function EngineeringContractWorkspace({section,scope,contract,onChanged,onNavigate}:Props){
  const operations=useEngineeringOperations(scope);
  const [formKind,setFormKind]=useState<FormKind|null>(null);
  const [guidedMeasurementOpen,setGuidedMeasurementOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [serviceSearch,setServiceSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [sheetGroup,setSheetGroup]=useState<SheetGroup>(null);
  const [allocationEdit,setAllocationEdit]=useState<AllocationEdit>(null);
  const [allocationSaving,setAllocationSaving]=useState(false);
  const [allocationError,setAllocationError]=useState<string|null>(null);
  const [contractRetentionEditOpen,setContractRetentionEditOpen]=useState(false);
  const [contractAddendumId,setContractAddendumId]=useState<string|null>(null);
  const [structureEditId,setStructureEditId]=useState<string|null>(null);
  const data=operations.state.data;
  const normalized=search.trim().toLocaleLowerCase('pt-BR');
  const normalizedServiceSearch=serviceSearch.trim().toLocaleLowerCase('pt-BR');
  const activeContract=data?.contracts.find(item=>item.id===contract.contractId);
  const workId=activeContract?.workId??'';
  const structures=(data?.structures??[]).filter(item=>item.workId===workId);
  const contractServices=(data?.contractServices??[]).filter(item=>item.contractId===contract.contractId);
  const contractServiceIds=new Set(contractServices.map(item=>item.id));
  const allocations=(data?.allocations??[]).filter(item=>contractServiceIds.has(item.contractServiceId));
  const measurements=(data?.measurements??[]).filter(item=>item.contractId===contract.contractId);
  const addenda=(data?.addenda??[]).filter(item=>item.contractId===contract.contractId);
  const contractSelectedAddendum=contractAddendumId?addenda.find(item=>item.id===contractAddendumId):undefined;
  const selectedStructureEdit=structureEditId?structures.find(item=>item.id===structureEditId):undefined;
  const provisionals=(data?.provisionals??[]).filter(item=>item.workId===workId);
  const provisionalRows=useMemo(()=>provisionals.map(item=>{
    const lines=(data?.provisionalLines??[]).filter(line=>line.provisionalId===item.id);
    return {...item,itemCount:lines.length,total:lines.reduce((sum,line)=>sum+(line.quantity*line.unitPrice),0)};
  }),[provisionals,data?.provisionalLines]);
  const progress=Math.max(0,Math.min(100,contract.measuredPercent));

  function open(kind:FormKind){if(kind==='measurementLine'){setGuidedMeasurementOpen(true);return;}setFormKind(kind);}
  function changed(){onChanged();void operations.reload().catch(()=>undefined);}
  function match(...values:(string|null|undefined)[]){return normalized.length===0||values.some(value=>(value??'').toLocaleLowerCase('pt-BR').includes(normalized));}
  function matchService(...values:(string|null|undefined)[]){return normalizedServiceSearch.length===0||values.some(value=>(value??'').toLocaleLowerCase('pt-BR').includes(normalizedServiceSearch));}
  function selectSheetGroup(group:Exclude<SheetGroup,null>){setSheetGroup(group);setServiceSearch('');}
  async function saveAllocationEdit(){
    if(!allocationEdit||allocationSaving)return;
    const nextQuantity=numberValue(allocationEdit.quantity);
    if(nextQuantity<=0){setAllocationError('Informe um quantitativo maior que zero.');return;}
    setAllocationError(null);setAllocationSaving(true);
    try{
      const floorRank=(floor:string)=>floor==='TR'?-1000000:floor==='COB'?1000000:Number(floor);
      const floors=[...allocationEdit.selectedFloors].sort((a,b)=>floorRank(a)-floorRank(b));
      const totalTowerCapacity=allocationEdit.availableFloors.reduce((sum,floor)=>sum+(allocationEdit.floorUnits[floor]??allocationEdit.unitsPerFloor),0);
      const firstNumericFloor=floors.find(floor=>/^\d+$/.test(floor));
      await operations.allocateContractService({workId,contractServiceId:allocationEdit.contractServiceId,structureId:allocationEdit.structureId,quantity:nextQuantity,notes:allocationEdit.notes||null,scopeConfig:allocationEdit.availableFloors.length?{active:floors.length>0,startFloor:firstNumericFloor?Number(firstNumericFloor):null,floors,units:[],scopeQuantity:nextQuantity,outsideQuantity:Math.max(0,totalTowerCapacity-nextQuantity)}:null});
      setAllocationEdit(null);void operations.reload().catch(()=>undefined);
    }catch(error){setAllocationError(error instanceof Error?error.message:'Não foi possível salvar o quantitativo.');}
    finally{setAllocationSaving(false);}
  }
  function toggleAllocationFloor(floor:string){setAllocationError(null);setAllocationEdit(current=>{if(!current)return current;const selected=current.selectedFloors.includes(floor)?current.selectedFloors.filter(item=>item!==floor):[...current.selectedFloors,floor];const derived=current.unit.trim().toLocaleUpperCase('pt-BR')==='APTO'&&current.unitsPerFloor>0?selected.reduce((sum,item)=>sum+(current.floorUnits[item]??current.unitsPerFloor),0):numberValue(current.quantity);return {...current,selectedFloors:selected,quantity:String(derived)};});}
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
      body=<div className="engineering-contract-approved">
        <div className="engineering-contract-approved__tools">
          <div className="engineering-sheet__search"><span aria-hidden="true">⌕</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar nesta estrutura…" aria-label="Buscar nesta estrutura"/></div>
          <select value={filter} onChange={event=>setFilter(event.target.value)} aria-label="Filtrar contrato"><option value="all">Todos</option><option value="active">Ativos</option><option value="draft">Rascunhos</option><option value="approved">Aprovados</option><option value="closed">Fechados</option></select>
          <Button variant="secondary" size="sm" onClick={()=>open('addendum')}>＋ Novo aditivo</Button>
          <Button size="sm" onClick={()=>open('structure')}>＋ Nova estrutura</Button>
        </div>
        <div className="engineering-contract-approved__stats">
          <div><span className="engineering-contract-approved__stat-icon">▤</span><span><small>Registros</small><strong>{structures.length}</strong></span></div>
          <div><span className="engineering-contract-approved__stat-icon">▣</span><span><small>Contrato</small><strong>{currency.format(contract.updatedContractValue)}</strong></span></div>
          <div><span className="engineering-contract-approved__stat-icon engineering-contract-approved__stat-icon--success">▥</span><span><small>Medido</small><strong>{currency.format(contract.measuredNet)}</strong></span></div>
          <div><span className="engineering-contract-approved__stat-icon">◇</span><span><small>Aditivos</small><strong>{addenda.length}</strong></span></div>
        </div>
        <section className="engineering-contract-approved__section">
          <div className="engineering-contract-approved__section-head"><div><strong>Estruturas (Torres / Blocos)</strong><span>Acesse e gerencie as planilhas por torre ou estrutura.</span></div></div>
          <div className="engineering-contract-approved__structure-list">
            {rows.length?rows.map(item=><button key={item.id} type="button" className="engineering-contract-approved__structure" onClick={()=>setStructureEditId(item.id)}><span className="engineering-contract-approved__building">▦</span><span className="engineering-contract-approved__structure-name"><strong>{item.name}</strong></span><span className="engineering-contract-approved__structure-meta"><small>Obra</small><b>{contract.workName}</b></span><span className="engineering-contract-approved__structure-meta"><small>Situação</small><b className="engineering-status engineering-status--active">Ativa</b></span><span className="engineering-contract-approved__open">Abrir</span><span className="engineering-contract-approved__chevron">›</span></button>):emptyRow('Cadastre torres, blocos, pavimentos ou unidades.')}
          </div>
        </section>
        <section className="engineering-contract-approved__section engineering-contract-approved__section--addenda">
          <div className="engineering-contract-approved__section-head"><div><strong>Aditivos do contrato</strong><span>Selecione um aditivo para visualizar e gerenciar sua planilha.</span></div><Button size="sm" variant="secondary" onClick={()=>open('addendumLine')}>＋ Item de aditivo</Button></div>
          <div className="engineering-contract-approved__addenda-grid">
            {addenda.length?addenda.map(item=><button key={item.id} type="button" className="engineering-contract-approved__addendum" onClick={()=>setContractAddendumId(item.id)}><span className="engineering-contract-approved__addendum-icon">▤</span><span className="engineering-contract-approved__addendum-copy"><strong>Aditivo {item.number}</strong><small>{labelStatus(item.status)}</small></span><span className="engineering-contract-approved__addendum-open">Abrir</span><span className="engineering-contract-approved__chevron">›</span></button>):<em className="ui-muted">Nenhum aditivo cadastrado.</em>}
          </div>
        </section>
        <div className="engineering-contract-approved__bottom-actions">
          <button type="button" onClick={()=>onNavigate('medicao')}><span className="engineering-contract-approved__bottom-icon">▥</span><span><strong>Gráficos</strong><small>Acompanhe a evolução física e financeira do contrato com gráficos detalhados.</small></span><b>›</b></button>
          <button type="button" onClick={()=>onNavigate('resumo')}><span className="engineering-contract-approved__bottom-icon engineering-contract-approved__bottom-icon--dashboard">◔</span><span><strong>Dashboard</strong><small>Visão completa do contrato com indicadores e principais informações.</small></span><b>›</b></button>
        </div>
      </div>;
    } else if(section==='planilhas'){
      const selectedStructure=sheetGroup?.type==='structure'?structures.find(item=>item.id===sheetGroup.id):undefined;
      const selectedAddendum=sheetGroup?.type==='addendum'?addenda.find(item=>item.id===sheetGroup.id):undefined;
      const structureAllocations=selectedStructure?allocations.filter(item=>item.structureId===selectedStructure.id):[];
      const structureRows=selectedStructure?structureAllocations.flatMap((allocation,index)=>{const service=contractServices.find(item=>item.id===allocation.contractServiceId);return service?[{service,index,allocation}]:[]}).filter(row=>match(row.service.description,row.service.unit,selectedStructure.name)&&matchService(row.service.description,row.service.unit,String(row.index+1),String(row.allocation.allocatedQuantity))):[];
      const sheetStructures=structures.filter(item=>match(item.name));
      const sheetAddenda=addenda.filter(item=>match(item.number,labelStatus(item.status)));
      body=<div className="engineering-contract-approved engineering-sheets-approved">
        <div className="engineering-contract-approved__tools">
          <div className="engineering-sheet__search"><span aria-hidden="true">⌕</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar torre, estrutura ou aditivo…" aria-label="Buscar planilha"/></div>
          <select value={filter} onChange={event=>setFilter(event.target.value)} aria-label="Filtrar planilhas"><option value="all">Todos</option><option value="active">Ativos</option><option value="draft">Rascunhos</option><option value="approved">Aprovados</option><option value="closed">Fechados</option></select>
          <Button variant="secondary" size="sm" onClick={()=>open('allocation')}>Distribuir serviço</Button>
          <Button size="sm" onClick={()=>open('contractService')}>＋ Adicionar serviço</Button>
        </div>
        <div className="engineering-contract-approved__stats">
          <div><span className="engineering-contract-approved__stat-icon">▤</span><span><small>Serviços</small><strong>{contractServices.length}</strong></span></div>
          <div><span className="engineering-contract-approved__stat-icon">▦</span><span><small>Estruturas</small><strong>{structures.length}</strong></span></div>
          <div><span className="engineering-contract-approved__stat-icon">◇</span><span><small>Aditivos</small><strong>{addenda.length}</strong></span></div>
          <div><span className="engineering-contract-approved__stat-icon engineering-contract-approved__stat-icon--success">▥</span><span><small>Distribuições</small><strong>{allocations.length}</strong></span></div>
        </div>
        <section className="engineering-contract-approved__section">
          <div className="engineering-contract-approved__section-head"><div><strong>Planilhas por torre / estrutura</strong><span>Selecione uma torre ou estrutura para abrir sua planilha completa em modal.</span></div></div>
          <div className="engineering-contract-approved__structure-list">
            {sheetStructures.length?sheetStructures.map(item=>{const count=allocations.filter(allocation=>allocation.structureId===item.id).length;return <button key={item.id} type="button" className="engineering-contract-approved__structure" onClick={()=>selectSheetGroup({type:'structure',id:item.id})}><span className="engineering-contract-approved__building">▦</span><span className="engineering-contract-approved__structure-name"><strong>{item.name}</strong><small>Planilha-base da estrutura</small></span><span className="engineering-contract-approved__structure-meta"><small>Serviços distribuídos</small><b>{count}</b></span><span className="engineering-contract-approved__structure-meta"><small>Situação</small><b className="engineering-status engineering-status--active">Ativa</b></span><span className="engineering-contract-approved__open">Abrir planilha</span><span className="engineering-contract-approved__chevron">›</span></button>}):emptyRow('Nenhuma torre ou estrutura corresponde ao filtro.')}
          </div>
        </section>
        <section className="engineering-contract-approved__section engineering-contract-approved__section--addenda">
          <div className="engineering-contract-approved__section-head"><div><strong>Aditivos</strong><span>Cada aditivo permanece separado da planilha-base do contrato.</span></div><Button size="sm" variant="secondary" onClick={()=>open('addendum')}>＋ Novo aditivo</Button></div>
          <div className="engineering-contract-approved__addenda-grid">
            {sheetAddenda.length?sheetAddenda.map(item=><button key={item.id} type="button" className="engineering-contract-approved__addendum" onClick={()=>selectSheetGroup({type:'addendum',id:item.id})}><span className="engineering-contract-approved__addendum-icon">▤</span><span className="engineering-contract-approved__addendum-copy"><strong>Aditivo {item.number}</strong><small>{labelStatus(item.status)}</small></span><span className="engineering-contract-approved__addendum-open">Abrir planilha</span><span className="engineering-contract-approved__chevron">›</span></button>):<em className="ui-muted">Nenhum aditivo corresponde ao filtro.</em>}
          </div>
        </section>
        {selectedStructure&&<Dialog open title={selectedStructure.name} description={`${structureAllocations.length} serviço(s) com quantitativo definido`} onClose={()=>setSheetGroup(null)} onBack={()=>setSheetGroup(null)} footer={<Button onClick={()=>open('allocation')}>＋ Distribuir serviço</Button>}><div className="engineering-sheet"><div className="engineering-sheet__live-filter"><span aria-hidden="true">⌕</span><input autoFocus value={serviceSearch} onChange={event=>setServiceSearch(event.target.value)} placeholder="Filtrar serviços enquanto digita: código, descrição, unidade ou quantitativo…" aria-label={`Filtrar serviços da ${selectedStructure.name}`}/>{serviceSearch&&<button type="button" onClick={()=>setServiceSearch('')} aria-label="Limpar filtro">×</button>}<small>{structureRows.length} de {structureAllocations.length}</small></div><div className="engineering-sheet__table-wrap engineering-sheet__table-wrap--detail"><table className="engineering-sheet__table engineering-sheet__table--services"><thead><tr><th>#</th><th>Serviço</th><th>Unidade</th><th>Valor unit.</th><th>Quantitativo</th><th>Ações</th></tr></thead><tbody>{structureRows.map(row=><tr key={row.service.id}><td>{String(row.index+1).padStart(3,'0')}</td><td><strong>{row.service.description}</strong></td><td>{row.service.unit}</td><td>{currency.format(row.service.unitPrice)}</td><td><strong>{quantity.format(row.allocation.allocatedQuantity)}</strong></td><td><Button size="sm" variant="tertiary" onClick={()=>{const cfg=towerConfig(selectedStructure.metadata);const availableFloors=cfg?[...(cfg.hasGroundFloor&&cfg.groundFloorUnits>0?['TR']:[]),...Array.from({length:cfg.floorCount},(_,offset)=>String(cfg.firstFloor+offset)),...(cfg.hasRoof&&cfg.roofUnits>0?['COB']:[])]:[];const floorUnits:Record<string,number>={};if(cfg){if(cfg.hasGroundFloor&&cfg.groundFloorUnits>0)floorUnits.TR=cfg.groundFloorUnits;Array.from({length:cfg.floorCount},(_,offset)=>String(cfg.firstFloor+offset)).forEach(floor=>{floorUnits[floor]=cfg.unitsPerFloor;});if(cfg.hasRoof&&cfg.roofUnits>0)floorUnits.COB=cfg.roofUnits;}const savedFloors=Array.isArray(row.allocation.scopeConfig?.floors)?row.allocation.scopeConfig.floors.map(String):[];setAllocationError(null);setAllocationEdit({contractServiceId:row.service.id,structureId:selectedStructure.id,serviceLabel:row.service.description,structureLabel:selectedStructure.name,unit:row.service.unit,quantity:String(row.allocation.allocatedQuantity),maxQuantity:row.service.quantity,notes:row.allocation.notes??'',availableFloors,selectedFloors:savedFloors,unitsPerFloor:cfg?.unitsPerFloor??0,floorUnits});}}>Editar quantitativo</Button></td></tr>)}</tbody></table>{structureRows.length===0&&emptyRow(serviceSearch?'Nenhum serviço corresponde ao filtro digitado.':'Nenhum serviço distribuído para esta estrutura.')}</div></div></Dialog>}
        {selectedAddendum&&<EngineeringAddendumSheetDialog open scope={scope} addendumId={selectedAddendum.id} addendumNumber={selectedAddendum.number} statusLabel={labelStatus(selectedAddendum.status)} onClose={()=>setSheetGroup(null)} onEditLine={()=>open('addendumLine')}/>}
      </div>;
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
    content=<div className="engineering-contract-workspace__page engineering-sheet"><header className="engineering-sheet__head"><div><small>{meta.eyebrow}</small><h3>{meta.title}</h3><p>{meta.description}</p></div><div><span className="engineering-sheet__contract-badge">{contract.contractNumber}</span>{section==='contrato'&&<Button size="sm" onClick={()=>setContractRetentionEditOpen(true)}>Editar contrato</Button>}</div></header>{body}</div>;
  }

  const formMode={
    contractStatus:{tab:'contratos',mode:'contract-data'},structure:{tab:'contratos',mode:'contract-data'},contractService:{tab:'contratos',mode:'contract-services'},allocation:{tab:'contratos',mode:'contract-services'},provisional:{tab:'provisorios',mode:'default'},provisionalLine:{tab:'provisorios',mode:'default'},convert:{tab:'provisorios',mode:'default'},addendum:{tab:'contratos',mode:'contract-data'},addendumLine:{tab:'contratos',mode:'contract-services'},measurement:{tab:'medicoes',mode:'measurement-create'},measurementLine:{tab:'medicoes',mode:'measurement-create'},retention:{tab:'medicoes',mode:'contract-taxes'},measurementStatus:{tab:'medicoes',mode:'measurement-close'},receivable:{tab:'medicoes',mode:'measurement-close'},receive:{tab:'medicoes',mode:'measurement-close'},
  } as const;
  const activeForm=formKind?formMode[formKind]:null;
  return <>{content}{activeForm&&formKind&&<div className="engineering-sheet-form"><div className="engineering-sheet-form__backdrop" onClick={()=>setFormKind(null)}/><div className="engineering-sheet-form__panel"><div className="engineering-sheet-form__head"><div><small>ENGENHARIA</small><strong>{section==='resumo'?'Contrato':sectionMeta[section].title}</strong></div><Button variant="secondary" size="sm" onClick={()=>setFormKind(null)}>Fechar</Button></div><div className="engineering-sheet-form__content"><EngineeringOperationsPanel activeTab={activeForm.tab} scope={scope} onChanged={changed} actionsMode={activeForm.mode} focusedContractId={contract.contractId} initialKind={formKind} hideActions onDialogClosed={()=>setFormKind(null)}/></div></div></div>}{allocationEdit&&<Dialog open title="Editar quantitativo" description={`${allocationEdit.structureLabel} · ${allocationEdit.serviceLabel}`} loading={allocationSaving} onClose={()=>!allocationSaving&&setAllocationEdit(null)} onBack={()=>!allocationSaving&&setAllocationEdit(null)} onConfirm={()=>void saveAllocationEdit()} confirmLabel="Salvar quantitativo"><div className="engineering-sheet__subsection engineering-allocation-editor"><div className="engineering-sheet__subhead"><div><strong>{allocationEdit.serviceLabel}</strong><span>Serviço e torre já definidos pela linha selecionada.</span></div></div>{allocationEdit.availableFloors.length>0&&<div className="engineering-allocation-editor__floors"><div><strong>Distribuição por pavimento</strong><span>Selecione os pavimentos deste serviço, como no Gestão 2.0.</span></div><div className="engineering-allocation-editor__floor-grid">{allocationEdit.availableFloors.map(floor=><button key={floor} type="button" className={allocationEdit.selectedFloors.includes(floor)?'is-selected':''} onClick={()=>toggleAllocationFloor(floor)}>{floor==='TR'?'Térreo':floor==='COB'?'Cobertura':`${floor}º`}</button>)}</div>{allocationEdit.unit.trim().toLocaleUpperCase('pt-BR')==='APTO'&&allocationEdit.unitsPerFloor>0&&<small>{allocationEdit.selectedFloors.length} nível(is) selecionado(s) · {quantity.format(numberValue(allocationEdit.quantity))} aptos · capacidade da estrutura {quantity.format(allocationEdit.availableFloors.reduce((sum,floor)=>sum+(allocationEdit.floorUnits[floor]??allocationEdit.unitsPerFloor),0))}</small>}</div>}<label><span>Quantitativo</span><input autoFocus inputMode="decimal" value={allocationEdit.quantity} onChange={event=>{setAllocationError(null);setAllocationEdit(current=>current?{...current,quantity:event.target.value}:current);}}/></label>{allocationError&&<div className="engineering-allocation-editor__error" role="alert">{allocationError}</div>}<label><span>Observações</span><textarea rows={3} value={allocationEdit.notes} onChange={event=>setAllocationEdit(current=>current?{...current,notes:event.target.value}:current)}/></label></div></Dialog>}{contractRetentionEditOpen&&<EditEngineeringContractRetentionDialog open scope={scope} contractId={contract.contractId} contractNumber={contract.contractNumber} onClose={()=>setContractRetentionEditOpen(false)} onSaved={changed}/>}{selectedStructureEdit&&<EditEngineeringStructureDialog open scope={scope} structure={selectedStructureEdit} onClose={()=>setStructureEditId(null)} onSaved={changed}/>}{contractSelectedAddendum&&<EngineeringAddendumSheetDialog open scope={scope} addendumId={contractSelectedAddendum.id} addendumNumber={contractSelectedAddendum.number} statusLabel={labelStatus(contractSelectedAddendum.status)} onClose={()=>setContractAddendumId(null)} onEditLine={()=>open('addendumLine')}/>}{guidedMeasurementOpen&&<GuidedMeasurementFlow scope={scope} contractId={contract.contractId} onChanged={changed} onClose={()=>setGuidedMeasurementOpen(false)}/>}</>;
}