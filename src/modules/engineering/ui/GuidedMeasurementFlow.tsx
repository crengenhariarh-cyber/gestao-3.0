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
  if(stage.scopeUnits.length){const allowed=new Set(stage.scopeUnits.map(normalize));return base.filter(reference=>allowed.has(normalize(reference)));}
  if(stage.scopeFloors.length){const allowed=new Set(stage.scopeFloors.map(value=>String(Number(value))));return base.filter(reference=>{const floor=referenceFloor(reference);return floor!==null&&allowed.has(floor);});}
  if(stage.scopeActive&&stage.startFloor!==null)return base.filter(reference=>{const floor=referenceFloor(reference);return floor!==null&&Number(floor)>=Number(stage.startFloor);});
  return base;
}

export function GuidedMeasurementFlow({scope,contractId,initialMeasurementId='',initialOriginId='',initialOriginName='',draftHeader=null,onDraftPersisted,onChanged,onClose}:Props){
  const [model,setModel]=useState<MeasurementParityModel|null>(null);
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null);
  const [measurementId,setMeasurementId]=useState(''); const [originId,setOriginId]=useState(initialOriginId); const [serviceIndex,setServiceIndex]=useState(0);
  const [pickerOpen,setPickerOpen]=useState(false); const [selectedUnits,setSelectedUnits]=useState<string[]>([]); const [search,setSearch]=useState(''); const [manualQuantity,setManualQuantity]=useState('');
  const [retentions,setRetentions]=useState({inss:0,iss:0,rt:0});
  const operations=useEngineeringOperations(scope); const draftMode=Boolean(draftHeader);
  const reload=useCallback(async()=>{setLoading(true);setError(null);try{const next=await loadMeasurementParity(scope,contractId);setModel(next);return next;}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível carregar a medição.');return null;}finally{setLoading(false);}},[contractId,scope]);
  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{void loadContractRetentions(scope,contractId).then(setRetentions).catch(()=>setRetentions({inss:0,iss:0,rt:0}));},[scope,contractId]);
  const drafts=useMemo(()=>model?.measurements.filter(item=>item.status==='draft')??[],[model?.measurements]);
  useEffect(()=>{if(initialMeasurementId&&drafts.some(item=>item.id===initialMeasurementId)){setMeasurementId(initialMeasurementId);return;}if(measurementId&&drafts.some(item=>item.id===measurementId))return;setMeasurementId(drafts[0]?.id??'');},[drafts,measurementId,initialMeasurementId]);
  useEffect(()=>{if(!model)return;if(initialOriginId&&model.origins.some(item=>item.id===initialOriginId)){setOriginId(initialOriginId);setPickerOpen(true);return;}if(initialOriginName){const match=model.origins.find(item=>normalize(item.name)===normalize(initialOriginName.replace(/^Aditivo\s*·\s*/i,'')));if(match){setOriginId(match.id);setPickerOpen(true);}}},[initialOriginId,initialOriginName,model]);

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

  useEffect(()=>{if(!stage){setSelectedUnits([]);setManualQuantity('');return;}setSelectedUnits(currentLines.map(line=>line.reference).filter((value):value is string=>Boolean(value)));const current=currentLines.reduce((sum,line)=>sum+line.measuredQuantity,0);setManualQuantity(currentLines.some(line=>line.reference)?'':current>0?String(current).replace('.',','):'');setSearch('');},[stage,currentLines]);

  function openOrigin(nextOriginId:string){setOriginId(nextOriginId);setServiceIndex(0);setError(null);setPickerOpen(Boolean(nextOriginId));}
  function closePicker(){setPickerOpen(false);setOriginId('');setSelectedUnits([]);setManualQuantity('');setSearch('');}
  async function confirmSelection(){
    if(!origin||!stage)return; let activeMeasurementId=measurementId;
    if(!activeMeasurementId&&draftMode){const measurementNumber=(draftHeader?.measurementNumber??'').trim(),competence=(draftHeader?.competence??'').trim();if(!measurementNumber||!competence){setError('Informe o número e a competência da medição.');return;}try{await operations.createMeasurement({contractId,competence,measurementNumber,dueDate:draftHeader?.dueDate||null,expectedPaymentDate:draftHeader?.expectedPaymentDate||null,paymentMethod:draftHeader?.paymentMethod||'PIX',originLabel:originLabel(origin),notes:draftHeader?.notes||null});const refreshed=await loadMeasurementParity(scope,contractId);const created=refreshed.measurements.find(item=>item.measurementNumber===measurementNumber&&item.status==='draft');if(!created)throw new Error('A medição foi criada, mas não pôde ser reaberta.');activeMeasurementId=created.id;setMeasurementId(created.id);setModel(refreshed);onDraftPersisted?.();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível criar a medição.');return;}}
    if(!activeMeasurementId){setError('Crie ou selecione uma medição em rascunho.');return;} if(effectiveQuantity<=0&&currentLines.length===0){setError(refs.length?'Selecione ao menos uma unidade.':'Informe a quantidade medida.');return;} if(effectiveQuantity>balance+0.0001){setError('A quantidade excede o saldo disponível.');return;}
    setSaving(true);setError(null);try{await replaceMeasurementParityStage(scope,{measurementId:activeMeasurementId,targetKind:stage.targetKind,targetId:stage.targetId,quantity:effectiveQuantity,references:refs.length?selectedUnits:[],originName:origin.name,legacyServiceId:stage.legacyServiceId});await reload();closePicker();onChanged();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível confirmar a seleção.');}finally{setSaving(false);}
  }
  function closeFlow(){onChanged();onClose();}

  if(loading&&!model)return <Dialog open variant="measurement-fullscreen" title="Medição" onClose={closeFlow} onBack={closeFlow}><LoadingState label="Carregando medição…"/></Dialog>;
  if(!model)return <Dialog open variant="measurement-fullscreen" title="Medição" onClose={closeFlow} onBack={closeFlow}><Feedback tone="danger" title="Não foi possível carregar" message={error??'Dados indisponíveis.'}/></Dialog>;
  const currentDraft=drafts.find(item=>item.id===measurementId);

  return <Dialog open variant="measurement-fullscreen" title="Medição" description="Selecione a origem e lance os serviços sem sair desta medição." onClose={closeFlow} onBack={closeFlow}>
    <div className="guided-measurement guided-measurement--parity approved-measurement-sheet measurement-hub">
      {error&&<Feedback tone="danger" title="Não foi possível continuar" message={error}/>} 
      <section className="approved-measurement-sheet__header-fields">
        <div><span>Nº da medição</span><strong>{draftHeader?.measurementNumber||currentDraft?.measurementNumber||'—'}</strong></div><div><span>Competência</span><strong>{draftHeader?.competence||currentDraft?.competence?.slice(0,7)||'—'}</strong></div><div><span>Vencimento previsto</span><strong>{draftHeader?.dueDate||'—'}</strong></div><div><span>Data prevista para pagamento</span><strong>{draftHeader?.expectedPaymentDate||'—'}</strong></div><div><span>Forma de pagamento</span><strong>{draftHeader?.paymentMethod||'PIX'}</strong></div><Button variant="secondary">▣ Observações</Button>
      </section>
      <section className="measurement-hub__financial"><div><span>Bruto da medição</span><strong>{currency.format(measurementGross)}</strong></div><div><span>INSS ({retentions.inss.toLocaleString('pt-BR',{maximumFractionDigits:2})}%)</span><strong>{currency.format(inssValue)}</strong></div><div><span>ISS ({retentions.iss.toLocaleString('pt-BR',{maximumFractionDigits:2})}%)</span><strong>{currency.format(issValue)}</strong></div><div><span>Retenção ({retentions.rt.toLocaleString('pt-BR',{maximumFractionDigits:2})}%)</span><strong>{currency.format(rtValue)}</strong></div><div className="is-net"><span>Líquido da medição</span><strong>{currency.format(measurementNet)}</strong></div></section>
      <section className="measurement-hub__origin-picker"><div><strong>Selecionar origem</strong><span>Escolha Torre 4, Torre 6 ou um aditivo.</span></div><Select label="Torre / Aditivo" value="" onChange={event=>openOrigin(event.target.value)} options={[{value:'',label:'Selecione uma torre ou aditivo…'},...model.origins.map(item=>({value:item.id,label:originLabel(item)}))]}/></section>
      <section className="measurement-hub__origins"><header><div><strong>Origens já adicionadas nesta medição</strong><span>Os valores abaixo compõem o bruto geral da medição.</span></div></header>{originRows.length===0?<div className="measurement-hub__empty">Nenhuma torre ou aditivo lançado ainda.</div>:<div className="measurement-hub__origin-list">{originRows.map(row=><button key={row.origin.id} type="button" onClick={()=>openOrigin(row.origin.id)}><span><strong>{originLabel(row.origin)}</strong><small>{row.serviceCount} serviço(s) lançado(s)</small></span><b>{currency.format(row.gross)}</b><em>Editar ›</em></button>)}</div>}</section>
      <footer className="approved-measurement-sheet__bottom-actions"><Button variant="secondary" onClick={closeFlow}>Cancelar medição</Button><div><Button variant="secondary" onClick={onChanged}>▣ Salvar rascunho</Button><Button onClick={closeFlow}>✓ Finalizar medição</Button></div></footer>
    </div>

    {pickerOpen&&origin&&stage&&<div className="guided-measurement-picker" role="dialog" aria-modal="true" aria-label="Selecionar serviço e unidades"><div className="guided-measurement-picker__panel">
      <header><div><small>{originLabel(origin)}</small><h3>Selecionar serviço e unidades</h3><p>Escolha o serviço, marque as unidades e confirme.</p></div><Button variant="secondary" size="sm" onClick={closePicker}>✕</Button></header>
      <div className="guided-measurement-picker__bar"><Select label="Serviço" value={String(serviceIndex)} onChange={event=>setServiceIndex(Number(event.target.value))} options={stages.map((item,index)=>({value:String(index),label:`${item.code?`${item.code} · `:''}${item.description}`}))}/>{refs.length>0?<><Input label="Pesquisar apartamento/unidade" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Ex.: 501"/><div><Button variant="secondary" onClick={()=>setSelectedUnits(available.slice(0,maxSelectable))}>Selecionar até {maxSelectable} disponível(is)</Button><Button variant="tertiary" onClick={()=>setSelectedUnits([])}>Limpar seleção</Button></div><p>Selecionadas: <strong>{selectedUnits.length}/{maxSelectable}</strong>.</p></>:<Input label="Quantidade nesta medição" value={manualQuantity} onChange={event=>setManualQuantity(event.target.value)} inputMode="decimal" placeholder="0,00"/>}</div>
      {refs.length>0&&<div className="guided-measurement-picker__list guided-measurement-picker__list--floors">{grouped.map(([level,references])=><section className="guided-measurement-floor" key={level}><header><strong>{referenceLevelLabel(level)}</strong><span>{references.filter(reference=>selectedUnits.includes(reference)).length}/{references.length} selecionado(s)</span></header><div className="guided-measurement-floor__units">{references.map(reference=><label key={reference} className={selectedUnits.includes(reference)?'is-selected':''}><input type="checkbox" checked={selectedUnits.includes(reference)} disabled={!selectedUnits.includes(reference)&&selectedUnits.length>=maxSelectable} onChange={()=>setSelectedUnits(current=>current.includes(reference)?current.filter(item=>item!==reference):(current.length<maxSelectable?[...current,reference]:current))}/><span>{reference.startsWith('TR-')?`Apto ${reference.slice(3)}`:`Apto ${reference}`}</span></label>)}</div></section>)}</div>}
      <footer><Button variant="secondary" onClick={closePicker}>Cancelar</Button><Button onClick={()=>void confirmSelection()} disabled={saving||(effectiveQuantity<=0&&currentLines.length===0)}>{saving?'Salvando…':'✓ Confirmar seleção'}</Button></footer>
    </div></div>}
  </Dialog>;
}