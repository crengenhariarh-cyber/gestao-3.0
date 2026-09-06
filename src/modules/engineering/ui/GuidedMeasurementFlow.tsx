import { useEffect, useMemo, useState } from 'react';
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
const normalize=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const referenceFloor=(reference:string)=>{const match=reference.match(/^(\d{1,2})\d{2}$/);return match?String(Number(match[1])):null;};

function originLabel(origin:MeasurementParityOrigin){
  if(origin.type==='addendum')return `Aditivo · ${origin.name}`;
  if(origin.type==='provisional')return origin.name;
  return origin.name;
}

function buildOriginReferences(model:MeasurementParityModel,origin:MeasurementParityOrigin):string[]{
  if(model.enterpriseType==='casas'&&model.houses.length)return Array.from(new Set(model.houses.map(value=>String(value).trim()).filter(Boolean)));
  if(origin.type!=='tower')return [];
  const floors=Math.max(0,Number(origin.floorCount||0)+(origin.hasGround?1:0));
  const quantities=origin.services.map(service=>Number(service.contractedQuantity||0)).filter(value=>value>0);
  const perFloor=floors>0&&quantities.length?Math.max(1,Math.round(Math.max(...quantities)/floors)):8;
  const references:string[]=[];
  for(let floor=1;floor<=floors;floor++){
    for(let unit=1;unit<=perFloor;unit++)references.push(`${floor}${String(unit).padStart(2,'0')}`);
  }
  return references;
}

function scopedReferences(allReferences:readonly string[],stage:MeasurementParityStage):string[]{
  if(stage.scopeUnits.length){
    const allowed=new Set(stage.scopeUnits.map(normalize));
    return allReferences.filter(reference=>allowed.has(normalize(reference)));
  }
  if(stage.scopeFloors.length){
    const allowed=new Set(stage.scopeFloors.map(value=>String(Number(value))));
    return allReferences.filter(reference=>{const floor=referenceFloor(reference);return floor!==null&&allowed.has(floor);});
  }
  if(stage.scopeActive&&stage.startFloor!==null){
    return allReferences.filter(reference=>{const floor=referenceFloor(reference);return floor!==null&&Number(floor)>=Number(stage.startFloor);});
  }
  return [...allReferences];
}

