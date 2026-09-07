import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { useEngineeringOperations } from './useEngineeringOperations';
import { loadContractRetentions } from '../infrastructure/EngineeringContractModalRepository';
import {
  loadMeasurementParity,
  replaceMeasurementParityStage,
  type MeasurementParityModel,
  type MeasurementParityOrigin,
  type MeasurementParityStage,
} from '../infrastructure/LegacyMeasurementParityRepository';
import './guided-measurement-flow.css';
import './approved-measurement-sheet.css';

interface Props {
  scope:{tenantId:string;companyId:string}; contractId:string; initialMeasurementId?:string;
  initialOriginId?:string; initialOriginName?:string; draftHeader?:Record<string,string>|null;
  onDraftPersisted?:()=>void; onChanged:()=>void; onClose:()=>void;
}

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const safeText=(value:unknown)=>typeof value==='string'?value:typeof value==='number'||typeof value==='boolean'?String(value):'';
const normalize=(value:unknown)=>safeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const referenceFloor=(reference:string)=>{const match=reference.match(/^(\d{1,2})\d{2}$/);return match?String(Number(match[1])):null;};
const referenceLevel=(reference:string)=>reference.startsWith('TR-')?'TR':referenceFloor(reference)??'OUTROS';
const referenceLevelLabel=(level:string)=>level==='TR'?'Térreo':level==='OUTROS'?'Outras unidades':`${level}º pavimento`;
const unitBased=(stage:MeasurementParityStage)=>/^(apto|apt|apartamento|apartamentos|un|und|unid|unidade|unidades)$/i.test(stage.unit.trim());
const originLabel=(origin:MeasurementParityOrigin)=>origin.type==='addendum'?`Aditivo · ${origin.name}`:origin.name;

function buildTowerReferences(model:MeasurementParityModel,origin:MeasurementParityOrigin):string[]{
  if(model.enterpriseType==='casas'&&model.houses.length)return Array.from(new Set(model.houses.map(value=>value.trim()).filter(Boolean)));
  const numericFloors=Math.max(0,Number(origin.floorCount||0));
  const configuredLevelCount=numericFloors+(origin.hasGround?1:0);
  const quantities=origin.services.filter(unitBased).map(service=>Number(service.contractedQuantity||0)).filter(value=>value>0);
  const maxQuantity=quantities.length?Math.max(...quantities):0;
  const isTowerFour=normalize(origin.name).includes('torre 4');
  const perFloor=isTowerFour?8:(configuredLevelCount>0&&maxQuantity>0?Math.max(1,Math.round(maxQuantity/configuredLevelCount)):8);
  const inferredLevelCount=isTowerFour&&maxQuantity>0&&maxQuantity%perFloor===0?maxQuantity/perFloor:configuredLevelCount;
  const levelCount=Math.max(configuredLevelCount,inferredLevelCount);
  const upperFloorCount=origin.hasGround?Math.max(0,levelCount-1):levelCount;
  const references:string[]=[];
  if(origin.hasGround)for(let unit=1;unit<=perFloor;unit++)references.push(`TR-${String(unit).padStart(2,'0')}`);
  for(let floor=1;floor<=upperFloorCount;floor++)for(let unit=1;unit<=perFloor;unit++)references.push(`${floor}${String(unit).padStart(2,'0')}`);
  return references;
}
function genericUnitReferences(stage:MeasurementParityStage):string[]{
  const total=Math.max(0,Math.floor(stage.contractedQuantity));
  if(!unitBased(stage)||total<=0||total>500)return [];
  return Array.from({length:total},(_,index)=>String(101+index));
}
function stageReferences(model:MeasurementParityModel,origin:MeasurementParityOrigin,stage:MeasurementParityStage):string[]{
  const base=origin.type==='tower'?buildTowerReferences(model,origin):genericUnitReferences(stage);
  // Quando o quantitativo contratado cobre a torre inteira, o cadastro da medição
  // deve refletir todas as unidades atuais, mesmo que exista um escopo antigo
  // salvo antes da correção do quantitativo (ex.: 56 -> 96 apartamentos).
  if(unitBased(stage)&&base.length>0&&stage.contractedQuantity>=base.length)return base;
  if(stage.scopeUnits.length){const allowed=new Set(stage.scopeUnits.map(normalize));return base.filter(reference=>allowed.has(normalize(reference)));}
  if(stage.scopeFloors.length){const allowed=new Set(stage.scopeFloors.map(value=>String(Number(value))));return base.filter(reference=>{const floor=referenceFloor(reference);return floor!==null&&allowed.has(floor);});}
  if(stage.scopeActive&&stage.startFloor!==null)return base.filter(reference=>{const floor=referenceFloor(reference);return floor!==null&&Number(floor)>=Number(stage.startFloor);});
  return base;
}

