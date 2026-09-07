import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import {
  loadMeasurementParity,
  replaceMeasurementParityStage,
  type MeasurementParityModel,
  type MeasurementParityOrigin,
  type MeasurementParityStage,
} from '../infrastructure/LegacyMeasurementParityRepository';
import './guided-measurement-flow.css';

interface Props {
  scope:{tenantId:string;companyId:string};
  contractId:string;
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

export function GuidedMeasurementFlow({scope,contractId,onChanged,onClose}:Props){
  const [model,setModel]=useState<MeasurementParityModel|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [measurementId,setMeasurementId]=useState('');
  const [originId,setOriginId]=useState('');
  const [serviceIndex,setServiceIndex]=useState(0);
  const [servicePickerOpen,setServicePickerOpen]=useState(false);
  const [unitPickerOpen,setUnitPickerOpen]=useState(false);
  const [selectedUnits,setSelectedUnits]=useState<string[]>([]);
  const [search,setSearch]=useState('');
  const [serviceSearch,setServiceSearch]=useState('');
  const [manualQuantity,setManualQuantity]=useState('');
  const [finished,setFinished]=useState(false);

  const reload=useCallback(async()=>{
    setLoading(true);setError(null);
    try{const next=await loadMeasurementParity(scope,contractId);setModel(next);return next;}
    catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível carregar a medição.');return null;}
    finally{setLoading(false);}
  },[contractId,scope]);

  useEffect(()=>{void reload();},[reload]);
  const draftMeasurements=useMemo(()=>model?.measurements.filter(item=>item.status==='draft')??[],[model?.measurements]);
  useEffect(()=>{if(measurementId&&draftMeasurements.some(item=>item.id===measurementId))return;setMeasurementId(draftMeasurements[0]?.id??'');},[draftMeasurements,measurementId]);

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

  function resetStage(index:number){setServiceIndex(index);setSelectedUnits([]);setManualQuantity('');setSearch('');setError(null);}
  function changeOrigin(value:string){
    setOriginId(value);resetStage(0);setFinished(false);setUnitPickerOpen(false);setServiceSearch('');
    setServicePickerOpen(Boolean(value&&measurementId));
  }
  function chooseService(index:number){
    resetStage(index);setServicePickerOpen(false);setFinished(false);
    const selected=stages[index];
    if(model&&origin&&selected&&stageReferences(model,origin,selected).length>0)setUnitPickerOpen(true);
    else setUnitPickerOpen(false);
  }
  function toggleReference(reference:string){setSelectedUnits(current=>current.includes(reference)?current.filter(item=>item!==reference):(current.length<maxSelectable?[...current,reference]:current));}
  function selectAvailable(){setSelectedUnits(availableReferences.slice(0,maxSelectable));}

  async function saveCurrent(){
    if(!measurementId){setError('Crie ou selecione uma medição em rascunho antes de lançar os serviços.');return;}
    if(!origin||!stage){setError('Selecione uma origem e um serviço.');return;}
    if(effectiveQuantity<=0){setError(referenceMode?'Selecione ao menos uma unidade.':'Informe a quantidade medida.');return;}
    if(effectiveQuantity>balance+0.0001){setError(`A quantidade excede o saldo disponível de ${qty(balance)}.`);return;}
    setSaving(true);setError(null);
    try{
      await replaceMeasurementParityStage(scope,{measurementId,targetKind:stage.targetKind,targetId:stage.targetId,quantity:effectiveQuantity,references:referenceMode?selectedUnits:[],originName:origin.name,legacyServiceId:stage.legacyServiceId});
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

  const measurementOptions=[{value:'',label:'Selecione…'},...draftMeasurements.map(item=>({value:item.id,label:`${item.measurementNumber?`Medição ${item.measurementNumber} · `:''}${item.competence.slice(0,7)} · rascunho`}))];
  const originOptions=[{value:'',label:'Selecione…'},...model.origins.map(item=>({value:item.id,label:originLabel(item)}))];

  return <Dialog open variant="measurement-fullscreen" title="Lançar medição" description="Fluxo sequencial por origem, serviço e unidade" onClose={onClose} onBack={onClose}>
    <div className="guided-measurement guided-measurement--parity">
      {error&&<Feedback tone="danger" title="Não foi possível continuar" message={error}/>} 
      <div className="guided-measurement__selectors">
        <Select label="Medição" value={measurementId} onChange={event=>{setMeasurementId(event.target.value);setOriginId('');resetStage(0);setFinished(false);setServicePickerOpen(false);setUnitPickerOpen(false);}} options={measurementOptions}/>
        <Select label="Torre / aditivo / provisório" value={originId} onChange={event=>changeOrigin(event.target.value)} options={originOptions}/>
      </div>

      {!measurementId&&<div className="guided-measurement__empty"><strong>Crie a competência primeiro</strong><span>Use “Nova medição” e depois selecione a origem.</span></div>}
      {measurementId&&!originId&&<div className="guided-measurement__empty"><strong>Selecione a origem</strong><span>Escolha Torre 4, Torre 6, provisório ou aditivo. Os serviços daquela origem abrirão em seguida.</span></div>}
      {measurementId&&originId&&stages.length===0&&<div className="guided-measurement__empty"><strong>Nenhum serviço nesta origem</strong><span>Esta origem não possui serviços disponíveis para medição.</span></div>}

      {measurementId&&origin&&stage&&!finished&&<>
        <div className="guided-measurement__progress"><span>Serviço {serviceIndex+1} de {stages.length}</span><progress max={stages.length} value={serviceIndex+1}/></div>
        <section className="guided-measurement__service">
          <header><div><small>{originLabel(origin)}</small><h3>{stage.code?`${stage.code} · `:''}{stage.description}</h3></div><span>{stage.unit}</span></header>
          {stage.scopeActive&&<div className="guided-measurement__scope-note">Escopo deste serviço: {stage.scopeFloors.length?`pavimentos ${stage.scopeFloors.join(', ')}`:stage.startFloor!==null?`${stage.startFloor}º em diante`:'restrito às unidades definidas'}.</div>}
          <div className="guided-measurement__metrics"><div><span>Contratado</span><strong>{qty(stage.contractedQuantity)}</strong></div><div><span>Medido</span><strong>{qty(measuredBefore)}</strong></div><div><span>Saldo</span><strong>{qty(balance)}</strong></div><div><span>Valor unit.</span><strong>{currency.format(stage.unitPrice)}</strong></div></div>
          {referenceMode?<Button className="guided-measurement__units-button" variant="secondary" onClick={()=>setUnitPickerOpen(true)}>Selecionar apartamentos/unidades <b>{selectedUnits.length?`${selectedUnits.length} selecionada(s)`:''}</b></Button>:<Input label="Nesta medição / quantidade" inputMode="decimal" value={manualQuantity} onChange={event=>setManualQuantity(event.target.value)} placeholder={`Máximo ${qty(balance)}`}/>} 
          <div className="guided-measurement__total"><span>Nesta medição</span><strong>{qty(effectiveQuantity)} {stage.unit} · {currency.format(effectiveQuantity*stage.unitPrice)}</strong></div>
          {currentQuantity>0&&<small className="guided-measurement__saved-note">Já existem {qty(currentQuantity)} {stage.unit} salvos nesta medição. Salvar novamente substitui somente este serviço.</small>}
        </section>
        <div className="guided-measurement__actions"><Button variant="secondary" disabled={saving} onClick={()=>setServicePickerOpen(true)}>Serviços</Button><Button onClick={()=>void saveCurrent()} disabled={saving}>{saving?'Salvando…':'Salvar e próximo →'}</Button></div>
      </>}

      {finished&&<div className="guided-measurement__complete"><strong>Origem concluída</strong><span>Todos os serviços de {origin?originLabel(origin):'esta origem'} foram percorridos. Selecione outra origem ou conclua a medição.</span><Button onClick={onClose}>Concluir</Button></div>}
    </div>

    {servicePickerOpen&&origin&&<div className="guided-measurement-picker" role="dialog" aria-modal="true" aria-label="Selecionar serviço"><div className="guided-measurement-picker__panel guided-measurement-picker__panel--services">
      <header><div><small>{originLabel(origin)}</small><h3>Selecionar serviço</h3><p>{stages.length} serviço(s) desta origem</p></div><Button variant="secondary" size="sm" onClick={()=>setServicePickerOpen(false)}>✕</Button></header>
      <div className="guided-measurement-picker__bar"><Input label="Pesquisar serviço" value={serviceSearch} onChange={event=>setServiceSearch(event.target.value)} placeholder="Código ou descrição"/></div>
      <div className="guided-measurement-service-list">{filteredServiceIndexes.map(({item,index})=>{
        const lines=model.lines.filter(line=>line.targetKind===item.targetKind&&line.targetId===item.targetId);
        const previous=lines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)).reduce((sum,line)=>sum+line.measuredQuantity,0);
        const current=lines.filter(line=>line.measurementId===measurementId).reduce((sum,line)=>sum+line.measuredQuantity,0);
        const remaining=Math.max(0,item.contractedQuantity-previous);
        return <button key={`${item.targetKind}:${item.targetId}`} type="button" className={`guided-measurement-service-row ${index===serviceIndex?'is-current':''}`} onClick={()=>chooseService(index)}><span><small>{item.code||`#${index+1}`}</small><strong>{item.description}</strong></span><span className="guided-measurement-service-row__numbers"><b>{qty(remaining)}</b><small>saldo{current>0?` · ${qty(current)} nesta medição`:''}</small></span><span>›</span></button>;
      })}</div>
      <footer><Button variant="secondary" onClick={()=>setServicePickerOpen(false)}>Fechar</Button></footer>
    </div></div>}

    {unitPickerOpen&&stage&&origin&&<div className="guided-measurement-picker" role="dialog" aria-modal="true" aria-label="Selecionar apartamentos/unidades"><div className="guided-measurement-picker__panel">
      <header><div><small>{originLabel(origin)} · Serviço {serviceIndex+1}/{stages.length}</small><h3>Selecionar apartamentos/unidades</h3><p>{stage.description}</p></div><Button variant="secondary" size="sm" onClick={()=>setUnitPickerOpen(false)}>✕</Button></header>
      {stage.scopeActive&&<div className="guided-measurement__scope-note guided-measurement__scope-note--picker">Escopo deste serviço: {stage.scopeFloors.length?`somente pavimentos ${stage.scopeFloors.join(', ')}`:stage.startFloor!==null?`somente ${stage.startFloor}º em diante`:'somente unidades definidas'}.</div>}
      <div className="guided-measurement-picker__bar"><Input label="Pesquisar apartamento/unidade" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Ex.: 501"/><div><Button variant="secondary" onClick={selectAvailable}>Selecionar até {maxSelectable} disponível(is)</Button><Button variant="tertiary" onClick={()=>setSelectedUnits([])}>Limpar seleção</Button></div><p>Selecione no máximo <strong>{maxSelectable}</strong> unidade(s). Selecionadas: <strong>{selectedUnits.length}/{maxSelectable}</strong>.</p></div>
      <div className="guided-measurement-picker__list guided-measurement-picker__list--floors">{groupedVisibleReferences.map(([level,references])=><section className="guided-measurement-floor" key={level}><header><strong>{referenceLevelLabel(level)}</strong><span>{references.filter(reference=>selectedUnits.includes(reference)).length}/{references.length} selecionado(s)</span></header><div className="guided-measurement-floor__units">{references.map(reference=><label key={reference} className={selectedUnits.includes(reference)?'is-selected':''}><input type="checkbox" checked={selectedUnits.includes(reference)} disabled={!selectedUnits.includes(reference)&&selectedUnits.length>=maxSelectable} onChange={()=>toggleReference(reference)}/><span>{reference.startsWith('TR-')?`Apto ${reference.slice(3)}`:`Apto ${reference}`}</span></label>)}</div></section>)}</div>
      <footer><Button onClick={()=>void saveCurrent()} disabled={saving||selectedUnits.length===0}>{saving?'Salvando…':'Confirmar e próximo serviço →'}</Button></footer>
    </div></div>}
  </Dialog>;
}