export function GuidedMeasurementFlow({scope,contractId,onChanged,onClose}:Props){
  const [model,setModel]=useState<MeasurementParityModel|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [measurementId,setMeasurementId]=useState('');
  const [originId,setOriginId]=useState('');
  const [serviceIndex,setServiceIndex]=useState(0);
  const [pickerOpen,setPickerOpen]=useState(false);
  const [selectedUnits,setSelectedUnits]=useState<string[]>([]);
  const [search,setSearch]=useState('');
  const [manualQuantity,setManualQuantity]=useState('');
  const [finished,setFinished]=useState(false);
  const [autoOpenNext,setAutoOpenNext]=useState(false);

  async function reload(){
    setLoading(true);
    setError(null);
    try{
      const next=await loadMeasurementParity(scope,contractId);
      setModel(next);
      if(!measurementId){
        const draft=next.measurements.find(item=>item.status==='draft');
        setMeasurementId(draft?.id??'');
      }
      if(!originId&&next.origins.length)setOriginId(next.origins[0]?.id??'');
      return next;
    }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível carregar a medição.');return null;}
    finally{setLoading(false);}
  }

  useEffect(()=>{void reload();},[contractId,scope.tenantId,scope.companyId]);

  const draftMeasurements=useMemo(()=>model?.measurements.filter(item=>item.status==='draft')??[],[model?.measurements]);
  const origin=useMemo(()=>model?.origins.find(item=>item.id===originId)??null,[model?.origins,originId]);
  const stages=origin?.services??[];
  const stage=stages[serviceIndex];

  useEffect(()=>{
    if(originId&&model?.origins.some(item=>item.id===originId))return;
    setOriginId(model?.origins[0]?.id??'');
    setServiceIndex(0);
    setFinished(false);
  },[model?.origins,originId]);

  useEffect(()=>{
    if(serviceIndex<stages.length)return;
    setServiceIndex(Math.max(0,stages.length-1));
  },[serviceIndex,stages.length]);

  const allOriginReferences=useMemo(()=>model&&origin?buildOriginReferences(model,origin):[],[model,origin]);
  const stageReferences=useMemo(()=>stage?scopedReferences(allOriginReferences,stage):[],[allOriginReferences,stage]);
  const targetLines=useMemo(()=>model&&stage?model.lines.filter(line=>line.targetKind===stage.targetKind&&line.targetId===stage.targetId):[],[model,stage]);
  const currentLines=useMemo(()=>targetLines.filter(line=>line.measurementId===measurementId),[targetLines,measurementId]);
  const previousLines=useMemo(()=>targetLines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)),[targetLines,measurementId]);
  const measuredBefore=previousLines.reduce((sum,line)=>sum+line.measuredQuantity,0);
  const currentQuantity=currentLines.reduce((sum,line)=>sum+line.measuredQuantity,0);
  const balance=Math.max(0,(stage?.contractedQuantity??0)-measuredBefore);
  const blockedReferences=useMemo(()=>new Set(previousLines.map(line=>line.reference).filter((value):value is string=>Boolean(value))),[previousLines]);
  const availableReferences=useMemo(()=>stageReferences.filter(reference=>!blockedReferences.has(reference)),[stageReferences,blockedReferences]);
  const referenceMode=availableReferences.length>0;
  const maxSelectable=Math.max(0,Math.min(availableReferences.length,Math.floor(balance)));

  useEffect(()=>{
    if(!stage){setSelectedUnits([]);setManualQuantity('');return;}
    const currentReferences=currentLines.map(line=>line.reference).filter((value):value is string=>Boolean(value));
    setSelectedUnits(currentReferences);
    setManualQuantity(currentReferences.length?'':currentQuantity>0?String(currentQuantity).replace('.',','):'');
    setSearch('');
    if(autoOpenNext&&availableReferences.length>0){setPickerOpen(true);setAutoOpenNext(false);}
  },[stage?.legacyServiceId,measurementId,currentQuantity,autoOpenNext]);

  const normalizedSearch=normalize(search);
  const visibleReferences=availableReferences.filter(reference=>!normalizedSearch||normalize(reference).includes(normalizedSearch));
  const effectiveQuantity=referenceMode?selectedUnits.length:Number(manualQuantity.replace(',','.'))||0;

  function changeOrigin(value:string){
    setOriginId(value);setServiceIndex(0);setFinished(false);setPickerOpen(false);setSelectedUnits([]);setManualQuantity('');setSearch('');setError(null);
  }
  function moveTo(index:number){setServiceIndex(index);setPickerOpen(false);setSelectedUnits([]);setManualQuantity('');setSearch('');setError(null);}
  function toggleReference(reference:string){
    setSelectedUnits(current=>current.includes(reference)?current.filter(item=>item!==reference):(current.length<maxSelectable?[...current,reference]:current));
  }
  function selectAvailable(){setSelectedUnits(availableReferences.slice(0,maxSelectable));}

  async function saveCurrent(){
    if(!measurementId){setError('Crie ou selecione uma medição em rascunho antes de lançar os serviços.');return;}
    if(!origin||!stage){setError('Selecione uma origem com serviços disponíveis.');return;}
    if(effectiveQuantity<=0){setError(referenceMode?'Selecione ao menos uma unidade.':'Informe a quantidade medida.');return;}
    if(effectiveQuantity>balance+0.0001){setError(`A quantidade excede o saldo disponível de ${qty(balance)}.`);return;}
    setSaving(true);setError(null);
    try{
      await replaceMeasurementParityStage(scope,{
        measurementId,
        targetKind:stage.targetKind,
        targetId:stage.targetId,
        quantity:effectiveQuantity,
        references:referenceMode?selectedUnits:[],
        originName:origin.name,
        legacyServiceId:stage.legacyServiceId,
      });
      const nextModel=await reload();
      onChanged();
      const nextOrigin=nextModel?.origins.find(item=>item.id===origin.id);
      const nextStages=nextOrigin?.services??stages;
      if(serviceIndex+1<nextStages.length){setAutoOpenNext(true);setServiceIndex(serviceIndex+1);setPickerOpen(false);}
      else{setFinished(true);setPickerOpen(false);}
    }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar este serviço.');}
    finally{setSaving(false);}
  }

  if(loading&&!model)return <Dialog open title="Lançar medição" onClose={onClose} onBack={onClose}><LoadingState label="Carregando lógica de medição…"/></Dialog>;
  if(!model)return <Dialog open title="Lançar medição" onClose={onClose} onBack={onClose}><Feedback tone="danger" title="Não foi possível carregar" message={error??'Dados indisponíveis.'}/></Dialog>;

  const measurementOptions=[{value:'',label:'Selecione…'},...draftMeasurements.map(item=>({value:item.id,label:`${item.competence.slice(0,7)} · rascunho`}))];
  const originOptions=[{value:'',label:'Selecione…'},...model.origins.map(item=>({value:item.id,label:originLabel(item)}))];

  return <Dialog open title="Lançar medição" description="Mesmo fluxo funcional do Gestão 2.0" onClose={onClose} onBack={onClose}>
    <div className="guided-measurement guided-measurement--parity">
      {error&&<Feedback tone="danger" title="Não foi possível continuar" message={error}/>} 
      <div className="guided-measurement__selectors">
        <Select label="Medição" value={measurementId} onChange={event=>{setMeasurementId(event.target.value);moveTo(0);setFinished(false);}} options={measurementOptions}/>
        <Select label="Torre / aditivo / provisório" value={originId} onChange={event=>changeOrigin(event.target.value)} options={originOptions}/>
      </div>

      {!measurementId&&<div className="guided-measurement__empty"><strong>Crie a competência primeiro</strong><span>Use “Nova medição” e retorne para lançar os serviços.</span></div>}
      {measurementId&&originId&&stages.length===0&&<div className="guided-measurement__empty"><strong>Nenhum serviço nesta origem</strong><span>Não foi possível relacionar serviços do Gestão 2.0 com esta origem.</span></div>}

      {measurementId&&origin&&stage&&!finished&&<>
        <div className="guided-measurement__progress"><span>Serviço {serviceIndex+1} de {stages.length}</span><progress max={stages.length} value={serviceIndex+1}/></div>
        <section className="guided-measurement__service">
          <header><div><small>{originLabel(origin)}</small><h3>{stage.code?`${stage.code} · `:''}{stage.description}</h3></div><span>{stage.unit}</span></header>
          {stage.scopeActive&&<div className="guided-measurement__scope-note">Escopo deste serviço: {stage.scopeFloors.length?`pavimentos ${stage.scopeFloors.join(', ')}`:stage.startFloor!==null?`${stage.startFloor}º em diante`:'restrito às unidades definidas'}.</div>}
          <div className="guided-measurement__metrics">
            <div><span>Contratado</span><strong>{qty(stage.contractedQuantity)}</strong></div>
            <div><span>Medido</span><strong>{qty(measuredBefore)}</strong></div>
            <div><span>Saldo</span><strong>{qty(balance)}</strong></div>
            <div><span>Valor unit.</span><strong>{currency.format(stage.unitPrice)}</strong></div>
          </div>
          {referenceMode
            ? <Button className="guided-measurement__units-button" variant="secondary" onClick={()=>setPickerOpen(true)}>Selecionar apartamentos/unidades <b>{selectedUnits.length?`${selectedUnits.length} selecionada(s)`:''}</b></Button>
            : <Input label="Nesta medição / quantidade" inputMode="decimal" value={manualQuantity} onChange={event=>setManualQuantity(event.target.value)} placeholder={`Máximo ${qty(balance)}`}/>} 
          <div className="guided-measurement__total"><span>Nesta medição</span><strong>{qty(effectiveQuantity)} {stage.unit} · {currency.format(effectiveQuantity*stage.unitPrice)}</strong></div>
          {currentQuantity>0&&<small className="guided-measurement__saved-note">Este serviço já possui {qty(currentQuantity)} {stage.unit} salvo(s) nesta medição. Salvar novamente substitui apenas este serviço.</small>}
        </section>
        <div className="guided-measurement__actions">
          <Button variant="secondary" disabled={serviceIndex===0||saving} onClick={()=>moveTo(serviceIndex-1)}>← Anterior</Button>
          <Button onClick={()=>void saveCurrent()} disabled={saving}>{saving?'Salvando…':'Salvar e próximo →'}</Button>
        </div>
      </>}

      {finished&&<div className="guided-measurement__complete"><strong>Origem concluída</strong><span>Todos os serviços de {origin?originLabel(origin):'esta origem'} foram percorridos. Selecione outra origem ou prossiga para o fechamento da medição.</span><Button onClick={onClose}>Concluir</Button></div>}
    </div>

    {pickerOpen&&stage&&origin&&<div className="guided-measurement-picker" role="dialog" aria-modal="true" aria-label="Selecionar apartamentos/unidades">
      <div className="guided-measurement-picker__panel">
        <header><div><small>{originLabel(origin)}</small><h3>Selecionar apartamentos/unidades</h3><p>{stage.description}</p></div><Button variant="secondary" size="sm" onClick={()=>setPickerOpen(false)}>✕</Button></header>
        {stage.scopeActive&&<div className="guided-measurement__scope-note">Escopo deste serviço: {stage.scopeFloors.length?`somente pavimentos ${stage.scopeFloors.join(', ')}`:stage.startFloor!==null?`somente ${stage.startFloor}º em diante`:'somente unidades definidas'}.</div>}
        <div className="guided-measurement-picker__bar">
          <Input label="Pesquisar apartamento" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Ex.: 501"/>
          <div><Button variant="secondary" onClick={selectAvailable}>Selecionar até {maxSelectable} disponível(is)</Button><Button variant="tertiary" onClick={()=>setSelectedUnits([])}>Limpar seleção</Button></div>
          <p>Selecione no máximo <strong>{maxSelectable}</strong> unidade(s). Selecionadas: <strong>{selectedUnits.length}/{maxSelectable}</strong>.</p>
        </div>
        <div className="guided-measurement-picker__list">
          {visibleReferences.map(reference=><label key={reference} className={selectedUnits.includes(reference)?'is-selected':''}><input type="checkbox" checked={selectedUnits.includes(reference)} disabled={!selectedUnits.includes(reference)&&selectedUnits.length>=maxSelectable} onChange={()=>toggleReference(reference)}/><span>{reference}</span></label>)}
          {visibleReferences.length===0&&<div className="guided-measurement__empty">Nenhuma unidade disponível para este serviço.</div>}
        </div>
        <footer><Button onClick={()=>setPickerOpen(false)}>Confirmar seleção</Button></footer>
      </div>
    </div>}
  </Dialog>;
}