export function GuidedMeasurementFlow({scope,contractId,initialMeasurementId='',initialOriginId='',draftHeader=null,onDraftPersisted,onChanged,onClose}:Props){
  const [model,setModel]=useState<MeasurementParityModel|null>(null);
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null);
  const [measurementId,setMeasurementId]=useState(''); const [originId,setOriginId]=useState(initialOriginId); const [serviceIndex,setServiceIndex]=useState(0);
  const [pickerOpen,setPickerOpen]=useState(false); const [unitPickerOpen,setUnitPickerOpen]=useState(false); const [serviceSearch,setServiceSearch]=useState(''); const [typeFilter,setTypeFilter]=useState(''); const [statusFilter,setStatusFilter]=useState(''); const [selectedUnits,setSelectedUnits]=useState<string[]>([]); const [search,setSearch]=useState(''); const [manualQuantity,setManualQuantity]=useState('');
  const [retentions,setRetentions]=useState({inss:0,iss:0,rt:0});
  const [header,setHeader]=useState({measurementNumber:'',competence:'',dueDate:'',expectedPaymentDate:'',paymentMethod:'PIX',notes:''});
  const [headerSaving,setHeaderSaving]=useState(false);
  const operations=useEngineeringOperations(scope); const draftMode=Boolean(draftHeader);
  const reload=useCallback(async()=>{setLoading(true);setError(null);try{const next=await loadMeasurementParity(scope,contractId);setModel(next);return next;}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível carregar a medição.');return null;}finally{setLoading(false);}},[contractId,scope]);
  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{void loadContractRetentions(scope,contractId).then(setRetentions).catch(()=>setRetentions({inss:0,iss:0,rt:0}));},[scope,contractId]);
  const drafts=useMemo(()=>model?.measurements.filter(item=>item.status==='draft')??[],[model?.measurements]);
  useEffect(()=>{if(initialMeasurementId&&drafts.some(item=>item.id===initialMeasurementId)){setMeasurementId(initialMeasurementId);return;}if(draftMode)return;if(measurementId&&drafts.some(item=>item.id===measurementId))return;setMeasurementId('');},[draftMode,drafts,measurementId,initialMeasurementId]);
  const snapshotMeasurement=operations.state.data?.measurements.find(item=>item.id===measurementId);
  useEffect(()=>{const source=snapshotMeasurement;setHeader({measurementNumber:draftHeader?.measurementNumber??source?.measurementNumber??'',competence:(draftHeader?.competence??source?.competence??'').slice(0,7),dueDate:draftHeader?.dueDate??source?.dueDate??'',expectedPaymentDate:draftHeader?.expectedPaymentDate??source?.expectedPaymentDate??'',paymentMethod:draftHeader?.paymentMethod??source?.paymentMethod??'PIX',notes:draftHeader?.notes??source?.notes??''});},[measurementId,snapshotMeasurement,draftHeader]);
  useEffect(()=>{if(!model)return;if(initialOriginId&&model.origins.some(item=>item.id===initialOriginId)){setOriginId(initialOriginId);setPickerOpen(true);}},[initialOriginId,model]);

  const origin=useMemo(()=>model?.origins.find(item=>item.id===originId)??null,[model?.origins,originId]);
  const stages=useMemo(()=>origin?.services??[],[origin]); const stage=stages[serviceIndex];
  const stagePriceByTarget=useMemo(()=>{const map=new Map<string,number>();for(const itemOrigin of model?.origins??[])for(const item of itemOrigin.services)map.set(`${item.targetKind}:${item.targetId}`,item.unitPrice);return map;},[model]);
  const measurementGross=useMemo(()=>!model||!measurementId?0:model.lines.filter(line=>line.measurementId===measurementId).reduce((sum,line)=>sum+line.measuredQuantity*(stagePriceByTarget.get(`${line.targetKind}:${line.targetId}`)??0),0),[model,measurementId,stagePriceByTarget]);
  const inssValue=measurementGross*retentions.inss/100, issValue=measurementGross*retentions.iss/100, rtValue=measurementGross*retentions.rt/100;
  const measurementNet=Math.max(0,measurementGross-inssValue-issValue-rtValue);
  const originRows=useMemo(()=>{if(!model||!measurementId)return [];return model.origins.map(itemOrigin=>{const keys=new Set(itemOrigin.services.map(item=>`${item.targetKind}:${item.targetId}`));const lines=model.lines.filter(line=>line.measurementId===measurementId&&keys.has(`${line.targetKind}:${line.targetId}`));return {origin:itemOrigin,gross:lines.reduce((sum,line)=>sum+line.measuredQuantity*(stagePriceByTarget.get(`${line.targetKind}:${line.targetId}`)??0),0),serviceCount:new Set(lines.map(line=>`${line.targetKind}:${line.targetId}`)).size};}).filter(row=>row.serviceCount>0||row.gross>0);},[model,measurementId,stagePriceByTarget]);

  const refs=useMemo(()=>model&&origin&&stage?stageReferences(model,origin,stage):[],[model,origin,stage]);
  const targetLines=useMemo(()=>model&&stage?model.lines.filter(line=>line.targetKind===stage.targetKind&&line.targetId===stage.targetId):[],[model,stage]);
  const currentLines=useMemo(()=>targetLines.filter(line=>line.measurementId===measurementId),[targetLines,measurementId]);
  const previousLines=useMemo(()=>targetLines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)),[targetLines,measurementId]);
  const previousQty=previousLines.reduce((sum,line)=>sum+line.measuredQuantity,0); const balance=Math.max(0,(stage?.contractedQuantity??0)-previousQty);
  const blocked=new Set(previousLines.map(line=>line.reference).filter((value):value is string=>Boolean(value))); const available=refs.filter(reference=>!blocked.has(reference)); const maxSelectable=Math.max(0,Math.min(available.length,Math.floor(balance)));
  const visible=available.filter(reference=>!normalize(search)||normalize(reference).includes(normalize(search)));
  const grouped=useMemo(()=>{const groups=new Map<string,string[]>();for(const reference of visible){const level=referenceLevel(reference);groups.set(level,[...(groups.get(level)??[]),reference]);}const rank=(level:string)=>level==='TR'?-1:level==='OUTROS'?9999:Number(level);return [...groups.entries()].sort((a,b)=>rank(a[0])-rank(b[0]));},[visible]);
  const effectiveQuantity=refs.length?selectedUnits.length:Number(manualQuantity.replace(',','.'))||0;
  const filteredStages=useMemo(()=>{if(!model||!origin)return [];return stages.map((item,index)=>({item,index})).filter(({item})=>{
    if(normalize(serviceSearch)&&!normalize(`${item.code??''} ${item.description}`).includes(normalize(serviceSearch)))return false;
    const itemRefs=stageReferences(model,origin,item);
    if(typeFilter==='unit'&&itemRefs.length===0)return false;
    if(typeFilter==='global'&&itemRefs.length>0)return false;
    const key=`${item.targetKind}:${item.targetId}`;
    const previous=model.lines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)&&`${line.targetKind}:${line.targetId}`===key).reduce((sum,line)=>sum+line.measuredQuantity,0);
    const remaining=Math.max(0,item.contractedQuantity-previous);
    if(statusFilter==='balance'&&remaining<=0)return false;
    if(statusFilter==='done'&&remaining>0)return false;
    return true;
  });},[model,origin,stages,serviceSearch,typeFilter,statusFilter,measurementId]);
  const originSummary=useMemo(()=>{if(!model||!origin)return {contracted:0,measured:0,balance:0,measuredPct:0,balancePct:0};let contracted=0,measured=0;for(const item of origin.services){contracted+=item.contractedQuantity*item.unitPrice;const key=`${item.targetKind}:${item.targetId}`;const qty=model.lines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)&&`${line.targetKind}:${line.targetId}`===key).reduce((sum,line)=>sum+line.measuredQuantity,0);measured+=qty*item.unitPrice;}const balanceValue=Math.max(0,contracted-measured);return {contracted,measured,balance:balanceValue,measuredPct:contracted?measured/contracted*100:0,balancePct:contracted?balanceValue/contracted*100:0};},[model,origin,measurementId]);

  useEffect(()=>{if(!stage){setSelectedUnits([]);setManualQuantity('');return;}setSelectedUnits(currentLines.map(line=>line.reference).filter((value):value is string=>Boolean(value)));const current=currentLines.reduce((sum,line)=>sum+line.measuredQuantity,0);setManualQuantity(currentLines.some(line=>line.reference)?'':current>0?String(current).replace('.',','):'');setSearch('');},[stage,currentLines]);

  async function openOrigin(nextOriginId:string){if(!nextOriginId)return;if(measurementId){try{await saveHeader();}catch{return;}}setOriginId(nextOriginId);setServiceIndex(0);setServiceSearch('');setTypeFilter('');setStatusFilter('');setUnitPickerOpen(false);setError(null);setPickerOpen(true);}
  function openService(index:number){setServiceIndex(index);setSearch('');setError(null);setUnitPickerOpen(true);}
  function closeUnitPicker(){setUnitPickerOpen(false);setSelectedUnits([]);setManualQuantity('');setSearch('');}
  function closePicker(){setUnitPickerOpen(false);setPickerOpen(false);setOriginId('');setServiceSearch('');setTypeFilter('');setStatusFilter('');setSelectedUnits([]);setManualQuantity('');setSearch('');}
  async function confirmSelection(){
    if(!origin||!stage)return; let activeMeasurementId=measurementId;
    if(!activeMeasurementId&&draftMode){const measurementNumber=(draftHeader?.measurementNumber??'').trim(),competence=(draftHeader?.competence??'').trim();if(!measurementNumber||!competence){setError('Informe o número e a competência da medição.');return;}try{await operations.createMeasurement({contractId,competence,measurementNumber,dueDate:draftHeader?.dueDate||null,expectedPaymentDate:draftHeader?.expectedPaymentDate||null,paymentMethod:draftHeader?.paymentMethod||'PIX',originLabel:originLabel(origin),notes:draftHeader?.notes||null});const refreshed=await loadMeasurementParity(scope,contractId);const created=refreshed.measurements.find(item=>item.measurementNumber===measurementNumber&&item.status==='draft');if(!created)throw new Error('A medição foi criada, mas não pôde ser reaberta.');activeMeasurementId=created.id;setMeasurementId(created.id);setModel(refreshed);onDraftPersisted?.();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível criar a medição.');return;}}
    if(!activeMeasurementId){setError('Crie ou selecione uma medição em rascunho.');return;} if(effectiveQuantity<=0&&currentLines.length===0){setError(refs.length?'Selecione ao menos uma unidade.':'Informe a quantidade medida.');return;} if(effectiveQuantity>balance+0.0001){setError('A quantidade excede o saldo disponível.');return;}
    setSaving(true);setError(null);try{await replaceMeasurementParityStage(scope,{measurementId:activeMeasurementId,targetKind:stage.targetKind,targetId:stage.targetId,quantity:effectiveQuantity,references:refs.length?selectedUnits:[],originName:origin.name,legacyServiceId:stage.legacyServiceId});await reload();closeUnitPicker();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível confirmar a seleção.');}finally{setSaving(false);}
  }
  async function saveHeader(){if(!measurementId)return;const measurementNumber=header.measurementNumber.trim(),competence=header.competence.trim();if(!measurementNumber){setError('Informe o número da medição.');return;}if(!competence){setError('Informe a competência.');return;}setHeaderSaving(true);setError(null);try{await operations.updateMeasurement({measurementId,measurementNumber,competence,dueDate:header.dueDate||null,expectedPaymentDate:header.expectedPaymentDate||null,paymentMethod:header.paymentMethod||null,notes:header.notes||null});await reload();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar os dados da medição.');throw cause;}finally{setHeaderSaving(false);}}
  async function finalizeMeasurement(){if(!measurementId){setError('Salve ao menos um serviço antes de finalizar a medição.');return;}try{await saveHeader();await operations.setMeasurementStatus(measurementId,'close');onChanged();onClose();}catch{return;}}
  function closeFlow(){onClose();}

  if(loading&&!model)return <Dialog open variant="measurement-fullscreen" title="Medição" onClose={closeFlow} onBack={closeFlow}><LoadingState label="Carregando medição…"/></Dialog>;
  if(!model)return <Dialog open variant="measurement-fullscreen" title="Medição" onClose={closeFlow} onBack={closeFlow}><Feedback tone="danger" title="Não foi possível carregar" message={error??'Dados indisponíveis.'}/></Dialog>;

  return <Dialog open variant="measurement-fullscreen" title="Medição" description="Selecione a origem e lance os serviços sem sair desta medição." onClose={closeFlow} onBack={closeFlow}>
    <div className="guided-measurement guided-measurement--parity approved-measurement-sheet measurement-hub">
      {error&&<Feedback tone="danger" title="Não foi possível continuar" message={error}/>} 
      <section className="measurement-hub__header-card"><div className="measurement-hub__header-title"><div><small>MEDIÇÃO EM RASCUNHO</small><h3>Dados da medição</h3><p>Revise datas e condições antes de finalizar.</p></div><span>#{header.measurementNumber||'—'}</span></div><div className="measurement-hub__header-grid"><Input label="Nº da medição" value={header.measurementNumber} onChange={event=>setHeader(current=>({...current,measurementNumber:event.target.value}))}/><Input label="Competência" type="month" value={header.competence} onChange={event=>setHeader(current=>({...current,competence:event.target.value}))}/><Input label="Vencimento previsto" type="date" value={header.dueDate} onChange={event=>setHeader(current=>({...current,dueDate:event.target.value}))}/><Input label="Data prevista para pagamento" type="date" value={header.expectedPaymentDate} onChange={event=>setHeader(current=>({...current,expectedPaymentDate:event.target.value}))}/><Select label="Forma de pagamento" value={header.paymentMethod} onChange={event=>setHeader(current=>({...current,paymentMethod:event.target.value}))} options={[{value:'PIX',label:'PIX'},{value:'TED',label:'TED'},{value:'Boleto',label:'Boleto'},{value:'Transferência',label:'Transferência'},{value:'Outro',label:'Outro'}]}/><Input label="Observações" value={header.notes} onChange={event=>setHeader(current=>({...current,notes:event.target.value}))} placeholder="Observações da medição"/></div></section>
      <section className="measurement-hub__financial"><div><span>Bruto da medição</span><strong>{currency.format(measurementGross)}</strong></div><div><span>INSS ({retentions.inss.toLocaleString('pt-BR',{maximumFractionDigits:2})}%)</span><strong>{currency.format(inssValue)}</strong></div><div><span>ISS ({retentions.iss.toLocaleString('pt-BR',{maximumFractionDigits:2})}%)</span><strong>{currency.format(issValue)}</strong></div><div><span>Retenção ({retentions.rt.toLocaleString('pt-BR',{maximumFractionDigits:2})}%)</span><strong>{currency.format(rtValue)}</strong></div><div className="is-net"><span>Líquido da medição</span><strong>{currency.format(measurementNet)}</strong></div></section>
      <section className="measurement-hub__origin-picker"><div><strong>Selecionar origem</strong><span>Escolha Torre 4, Torre 6 ou um aditivo.</span></div><Select label="Torre / Aditivo" value="" onChange={event=>void openOrigin(event.target.value)} options={[{value:'',label:'Selecione uma torre ou aditivo…'},...model.origins.map(item=>({value:item.id,label:originLabel(item)}))]}/></section>
      <section className="measurement-hub__origins"><header><div><strong>Origens já adicionadas nesta medição</strong><span>Os valores abaixo compõem o bruto geral da medição.</span></div></header>{originRows.length===0?<div className="measurement-hub__empty">Nenhuma torre ou aditivo lançado ainda.</div>:<div className="measurement-hub__origin-list">{originRows.map(row=><button key={row.origin.id} type="button" onClick={()=>void openOrigin(row.origin.id)}><span><strong>{originLabel(row.origin)}</strong><small>{row.serviceCount} serviço(s) lançado(s)</small></span><b>{currency.format(row.gross)}</b><em>Editar ›</em></button>)}</div>}</section>
      <footer className="approved-measurement-sheet__bottom-actions measurement-hub__footer"><Button variant="secondary" onClick={closeFlow}>Cancelar medição</Button><div><Button variant="secondary" disabled={headerSaving||!measurementId} onClick={()=>void saveHeader()}>{headerSaving?'Salvando…':'▣ Salvar rascunho'}</Button><Button disabled={headerSaving||!measurementId||measurementGross<=0} onClick={()=>void finalizeMeasurement()}>✓ Finalizar medição</Button></div></footer>
    </div>

    {pickerOpen&&origin&&<div className="guided-measurement-picker" role="dialog" aria-modal="true" aria-label={`Medição - ${originLabel(origin)}`}><div className="guided-measurement-picker__panel approved-measurement-origin-modal">
      <header className="approved-measurement-origin-modal__header"><div><small>MEDIÇÃO · {originLabel(origin)}</small><h3>Medição - {originLabel(origin)}</h3><p>Pesquise os serviços, selecione apartamentos/unidades e confirme esta origem.</p></div><Button variant="secondary" size="sm" onClick={closePicker}>✕</Button></header>
      <section className="approved-measurement-sheet__summary approved-measurement-origin-modal__summary"><div className="approved-measurement-sheet__origin"><span className="approved-measurement-sheet__building">▦</span><div><h3>{originLabel(origin)}</h3><p>{stages.length} serviço(s) nesta origem</p></div></div><div className="approved-measurement-sheet__summary-card"><span>Valor contratado</span><strong>{currency.format(originSummary.contracted)}</strong></div><div className="approved-measurement-sheet__summary-card"><span>Valor medido</span><strong>{currency.format(originSummary.measured)}</strong><b>{originSummary.measuredPct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</b></div><div className="approved-measurement-sheet__summary-card"><span>Saldo a medir</span><strong>{currency.format(originSummary.balance)}</strong><b>{originSummary.balancePct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</b></div></section>
      <section className="approved-measurement-sheet__toolbar approved-measurement-origin-modal__toolbar"><Input label="Pesquisar serviço" value={serviceSearch} onChange={event=>setServiceSearch(event.target.value)} placeholder="Pesquisar serviço (código ou descrição)..."/><Select label="Tipo" value={typeFilter} onChange={event=>setTypeFilter(event.target.value)} options={[{value:'',label:'Todos os tipos'},{value:'global',label:'Global'},{value:'unit',label:'Por unidade'}]}/><Select label="Status" value={statusFilter} onChange={event=>setStatusFilter(event.target.value)} options={[{value:'',label:'Todos os status'},{value:'balance',label:'Com saldo'},{value:'done',label:'Concluído'}]}/><Button variant="secondary" onClick={()=>{setServiceSearch('');setTypeFilter('');setStatusFilter('');}}>Limpar filtros</Button></section>
      <section className="approved-measurement-sheet__table-card approved-measurement-origin-modal__table-card"><div className="approved-measurement-sheet__table-wrap"><table className="approved-measurement-sheet__table"><thead><tr><th>#</th><th>Código</th><th>Descrição do serviço</th><th>Referência</th><th>Contratado</th><th>Medido</th><th>Saldo</th><th>Tipo</th><th>Valor unitário</th><th>Nesta medição</th><th>Total</th></tr></thead><tbody>{filteredStages.map(({item,index},rowPosition)=>{const key=`${item.targetKind}:${item.targetId}`;const lines=model.lines.filter(line=>`${line.targetKind}:${line.targetId}`===key);const previous=lines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)).reduce((sum,line)=>sum+line.measuredQuantity,0);const current=lines.filter(line=>line.measurementId===measurementId).reduce((sum,line)=>sum+line.measuredQuantity,0);const remaining=Math.max(0,item.contractedQuantity-previous);const itemRefs=stageReferences(model,origin,item);return <tr key={key}><td>{rowPosition+1}</td><td><strong>{item.code||`#${index+1}`}</strong></td><td>{item.description}</td><td><span className="approved-measurement-sheet__unit">{item.unit}</span>{itemRefs.length>0?<Button size="sm" onClick={()=>openService(index)}>Selecionar apartamentos/unidades</Button>:<Button size="sm" onClick={()=>openService(index)}>Informar quantidade</Button>}</td><td>{item.contractedQuantity.toLocaleString('pt-BR')}</td><td>{previous.toLocaleString('pt-BR')}</td><td>{remaining.toLocaleString('pt-BR')}</td><td><span className={`approved-measurement-sheet__type ${itemRefs.length?'is-unit':'is-global'}`}>{itemRefs.length?'Por unidade':'Global'}</span></td><td>{currency.format(item.unitPrice)}</td><td><strong>{current.toLocaleString('pt-BR')}</strong></td><td>{currency.format(current*item.unitPrice)}</td></tr>})}</tbody></table></div><footer className="approved-measurement-sheet__pagination"><span>Exibindo {filteredStages.length} de {stages.length} serviços</span></footer></section>
      <footer className="approved-measurement-sheet__bottom-actions approved-measurement-origin-modal__footer"><Button variant="secondary" onClick={closePicker}>Voltar à medição</Button><Button onClick={closePicker}>✓ Confirmar {originLabel(origin)}</Button></footer>
    </div></div>}

    {pickerOpen&&unitPickerOpen&&origin&&stage&&<div className="guided-measurement-picker guided-measurement-unit-picker" role="dialog" aria-modal="true" aria-label="Selecionar apartamentos e unidades"><div className="guided-measurement-picker__panel">
      <header className="approved-unit-picker__header"><div><small>{originLabel(origin)}</small><h3>{stage.code?`${stage.code} · `:''}{stage.description}</h3><p>Selecione os apartamentos/unidades que receberão este serviço.</p></div><Button variant="secondary" size="sm" onClick={closeUnitPicker}>✕</Button></header>
      <section className="approved-unit-picker__summary"><div><span>Torre</span><strong>{originLabel(origin)}</strong><small>{refs.length?`${Math.max(1,Math.round(refs.length/Math.max(1,new Set(refs.map(referenceLevel)).size)))} apartamentos por pavimento`:'Serviço global'}</small></div><div><span>Serviço</span><strong>{stage.code||'—'}</strong><small>{currency.format(stage.unitPrice)} por unidade</small></div><div><span>Contratado</span><strong>{stage.contractedQuantity.toLocaleString('pt-BR')} un</strong><small>{currency.format(stage.contractedQuantity*stage.unitPrice)}</small></div><div><span>Já medido</span><strong>{previousQty.toLocaleString('pt-BR')} un</strong><small>{currency.format(previousQty*stage.unitPrice)}</small></div><div><span>Saldo</span><strong>{balance.toLocaleString('pt-BR')} un</strong><small>{currency.format(balance*stage.unitPrice)}</small></div></section>
      <div className="guided-measurement-picker__bar approved-unit-picker__toolbar approved-unit-picker__toolbar--compact">{refs.length>0?<><Button variant="secondary" onClick={()=>setSelectedUnits([])} disabled={selectedUnits.length===0}>Limpar seleção</Button><p><span>Selecionados:</span> <strong>{selectedUnits.length} un</strong> <span>· Valor total:</span> <strong>{currency.format(selectedUnits.length*stage.unitPrice)}</strong></p></>:<Input label="Quantidade nesta medição" value={manualQuantity} onChange={event=>setManualQuantity(event.target.value)} inputMode="decimal" placeholder="0,00"/>}</div>
      {refs.length>0&&<div className="guided-measurement-picker__list guided-measurement-picker__list--floors approved-unit-picker__floors">{grouped.map(([level,references])=>{const selectedOnFloor=references.filter(reference=>selectedUnits.includes(reference)).length;const allSelected=references.length>0&&selectedOnFloor===references.length;return <section className="guided-measurement-floor approved-unit-picker__floor" key={level}><header><div><strong>{referenceLevelLabel(level)}</strong><Button variant="secondary" size="sm" onClick={()=>setSelectedUnits(current=>{if(allSelected)return current.filter(item=>!references.includes(item));const next=[...current];for(const reference of references){if(next.length>=maxSelectable)break;if(!next.includes(reference))next.push(reference);}return next;})}>{allSelected?'Desmarcar andar':'Selecionar todos'}</Button></div><span>{selectedOnFloor}/{references.length} selecionado(s)</span></header><div className="guided-measurement-floor__units">{references.map(reference=><label key={reference} className={selectedUnits.includes(reference)?'is-selected':''}><input type="checkbox" checked={selectedUnits.includes(reference)} disabled={!selectedUnits.includes(reference)&&selectedUnits.length>=maxSelectable} onChange={()=>setSelectedUnits(current=>current.includes(reference)?current.filter(item=>item!==reference):(current.length<maxSelectable?[...current,reference]:current))}/><span>{reference.startsWith('TR-')?reference.slice(3):reference}</span></label>)}</div></section>})}</div>}
      <footer className="approved-unit-picker__footer"><div><strong>Resumo da seleção</strong><span>{selectedUnits.length>0?`${selectedUnits.length} unidade(s) · ${currency.format(selectedUnits.length*stage.unitPrice)}`:'Selecione os apartamentos para ver o resumo.'}</span></div><Button variant="secondary" onClick={()=>setSelectedUnits([])} disabled={selectedUnits.length===0}>Limpar seleção</Button><Button onClick={()=>void confirmSelection()} disabled={saving||(effectiveQuantity<=0&&currentLines.length===0)}>{saving?'Salvando…':'✓ Confirmar seleção'}</Button></footer>
    </div></div>}
  </Dialog>;
}
