from pathlib import Path

p=Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s=p.read_text()

needle="import './guided-measurement-flow.css';"
if "approved-measurement-sheet.css" not in s:
    s=s.replace(needle, needle+"\nimport './approved-measurement-sheet.css';")

old="""  const [serviceSearch,setServiceSearch]=useState('');
  const [manualQuantity,setManualQuantity]=useState('');"""
new="""  const [serviceSearch,setServiceSearch]=useState('');
  const [typeFilter,setTypeFilter]=useState('');
  const [statusFilter,setStatusFilter]=useState('');
  const [page,setPage]=useState(1);
  const [showAll,setShowAll]=useState(false);
  const [manualQuantity,setManualQuantity]=useState('');"""
if old in s:s=s.replace(old,new)
elif new not in s:raise SystemExit('state insertion point not found')

old="""  const effectiveQuantity=referenceMode?selectedUnits.length:Number(manualQuantity.replace(',','.'))||0;
  const filteredServiceIndexes=useMemo(()=>stages.map((item,index)=>({item,index})).filter(({item})=>!normalize(serviceSearch)||normalize(`${item.code} ${item.description}`).includes(normalize(serviceSearch))),[stages,serviceSearch]);"""
new="""  const effectiveQuantity=referenceMode?selectedUnits.length:Number(manualQuantity.replace(',','.'))||0;
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
  const pageSize=12;
  const totalPages=Math.max(1,Math.ceil(approvedRows.length/pageSize));
  const approvedPagedRows=showAll?approvedRows:approvedRows.slice((Math.min(page,totalPages)-1)*pageSize,Math.min(page,totalPages)*pageSize);
  useEffect(()=>{setPage(1);},[serviceSearch,typeFilter,statusFilter]);
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
  },[model,origin,measurementId]);"""
if old in s:s=s.replace(old,new)
elif new not in s:raise SystemExit('approved rows insertion point not found')

start=s.find('  return <Dialog open variant="measurement-fullscreen" title="Lançar medição"')
unit=s.find('    {unitPickerOpen&&stage&&origin&&<div className="guided-measurement-picker"',start)
if start<0 or unit<0:raise SystemExit('render block anchors not found')
prefix=s[:start]
suffix=s[unit:]
render=r'''  return <Dialog open variant="measurement-fullscreen" title={origin?`Medição - ${originLabel(origin)}`:'Medição'} description={origin?'Elabore a medição dos serviços desta origem.':'Selecione a origem da medição.'} onClose={onClose} onBack={onClose}>
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
          <Button variant="secondary" onClick={()=>setShowAll(value=>!value)}>↗ {showAll?'Paginar':'Expandir todos'}</Button>
        </section>
        <section className="approved-measurement-sheet__table-card">
          <div className="approved-measurement-sheet__table-wrap"><table className="approved-measurement-sheet__table"><thead><tr><th>#</th><th>Código</th><th>Descrição do serviço</th><th>Referência</th><th>Contratado</th><th>Medido</th><th>Saldo</th><th>Tipo</th><th>Nesta medição</th><th>Total</th><th>Ações</th></tr></thead><tbody>{approvedPagedRows.map(({item,index},rowPosition)=>{
            const lines=model.lines.filter(line=>line.targetKind===item.targetKind&&line.targetId===item.targetId);
            const previous=lines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)).reduce((sum,line)=>sum+line.measuredQuantity,0);
            const current=lines.filter(line=>line.measurementId===measurementId).reduce((sum,line)=>sum+line.measuredQuantity,0);
            const remaining=Math.max(0,item.contractedQuantity-previous);
            const refs=stageReferences(model,origin,item);
            const currentInput=index===serviceIndex&&!refs.length?manualQuantity:(current>0?String(current).replace('.',','):'');
            return <tr key={`${item.targetKind}:${item.targetId}`}><td>{showAll?rowPosition+1:(page-1)*pageSize+rowPosition+1}</td><td><strong>{item.code||`#${index+1}`}</strong></td><td>{item.description}</td><td><span className="approved-measurement-sheet__unit">{item.unit}</span>{refs.length>0&&<Button size="sm" onClick={()=>chooseService(index)}>Selecionar apartamentos/unidades</Button>}</td><td>{qty(item.contractedQuantity)}</td><td>{qty(previous)}</td><td>{qty(remaining)}</td><td><span className={`approved-measurement-sheet__type ${refs.length?'is-unit':'is-global'}`}>{refs.length?'Por unidade':'Global'}</span></td><td><input className="approved-measurement-sheet__quantity" inputMode="decimal" value={currentInput} readOnly={refs.length>0} onFocus={()=>{if(!refs.length)resetStage(index);}} onChange={event=>{resetStage(index);setManualQuantity(event.target.value);}} placeholder="0,00"/></td><td>{currency.format(current*item.unitPrice)}</td><td><div className="approved-measurement-sheet__row-actions"><button type="button" onClick={()=>chooseService(index)}>▣</button><button type="button" onClick={()=>chooseService(index)}>•••</button></div></td></tr>;
          })}</tbody></table></div>
          <footer className="approved-measurement-sheet__pagination"><span>Exibindo {approvedPagedRows.length} de {approvedRows.length} serviços</span>{!showAll&&<div><button disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>‹</button>{Array.from({length:Math.min(totalPages,5)},(_,i)=>i+1).map(value=><button key={value} className={page===value?'is-active':''} onClick={()=>setPage(value)}>{value}</button>)}<button disabled={page>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages,value+1))}>›</button></div>}</footer>
        </section>
        <footer className="approved-measurement-sheet__bottom-actions"><Button variant="secondary" onClick={onClose}>Cancelar medição</Button><div><Button variant="secondary" disabled={saving||effectiveQuantity<=0} onClick={()=>void saveCurrent()}>{saving?'Salvando…':'▣ Salvar rascunho'}</Button><Button onClick={onClose}>✓ Finalizar medição</Button></div></footer>
      </>}
    </div>

'''
s=prefix+render+suffix
s=s.replace("  const [servicePickerOpen,setServicePickerOpen]=useState(false);","  const [,setServicePickerOpen]=useState(false);")
s=s.replace("  const [finished,setFinished]=useState(false);","  const [,setFinished]=useState(false);")
change_start=s.find("  function changeOrigin(value:string){")
if change_start>=0:
    change_end=s.find("  function chooseService",change_start)
    if change_end<0:raise SystemExit('changeOrigin end not found')
    s=s[:change_start]+s[change_end:]
s=s.replace("  const measurementOptions=[{value:'',label:'Selecione…'},...draftMeasurements.map(item=>({value:item.id,label:`${item.measurementNumber?`Medição ${item.measurementNumber} · `:''}${item.competence.slice(0,7)} · rascunho`}))];\n","")
s=s.replace("  const originOptions=[{value:'',label:'Selecione…'},...model.origins.map(item=>({value:item.id,label:originLabel(item)}))];\n","")
p.write_text(s)
