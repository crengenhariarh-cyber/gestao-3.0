import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { useEngineeringOperations } from './useEngineeringOperations';
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
  scope:{tenantId:string;companyId:string};
  contractId:string;
  initialOriginId?:string;
  initialOriginName?:string;
  draftHeader?:Record<string,string>|null;
  onDraftPersisted?:()=>void;
  onChanged:()=>void;
  onClose:()=>void;
}

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const qty=(value:number)=>Number.isInteger(value)?String(value):value.toLocaleString('pt-BR',{maximumFractionDigits:2});
const safeText=(value:unknown)=>typeof value==='string'?value:typeof value==='number'||typeof value==='boolean'?String(value):'';
const normalize=(value:unknown)=>safeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const referenceFloor=(reference:string)=>{const match=reference.match(/^(\d{1,2})\d{2}$/);return match?String(Number(match[1])):null;};
const referenceLevel=(reference:string)=>reference.startsWith('TR-')?'TR':referenceFloor(reference)??'OUTROS';
const referenceLevelLabel=(level:string)=>level==='TR'?'Térreo':level==='OUTROS'?'Outras unidades':`${level}º pavimento`;
const unitBased=(stage:MeasurementParityStage)=>/^(apto|apt|apartamento|apartamentos|un|und|unid|unidade|unidades)$/i.test(stage.unit.trim());

function originLabel(origin:MeasurementParityOrigin){
  if(origin.type==='addendum')return `Aditivo · ${origin.name}`;
  return origin.name;
}

function buildTowerReferences(model:MeasurementParityModel,origin:MeasurementParityOrigin):string[]{
  if(model.enterpriseType==='casas'&&model.houses.length)return Array.from(new Set(model.houses.map(value=>value.trim()).filter(Boolean)));
  const numericFloors=Math.max(0,Number(origin.floorCount||0));
  const levelCount=numericFloors+(origin.hasGround?1:0);
  const quantities=origin.services.filter(unitBased).map(service=>Number(service.contractedQuantity||0)).filter(value=>value>0);
  const perFloor=levelCount>0&&quantities.length?Math.max(1,Math.round(Math.max(...quantities)/levelCount)):8;
  const references:string[]=[];
  if(origin.hasGround)for(let unit=1;unit<=perFloor;unit++)references.push(`TR-${String(unit).padStart(2,'0')}`);
  for(let floor=1;floor<=numericFloors;floor++)for(let unit=1;unit<=perFloor;unit++)references.push(`${floor}${String(unit).padStart(2,'0')}`);
  return references;
}

function genericUnitReferences(stage:MeasurementParityStage):string[]{
  const total=Math.max(0,Math.floor(stage.contractedQuantity));
  if(!unitBased(stage)||total<=0||total>500)return [];
  return Array.from({length:total},(_,index)=>String(101+index));
}

function stageReferences(model:MeasurementParityModel,origin:MeasurementParityOrigin,stage:MeasurementParityStage):string[]{
  const base=origin.type==='tower'?buildTowerReferences(model,origin):genericUnitReferences(stage);
  if(stage.scopeUnits.length){
    const allowed=new Set(stage.scopeUnits.map(normalize));
    return base.filter(reference=>allowed.has(normalize(reference)));
  }
  if(stage.scopeFloors.length){
    const allowed=new Set(stage.scopeFloors.map(value=>String(Number(value))));
    return base.filter(reference=>{const floor=referenceFloor(reference);return floor!==null&&allowed.has(floor);});
  }
  if(stage.scopeActive&&stage.startFloor!==null){
    return base.filter(reference=>{const floor=referenceFloor(reference);return floor!==null&&Number(floor)>=Number(stage.startFloor);});
  }
  return base;
}

