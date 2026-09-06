import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { useEngineeringOperations } from './useEngineeringOperations';
import './guided-measurement-flow.css';

interface Props {
  scope:{tenantId:string;companyId:string};
  contractId:string;
  onChanged:()=>void;
  onClose:()=>void;
}

type ServiceStage={
  serviceId:string;
  description:string;
  unit:string;
  unitPrice:number;
  allocated:number;
  measured:number;
  balance:number;
  eligibleStructureIds:string[];
};

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const qty=(value:number)=>Number.isInteger(value)?String(value):value.toLocaleString('pt-BR',{maximumFractionDigits:2});

export function GuidedMeasurementFlow({scope,contractId,onChanged,onClose}:Props){
  const operations=useEngineeringOperations(scope);
  const data=operations.state.data;
  const [measurementId,setMeasurementId]=useState('');
  const [originId,setOriginId]=useState('');
  const [serviceIndex,setServiceIndex]=useState(0);
  const [pickerOpen,setPickerOpen]=useState(false);
  const [selectedUnits,setSelectedUnits]=useState<string[]>([]);
  const [search,setSearch]=useState('');
  const [manualQuantity,setManualQuantity]=useState('');
  const [localError,setLocalError]=useState<string|null>(null);
  const [finished,setFinished]=useState(false);

  const contract=data?.contracts.find(item=>item.id===contractId);
  const workId=contract?.workId??'';
  const measurements=(data?.measurements??[]).filter(item=>item.contractId===contractId&&['draft','open'].includes(item.status));

  useEffect(()=>{
    if(!measurementId&&measurements.length) setMeasurementId(measurements[0]?.id??'');
  },[measurementId,measurements]);

  const structures=useMemo(()=>(data?.structures??[]).filter(item=>item.workId===workId),[data?.structures,workId]);
  const structureById=useMemo(()=>new Map(structures.map(item=>[item.id,item])),[structures]);
  const childrenByParent=useMemo(()=>{
    const map=new Map<string,typeof structures>();
    structures.forEach(item=>{const key=item.parentId??'';map.set(key,[...(map.get(key)??[]),item]);});
    return map;
  },[structures]);
  const descendants=(rootId:string)=>{
    const found:string[]=[];const queue=[rootId];
    while(queue.length){const id=queue.shift();if(!id)continue;for(const child of childrenByParent.get(id)??[]){found.push(child.id);queue.push(child.id);}}
    return found;
  };

  const contractServiceIds=new Set((data?.contractServices??[]).filter(item=>item.contractId===contractId).map(item=>item.id));
  const allocations=(data?.allocations??[]).filter(item=>contractServiceIds.has(item.contractServiceId)&&item.status==='active');
  const candidateOrigins=useMemo(()=>{
    const ids=new Set<string>();
    allocations.forEach(allocation=>{
      let current=structureById.get(allocation.structureId);
      if(!current)return;
      while(current?.parentId&&structureById.has(current.parentId)) current=structureById.get(current.parentId);
      ids.add(current?.id??allocation.structureId);
    });
    return Array.from(ids).map(id=>structureById.get(id)).filter((item):item is NonNullable<typeof item>=>Boolean(item));
  },[allocations,structureById]);

  useEffect(()=>{
    if(originId&&candidateOrigins.some(item=>item.id===originId))return;
    setOriginId(candidateOrigins[0]?.id??'');setServiceIndex(0);setFinished(false);
  },[candidateOrigins,originId]);

  const originScopeIds=useMemo(()=>originId?[originId,...descendants(originId)]:[],[originId,childrenByParent]);
  const originScopeSet=useMemo(()=>new Set(originScopeIds),[originScopeIds]);
  const measurementLines=data?.measurementLines??[];

  const stages:ServiceStage[]=useMemo(()=>{
    const services=(data?.contractServices??[]).filter(item=>item.contractId===contractId);
    return services.map(service=>{
      const serviceAllocations=allocations.filter(item=>item.contractServiceId===service.id&&originScopeSet.has(item.structureId));
      const eligibleStructureIds=Array.from(new Set(serviceAllocations.flatMap(allocation=>[allocation.structureId,...descendants(allocation.structureId)])));
      const allocated=serviceAllocations.reduce((sum,item)=>sum+item.allocatedQuantity,0);
      const measured=measurementLines.filter(line=>line.contractServiceId===service.id&&originScopeSet.has(line.structureId??'')).reduce((sum,line)=>sum+line.measuredQuantity,0);
      return {serviceId:service.id,description:service.description,unit:service.unit,unitPrice:service.unitPrice,allocated,measured,balance:Math.max(0,allocated-measured),eligibleStructureIds};
    }).filter(stage=>stage.allocated>0);
  },[data?.contractServices,contractId,allocations,originScopeSet,measurementLines]);

  useEffect(()=>{if(serviceIndex>=stages.length)setServiceIndex(Math.max(0,stages.length-1));},[serviceIndex,stages.length]);
  const stage=stages[serviceIndex];
  const alreadyMeasuredUnitIds=useMemo(()=>new Set(measurementLines.filter(line=>line.contractServiceId===stage?.serviceId&&line.structureId).map(line=>line.structureId as string)),[measurementLines,stage?.serviceId]);
  const unitCandidates=useMemo(()=>{
    if(!stage)return [];
    const eligible=new Set(stage.eligibleStructureIds);
    return structures.filter(item=>eligible.has(item.id)&&['unit','house'].includes(item.type)&&!alreadyMeasuredUnitIds.has(item.id));
  },[stage,structures,alreadyMeasuredUnitIds]);
  const normalized=search.trim().toLocaleLowerCase('pt-BR');
  const visibleUnits=unitCandidates.filter(item=>!normalized||`${item.code??''} ${item.name}`.toLocaleLowerCase('pt-BR').includes(normalized));
  const maxSelectable=Math.max(0,Math.floor(stage?.balance??0));
  const unitMode=unitCandidates.length>0;
  const selectedCount=selectedUnits.length;
  const effectiveQuantity=unitMode?selectedCount:Number(manualQuantity.replace(',','.'))||0;

  function moveTo(index:number){setServiceIndex(index);setSelectedUnits([]);setManualQuantity('');setSearch('');setLocalError(null);setPickerOpen(false);}
  function nextService(){if(serviceIndex+1<stages.length)moveTo(serviceIndex+1);else{setFinished(true);setPickerOpen(false);}}
  function toggleUnit(id:string){
    setSelectedUnits(current=>current.includes(id)?current.filter(item=>item!==id):(current.length<maxSelectable?[...current,id]:current));
  }
  function selectAvailable(){setSelectedUnits(unitCandidates.slice(0,maxSelectable).map(item=>item.id));}

  async function saveCurrent(){
    if(!measurementId){setLocalError('Selecione ou crie uma medição antes de lançar os serviços.');return;}
    if(!stage){setLocalError('Nenhum serviço disponível para esta origem.');return;}
    if(effectiveQuantity<=0){setLocalError(unitMode?'Selecione ao menos uma unidade.':'Informe a quantidade medida.');return;}
    if(effectiveQuantity>stage.balance+0.0001){setLocalError(`A quantidade excede o saldo disponível de ${qty(stage.balance)}.`);return;}
    setLocalError(null);
    try{
      if(unitMode){
        for(const structureId of selectedUnits){
          await operations.addMeasurementLine({measurementId,contractServiceId:stage.serviceId,structureId,measuredQuantity:1,unitPrice:stage.unitPrice,notes:null});
        }
      }else{
        await operations.addMeasurementLine({measurementId,contractServiceId:stage.serviceId,structureId:originId||null,measuredQuantity:effectiveQuantity,unitPrice:stage.unitPrice,notes:null});
      }
      await operations.reload();onChanged();nextService();
    }catch{/* feedback do hook */}
  }

  if(operations.state.busy&&!data)return <Dialog open title="Medição" onClose={onClose} onBack={onClose}><LoadingState label="Carregando medição…"/></Dialog>;
  if(!data)return <Dialog open title="Medição" onClose={onClose} onBack={onClose}><Feedback tone="danger" title="Não foi possível carregar" message={operations.state.errorMessage??'Dados indisponíveis.'}/></Dialog>;

  const measurementOptions=[{value:'',label:'Selecione…'},...measurements.map(item=>({value:item.id,label:`${item.competence.slice(0,7)} · ${item.status}`}))];
  const originOptions=[{value:'',label:'Selecione…'},...candidateOrigins.map(item=>({value:item.id,label:item.name}))];

  return <Dialog open title="Lançar medição" description="Fluxo sequencial por origem, serviço e unidade" onClose={onClose} onBack={onClose}>
    <div className="guided-measurement">
      {(localError||operations.state.errorMessage)&&<Feedback tone="danger" title="Não foi possível continuar" message={localError??operations.state.errorMessage??''}/>} 
      <div className="guided-measurement__selectors"><Select label="Medição" value={measurementId} onChange={event=>{setMeasurementId(event.target.value);moveTo(0);}} options={measurementOptions}/><Select label="Torre / origem" value={originId} onChange={event=>{setOriginId(event.target.value);moveTo(0);setFinished(false);}} options={originOptions}/></div>
      {!measurementId&&<div className="guided-measurement__empty"><strong>Crie a competência primeiro</strong><span>Use “Nova medição” e depois retorne para lançar os serviços.</span></div>}
      {measurementId&&originId&&stages.length===0&&<div className="guided-measurement__empty"><strong>Nenhum serviço distribuído</strong><span>Esta origem ainda não possui serviços contratados distribuídos.</span></div>}
      {measurementId&&originId&&stages.length>0&&!finished&&stage&&<>
        <div className="guided-measurement__progress"><span>Serviço {serviceIndex+1} de {stages.length}</span><progress max={stages.length} value={serviceIndex+1}/></div>
        <section className="guided-measurement__service">
          <header><div><small>{structureById.get(originId)?.name??'Origem'}</small><h3>{stage.description}</h3></div><span>{stage.unit}</span></header>
          <div className="guided-measurement__metrics"><div><span>Contratado</span><strong>{qty(stage.allocated)}</strong></div><div><span>Medido</span><strong>{qty(stage.measured)}</strong></div><div><span>Saldo</span><strong>{qty(stage.balance)}</strong></div><div><span>Valor unit.</span><strong>{currency.format(stage.unitPrice)}</strong></div></div>
          {unitMode?<Button className="guided-measurement__units-button" variant="secondary" onClick={()=>setPickerOpen(true)}>Selecionar apartamentos/unidades <b>{selectedCount>0?`${selectedCount} selecionada(s)`:''}</b></Button>:<Input label="Nesta medição / quantidade" inputMode="decimal" value={manualQuantity} onChange={event=>setManualQuantity(event.target.value)} placeholder={`Máximo ${qty(stage.balance)}`}/>} 
          <div className="guided-measurement__total"><span>Nesta medição</span><strong>{qty(effectiveQuantity)} {stage.unit} · {currency.format(effectiveQuantity*stage.unitPrice)}</strong></div>
        </section>
        <div className="guided-measurement__actions"><Button variant="secondary" disabled={serviceIndex===0} onClick={()=>moveTo(serviceIndex-1)}>← Anterior</Button><Button onClick={()=>void saveCurrent()} disabled={operations.state.busy}>Salvar e próximo →</Button></div>
      </>}
      {finished&&<div className="guided-measurement__complete"><strong>Origem concluída</strong><span>Todos os serviços desta origem foram percorridos. Você pode escolher outra origem ou seguir para o fechamento.</span><Button onClick={onClose}>Concluir</Button></div>}
    </div>
    {pickerOpen&&stage&&<div className="guided-measurement-picker" role="dialog" aria-modal="true" aria-label="Selecionar apartamentos"><div className="guided-measurement-picker__panel"><header><div><small>{structureById.get(originId)?.name??'Origem'}</small><h3>Selecionar apartamentos</h3><p>{stage.description}</p></div><Button variant="secondary" size="sm" onClick={()=>setPickerOpen(false)}>✕</Button></header><div className="guided-measurement-picker__bar"><Input label="Pesquisar apartamento" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Ex.: 101"/><div><Button variant="secondary" onClick={selectAvailable}>Selecionar até {maxSelectable} disponível(is)</Button><Button variant="tertiary" onClick={()=>setSelectedUnits([])}>Limpar seleção</Button></div><p>Selecione no máximo <strong>{maxSelectable}</strong> unidade(s). Selecionadas: <strong>{selectedCount}/{maxSelectable}</strong>.</p></div><div className="guided-measurement-picker__list">{visibleUnits.map(unit=><label key={unit.id} className={selectedUnits.includes(unit.id)?'is-selected':''}><input type="checkbox" checked={selectedUnits.includes(unit.id)} disabled={!selectedUnits.includes(unit.id)&&selectedCount>=maxSelectable} onChange={()=>toggleUnit(unit.id)}/><span>{unit.code||unit.name}</span></label>)}{visibleUnits.length===0&&<div className="guided-measurement__empty">Nenhuma unidade disponível para este serviço.</div>}</div><footer><Button onClick={()=>setPickerOpen(false)}>Confirmar seleção</Button></footer></div></div>}
  </Dialog>;
}