export function GuidedMeasurementFlow({scope,contractId,initialOriginId='',initialOriginName='',draftHeader=null,onDraftPersisted,onChanged,onClose}:Props){
  const [model,setModel]=useState<MeasurementParityModel|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [measurementId,setMeasurementId]=useState('');
  const [originId,setOriginId]=useState(initialOriginId);
  const [serviceIndex,setServiceIndex]=useState(0);
  const [,setServicePickerOpen]=useState(false);
  const [unitPickerOpen,setUnitPickerOpen]=useState(false);
  const [selectedUnits,setSelectedUnits]=useState<string[]>([]);
  const [search,setSearch]=useState('');
  const [serviceSearch,setServiceSearch]=useState('');
  const [typeFilter,setTypeFilter]=useState('');
  const [statusFilter,setStatusFilter]=useState('');
  const [manualQuantity,setManualQuantity]=useState('');
  const [,setFinished]=useState(false);
  const operations=useEngineeringOperations(scope);
  const draftMode=Boolean(draftHeader);

  const reload=useCallback(async()=>{
    setLoading(true);setError(null);
    try{const next=await loadMeasurementParity(scope,contractId);setModel(next);return next;}
    catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível carregar a medição.');return null;}
    finally{setLoading(false);}
  },[contractId,scope]);

  useEffect(()=>{void reload();},[reload]);
  const draftMeasurements=useMemo(()=>model?.measurements.filter(item=>item.status==='draft')??[],[model?.measurements]);
  useEffect(()=>{if(measurementId&&draftMeasurements.some(item=>item.id===measurementId))return;setMeasurementId(draftMeasurements[0]?.id??'');},[draftMeasurements,measurementId]);
  useEffect(()=>{if(initialOriginId&&model?.origins.some(item=>item.id===initialOriginId)){setOriginId(initialOriginId);return;}if(initialOriginName&&model){const match=model.origins.find(item=>normalize(item.name)===normalize(initialOriginName.replace(/^Aditivo\s*·\s*/i,'')));if(match)setOriginId(match.id);}},[initialOriginId,initialOriginName,model]);
  useEffect(()=>{if(originId&&(measurementId||draftMode)&&model?.origins.some(item=>item.id===originId))setServicePickerOpen(false);},[measurementId,originId,draftMode,model?.origins]);

  const origin=useMemo(()=>model?.origins.find(item=>item.id===originId)??null,[model?.origins,originId]);
  const stages=useMemo(()=>origin?.services??[],[origin]);
  const stage=stages[serviceIndex];

  const allStageReferences=useMemo(()=>model&&origin&&stage?stageReferences(model,origin,stage):[],[model,origin,stage]);
  const targetLines=useMemo(()=>model&&stage?model.lines.filter(line=>line.targetKind===stage.targetKind&&line.targetId===stage.targetId):[],[model,stage]);
  const currentLines=useMemo(()=>targetLines.filter(line=>line.measurementId===measurementId),[targetLines,measurementId]);
  const previousLines=useMemo(()=>targetLines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)),[targetLines,measurementId]);
  const measuredBefore=previousLines.reduce((sum,line)=>sum+line.measuredQuantity,0);
  const currentQuantity=currentLines.reduce((sum,line)=>sum+line.measuredQuantity,0);
  const balance=Math.max(0,(stage?.contractedQuantity??0)-measuredBefore);
  const blockedReferences=useMemo(()=>new Set(previousLines.map(line=>line.reference).filter((value):value is string=>Boolean(value))),[previousLines]);
  const availableReferences=useMemo(()=>allStageReferences.filter(reference=>!blockedReferences.has(reference)),[allStageReferences,blockedReferences]);
  const referenceMode=availableReferences.length>0;
  const maxSelectable=Math.max(0,Math.min(availableReferences.length,Math.floor(balance)));

  useEffect(()=>{
    if(!stage){setSelectedUnits([]);setManualQuantity('');return;}
    const refs=currentLines.map(line=>line.reference).filter((value):value is string=>Boolean(value));
    setSelectedUnits(refs);
    setManualQuantity(refs.length?'':currentQuantity>0?String(currentQuantity).replace('.',','):'');
    setSearch('');
  },[stage,currentLines,currentQuantity]);

  const visibleReferences=availableReferences.filter(reference=>!normalize(search)||normalize(reference).includes(normalize(search)));
  const groupedVisibleReferences=useMemo(()=>{const groups=new Map<string,string[]>();for(const reference of visibleReferences){const level=referenceLevel(reference);groups.set(level,[...(groups.get(level)??[]),reference]);}const rank=(level:string)=>level==='TR'?-1:level==='OUTROS'?9999:Number(level);return [...groups.entries()].sort((a,b)=>rank(a[0])-rank(b[0]));},[visibleReferences]);
  const effectiveQuantity=referenceMode?selectedUnits.length:Number(manualQuantity.replace(',','.'))||0;
  const filteredServiceIndexes=useMemo(()=>stages.map((item,index)=>({item,index})).filter(({item})=>!normalize(serviceSearch)||normalize(`${item.code} ${item.description}`).includes(normalize(serviceSearch))),[stages,serviceSearch]);
  const approvedRows=useMemo(()=>{
    if(!model||!origin)return filteredServiceIndexes;
    return filteredServiceIndexes.filter(({item})=>{
      const refs=stageReferences(model,origin,item);
      const lines=model.lines.filter(line=>line.targetKind===item.targetKind&&line.targetId===item.targetId);
      const previous=lines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)).reduce((sum,line)=>sum+line.measuredQuantity,0);
      const remaining=Math.max(0,item.contractedQuantity-previous);
      if(typeFilter==='unit'&&refs.length===0)return false;
      if(typeFilter==='global'&&refs.length>0)return false;
      if(statusFilter==='balance'&&remaining<=0)return false;
      if(statusFilter==='done'&&remaining>0)return false;
      return true;
    });
  },[filteredServiceIndexes,model,origin,measurementId,typeFilter,statusFilter]);
  const summary=useMemo(()=>{
    if(!model||!origin)return {contracted:0,measured:0,balance:0,measuredPct:0,balancePct:0};
    let contracted=0,measured=0;
    for(const item of origin.services){
      contracted+=item.contractedQuantity*item.unitPrice;
      const lines=model.lines.filter(line=>line.targetKind===item.targetKind&&line.targetId===item.targetId&&line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus));
      measured+=lines.reduce((sum,line)=>sum+line.measuredQuantity,0)*item.unitPrice;
    }
    const balance=Math.max(0,contracted-measured);
    return {contracted,measured,balance,measuredPct:contracted?measured/contracted*100:0,balancePct:contracted?balance/contracted*100:0};
  },[model,origin,measurementId]);

  function resetStage(index:number){setServiceIndex(index);setSelectedUnits([]);setManualQuantity('');setSearch('');setError(null);}
  function chooseService(index:number){
    resetStage(index);setServicePickerOpen(false);setFinished(false);
    const selected=stages[index];
    if(model&&origin&&selected&&stageReferences(model,origin,selected).length>0)setUnitPickerOpen(true);
    else setUnitPickerOpen(false);
  }
  function toggleReference(reference:string){setSelectedUnits(current=>current.includes(reference)?current.filter(item=>item!==reference):(current.length<maxSelectable?[...current,reference]:current));}
  function selectAvailable(){setSelectedUnits(availableReferences.slice(0,maxSelectable));}

  async function saveCurrent(){
    let activeMeasurementId=measurementId;
    if(!origin||!stage){setError('Selecione uma origem e um serviço.');return;}
    if(!activeMeasurementId&&draftMode){
      const measurementNumber=(draftHeader?.measurementNumber??'').trim();
      if(!measurementNumber){setError('Volte em Dados e informe o Nº da medição antes de salvar o primeiro serviço.');return;}
      const competence=(draftHeader?.competence??'').trim();
      if(!competence){setError('Volte em Dados e informe a competência antes de salvar o primeiro serviço.');return;}
      try{
        await operations.createMeasurement({contractId,competence,measurementNumber,dueDate:draftHeader?.dueDate||null,expectedPaymentDate:draftHeader?.expectedPaymentDate||null,paymentMethod:draftHeader?.paymentMethod||'PIX',originLabel:originLabel(origin),notes:draftHeader?.notes||null});
        const refreshed=await loadMeasurementParity(scope,contractId);
        const created=refreshed.measurements.find(item=>item.measurementNumber===measurementNumber&&item.status==='draft');
        if(!created)throw new Error('A medição foi criada, mas não pôde ser reaberta para lançar os serviços.');
        activeMeasurementId=created.id;setMeasurementId(created.id);setModel(refreshed);onDraftPersisted?.();onChanged();
      }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível criar a medição.');return;}
    }
    if(!activeMeasurementId){setError('Crie ou selecione uma medição em rascunho antes de lançar os serviços.');return;}
    if(effectiveQuantity<=0&&currentLines.length===0){setError(referenceMode?'Selecione ao menos uma unidade.':'Informe a quantidade medida.');return;}
    if(effectiveQuantity>balance+0.0001){setError(`A quantidade excede o saldo disponível de ${qty(balance)}.`);return;}
    setSaving(true);setError(null);
    try{
      await replaceMeasurementParityStage(scope,{measurementId:activeMeasurementId,targetKind:stage.targetKind,targetId:stage.targetId,quantity:effectiveQuantity,references:referenceMode?selectedUnits:[],originName:origin.name,legacyServiceId:stage.legacyServiceId});
      const nextModel=await reload();onChanged();setUnitPickerOpen(false);
      const nextOrigin=nextModel?.origins.find(item=>item.id===origin.id);
      const nextStages=nextOrigin?.services??stages;
      const nextIndex=serviceIndex+1;
      if(nextIndex<nextStages.length){
        setServiceIndex(nextIndex);setSelectedUnits([]);setManualQuantity('');setSearch('');
        const nextStage=nextStages[nextIndex];
        if(nextModel&&nextOrigin&&nextStage&&stageReferences(nextModel,nextOrigin,nextStage).length>0)setUnitPickerOpen(true);
      }else setFinished(true);
    }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar este serviço.');}
    finally{setSaving(false);}
  }

  if(loading&&!model)return <Dialog open variant="measurement-fullscreen" title="Lançar medição" onClose={onClose} onBack={onClose}><LoadingState label="Carregando medição…"/></Dialog>;
  if(!model)return <Dialog open variant="measurement-fullscreen" title="Lançar medição" onClose={onClose} onBack={onClose}><Feedback tone="danger" title="Não foi possível carregar" message={error??'Dados indisponíveis.'}/></Dialog>;


  return <Dialog open variant="measurement-fullscreen" title={origin?`Medição - ${originLabel(origin)}`:'Medição'} description={origin?'Elabore a medição dos serviços desta origem.':'Selecione a origem da medição.'} onClose={onClose} onBack={onClose}>
    <div className="guided-measurement guided-measurement--parity approved-measurement-sheet">
      {error&&<Feedback tone="danger" title="Não foi possível continuar" message={error}/>} 
      {!measurementId&&!draftMode&&<div className="guided-measurement__empty"><strong>Crie a competência primeiro</strong><span>Use “Nova medição” antes de lançar os serviços.</span></div>}
      {(measurementId||draftMode)&&!originId&&<div className="guided-measurement__empty"><strong>Selecione a origem</strong><span>Escolha a torre ou aditivo na etapa anterior.</span></div>}
      {(measurementId||draftMode)&&originId&&stages.length===0&&<div className="guided-measurement__empty"><strong>Nenhum serviço nesta origem</strong><span>Esta origem não possui serviços disponíveis para medição.</span></div>}
      {(measurementId||draftMode)&&origin&&stages.length>0&&<>
        <section className="approved-measurement-sheet__header-fields">
          <div><span>Nº da medição</span><strong>{draftHeader?.measurementNumber||draftMeasurements.find(item=>item.id===measurementId)?.measurementNumber||'—'}</strong></div>
          <div><span>Competência</span><strong>{draftHeader?.competence||draftMeasurements.find(item=>item.id===measurementId)?.competence?.slice(0,7)||'—'}</strong></div>
          <div><span>Vencimento previsto</span><strong>{draftHeader?.dueDate||'—'}</strong></div>
          <div><span>Data prevista para pagamento</span><strong>{draftHeader?.expectedPaymentDate||'—'}</strong></div>
          <div><span>Forma de pagamento</span><strong>{draftHeader?.paymentMethod||'PIX'}</strong></div>
          <Button variant="secondary">▣ Observações</Button>
        </section>
        <section className="approved-measurement-sheet__summary">
          <div className="approved-measurement-sheet__origin"><span className="approved-measurement-sheet__building">▦</span><div><h3>{originLabel(origin)}</h3><p>{stages.length} serviço(s) nesta origem</p></div></div>
          <div className="approved-measurement-sheet__summary-card"><span>Valor contratado</span><strong>{currency.format(summary.contracted)}</strong></div>
          <div className="approved-measurement-sheet__summary-card"><span>Valor medido</span><strong>{currency.format(summary.measured)}</strong><b>{summary.measuredPct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</b></div>
          <div className="approved-measurement-sheet__summary-card"><span>Saldo a medir</span><strong>{currency.format(summary.balance)}</strong><b>{summary.balancePct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</b></div>
        </section>
        <section className="approved-measurement-sheet__toolbar">
          <Input label="Pesquisar serviço" value={serviceSearch} onChange={event=>setServiceSearch(event.target.value)} placeholder="Pesquisar serviço (código ou descrição)..."/>
          <Select label="Tipo" value={typeFilter} onChange={event=>setTypeFilter(event.target.value)} options={[{value:'',label:'Todos os tipos'},{value:'global',label:'Global'},{value:'unit',label:'Por unidade'}]}/>
          <Select label="Status" value={statusFilter} onChange={event=>setStatusFilter(event.target.value)} options={[{value:'',label:'Todos os status'},{value:'balance',label:'Com saldo'},{value:'done',label:'Concluído'}]}/>
          <Button variant="secondary" onClick={()=>{setServiceSearch('');setTypeFilter('');setStatusFilter('');}}>Limpar filtros</Button>
        </section>
        <section className="approved-measurement-sheet__table-card">
          <div className="approved-measurement-sheet__table-wrap"><table className="approved-measurement-sheet__table"><thead><tr><th>#</th><th>Código</th><th>Descrição do serviço</th><th>Referência</th><th>Contratado</th><th>Medido</th><th>Saldo</th><th>Tipo</th><th>Valor unitário</th><th>Nesta medição</th><th>Total</th></tr></thead><tbody>{approvedRows.map(({item,index},rowPosition)=>{
            const lines=model.lines.filter(line=>line.targetKind===item.targetKind&&line.targetId===item.targetId);
            const previous=lines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)).reduce((sum,line)=>sum+line.measuredQuantity,0);
            const current=lines.filter(line=>line.measurementId===measurementId).reduce((sum,line)=>sum+line.measuredQuantity,0);
            const remaining=Math.max(0,item.contractedQuantity-previous);
            const refs=stageReferences(model,origin,item);
            const currentInput=index===serviceIndex&&!refs.length?manualQuantity:(current>0?String(current).replace('.',','):'');
            return <tr key={`${item.targetKind}:${item.targetId}`}><td>{rowPosition+1}</td><td><strong>{item.code||`#${index+1}`}</strong></td><td>{item.description}</td><td><span className="approved-measurement-sheet__unit">{item.unit}</span>{refs.length>0&&<Button size="sm" onClick={()=>chooseService(index)}>Selecionar apartamentos/unidades</Button>}</td><td>{qty(item.contractedQuantity)}</td><td>{qty(previous)}</td><td>{qty(remaining)}</td><td><span className={`approved-measurement-sheet__type ${refs.length?'is-unit':'is-global'}`}>{refs.length?'Por unidade':'Global'}</span></td><td>{currency.format(item.unitPrice)}</td><td><input className="approved-measurement-sheet__quantity" inputMode="decimal" value={currentInput} readOnly={refs.length>0} onFocus={()=>{if(!refs.length)resetStage(index);}} onChange={event=>{resetStage(index);setManualQuantity(event.target.value);}} placeholder="0,00"/></td><td>{currency.format(current*item.unitPrice)}</td></tr>;
          })}</tbody></table></div>
          
        </section>
        <footer className="approved-measurement-sheet__bottom-actions"><Button variant="secondary" onClick={onClose}>Cancelar medição</Button><div><Button variant="secondary" disabled={saving||effectiveQuantity<=0} onClick={()=>void saveCurrent()}>{saving?'Salvando…':'▣ Salvar rascunho'}</Button><Button onClick={onClose}>✓ Finalizar medição</Button></div></footer>
      </>}
    </div>

    {unitPickerOpen&&stage&&origin&&<div className="guided-measurement-picker" role="dialog" aria-modal="true" aria-label="Selecionar apartamentos/unidades"><div className="guided-measurement-picker__panel">
      <header><div><small>{originLabel(origin)} · Serviço {serviceIndex+1}/{stages.length}</small><h3>Selecionar apartamentos/unidades</h3><p>{stage.description}</p></div><Button variant="secondary" size="sm" onClick={()=>setUnitPickerOpen(false)}>✕</Button></header>
      {stage.scopeActive&&<div className="guided-measurement__scope-note guided-measurement__scope-note--picker">Escopo deste serviço: {stage.scopeFloors.length?`somente pavimentos ${stage.scopeFloors.join(', ')}`:stage.startFloor!==null?`somente ${stage.startFloor}º em diante`:'somente unidades definidas'}.</div>}
      <div className="guided-measurement-picker__bar"><Input label="Pesquisar apartamento/unidade" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Ex.: 501"/><div><Button variant="secondary" onClick={selectAvailable}>Selecionar até {maxSelectable} disponível(is)</Button><Button variant="tertiary" onClick={()=>setSelectedUnits([])}>Limpar seleção</Button></div><p>Selecione no máximo <strong>{maxSelectable}</strong> unidade(s). Selecionadas: <strong>{selectedUnits.length}/{maxSelectable}</strong>.</p></div>
      <div className="guided-measurement-picker__list guided-measurement-picker__list--floors">{groupedVisibleReferences.map(([level,references])=><section className="guided-measurement-floor" key={level}><header><strong>{referenceLevelLabel(level)}</strong><span>{references.filter(reference=>selectedUnits.includes(reference)).length}/{references.length} selecionado(s)</span></header><div className="guided-measurement-floor__units">{references.map(reference=><label key={reference} className={selectedUnits.includes(reference)?'is-selected':''}><input type="checkbox" checked={selectedUnits.includes(reference)} disabled={!selectedUnits.includes(reference)&&selectedUnits.length>=maxSelectable} onChange={()=>toggleReference(reference)}/><span>{reference.startsWith('TR-')?`Apto ${reference.slice(3)}`:`Apto ${reference}`}</span></label>)}</div></section>)}</div>
      <footer><Button onClick={()=>void saveCurrent()} disabled={saving||(selectedUnits.length===0&&currentLines.length===0)}>{saving?'Salvando…':selectedUnits.length===0&&currentLines.length>0?'Remover seleção salva':'Confirmar e próximo serviço →'}</Button></footer>
    </div></div>}
  </Dialog>;
}
