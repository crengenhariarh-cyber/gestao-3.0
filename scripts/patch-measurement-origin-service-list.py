from pathlib import Path

p=Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s=p.read_text()

old="  const [pickerOpen,setPickerOpen]=useState(false); const [selectedUnits,setSelectedUnits]=useState<string[]>([]); const [search,setSearch]=useState(''); const [manualQuantity,setManualQuantity]=useState('');"
new="  const [pickerOpen,setPickerOpen]=useState(false); const [unitPickerOpen,setUnitPickerOpen]=useState(false); const [serviceSearch,setServiceSearch]=useState(''); const [selectedUnits,setSelectedUnits]=useState<string[]>([]); const [search,setSearch]=useState(''); const [manualQuantity,setManualQuantity]=useState('');"
if old not in s: raise SystemExit('state anchor not found')
s=s.replace(old,new,1)

old="  async function openOrigin(nextOriginId:string){if(!nextOriginId)return;if(measurementId){try{await saveHeader();}catch{return;}}setOriginId(nextOriginId);setServiceIndex(0);setError(null);setPickerOpen(true);}\n  function closePicker(){setPickerOpen(false);setOriginId('');setSelectedUnits([]);setManualQuantity('');setSearch('');}"
new="  async function openOrigin(nextOriginId:string){if(!nextOriginId)return;if(measurementId){try{await saveHeader();}catch{return;}}setOriginId(nextOriginId);setServiceIndex(0);setServiceSearch('');setUnitPickerOpen(false);setError(null);setPickerOpen(true);}\n  function openService(index:number){setServiceIndex(index);setSearch('');setError(null);setUnitPickerOpen(true);}\n  function closeUnitPicker(){setUnitPickerOpen(false);setSelectedUnits([]);setManualQuantity('');setSearch('');}\n  function closePicker(){setUnitPickerOpen(false);setPickerOpen(false);setOriginId('');setServiceSearch('');setSelectedUnits([]);setManualQuantity('');setSearch('');}"
if old not in s: raise SystemExit('openOrigin anchor not found')
s=s.replace(old,new,1)

old="await reload();closePicker();onChanged();"
new="await reload();closeUnitPicker();onChanged();"
if old not in s: raise SystemExit('confirm close anchor not found')
s=s.replace(old,new,1)

start=s.find('    {pickerOpen&&origin&&stage&&<div className="guided-measurement-picker"')
if start<0: raise SystemExit('picker render start not found')
end=s.find('  </Dialog>;',start)
if end<0: raise SystemExit('dialog end not found')

block=r'''    {pickerOpen&&origin&&<div className="guided-measurement-picker" role="dialog" aria-modal="true" aria-label={`Serviços de ${originLabel(origin)}`}><div className="guided-measurement-picker__panel guided-measurement-origin-sheet">
      <header><div><small>{originLabel(origin)}</small><h3>Selecionar serviços</h3><p>Pesquise os serviços desta origem, selecione as unidades e confirme a origem ao finalizar.</p></div><Button variant="secondary" size="sm" onClick={closePicker}>✕</Button></header>
      <div className="guided-measurement-picker__bar guided-measurement-origin-sheet__toolbar"><Input label="Pesquisar serviço" value={serviceSearch} onChange={event=>setServiceSearch(event.target.value)} placeholder="Código ou descrição do serviço"/><p><strong>{stages.length}</strong> serviço(s) nesta origem</p></div>
      <div className="guided-measurement-service-list">{stages.filter(item=>!normalize(serviceSearch)||normalize(`${item.code??''} ${item.description}`).includes(normalize(serviceSearch))).map(item=>{const index=stages.indexOf(item);const targetKey=`${item.targetKind}:${item.targetId}`;const current=model.lines.filter(line=>line.measurementId===measurementId&&`${line.targetKind}:${line.targetId}`===targetKey).reduce((sum,line)=>sum+line.measuredQuantity,0);const previous=model.lines.filter(line=>line.measurementId!==measurementId&&['draft','closed','approved'].includes(line.measurementStatus)&&`${line.targetKind}:${line.targetId}`===targetKey).reduce((sum,line)=>sum+line.measuredQuantity,0);const balanceQty=Math.max(0,item.contractedQuantity-previous);const value=current*item.unitPrice;return <button key={targetKey} type="button" className={`guided-measurement-service-row${current>0?' is-current':''}`} onClick={()=>openService(index)}><span><strong>{item.code?`${item.code} · `:''}{item.description}</strong><small>{item.unit} · {currency.format(item.unitPrice)} por unidade</small></span><span className="guided-measurement-service-row__numbers"><small>Contratado {item.contractedQuantity.toLocaleString('pt-BR')}</small><small>Saldo {balanceQty.toLocaleString('pt-BR')}</small><b>{current>0?`${current.toLocaleString('pt-BR')} nesta medição`:'Selecionar unidades'}</b></span><span>{current>0?currency.format(value):'›'}</span></button>})}</div>
      <footer className="guided-measurement-origin-sheet__footer"><Button variant="secondary" onClick={closePicker}>Voltar à medição</Button><Button onClick={closePicker}>✓ Confirmar {originLabel(origin)}</Button></footer>
    </div></div>}

    {pickerOpen&&unitPickerOpen&&origin&&stage&&<div className="guided-measurement-picker guided-measurement-unit-picker" role="dialog" aria-modal="true" aria-label="Selecionar apartamentos e unidades"><div className="guided-measurement-picker__panel">
      <header><div><small>{originLabel(origin)}</small><h3>{stage.code?`${stage.code} · `:''}{stage.description}</h3><p>Marque os apartamentos/unidades deste serviço e confirme.</p></div><Button variant="secondary" size="sm" onClick={closeUnitPicker}>✕</Button></header>
      <div className="guided-measurement-picker__bar">{refs.length>0?<><Input label="Pesquisar apartamento/unidade" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Ex.: 501"/><div><Button variant="secondary" onClick={()=>setSelectedUnits(available.slice(0,maxSelectable))}>Selecionar até {maxSelectable} disponível(is)</Button><Button variant="tertiary" onClick={()=>setSelectedUnits([])}>Limpar seleção</Button></div><p>Selecionadas: <strong>{selectedUnits.length}/{maxSelectable}</strong>.</p></>:<Input label="Quantidade nesta medição" value={manualQuantity} onChange={event=>setManualQuantity(event.target.value)} inputMode="decimal" placeholder="0,00"/>}</div>
      {refs.length>0&&<div className="guided-measurement-picker__list guided-measurement-picker__list--floors">{grouped.map(([level,references])=><section className="guided-measurement-floor" key={level}><header><strong>{referenceLevelLabel(level)}</strong><span>{references.filter(reference=>selectedUnits.includes(reference)).length}/{references.length} selecionado(s)</span></header><div className="guided-measurement-floor__units">{references.map(reference=><label key={reference} className={selectedUnits.includes(reference)?'is-selected':''}><input type="checkbox" checked={selectedUnits.includes(reference)} disabled={!selectedUnits.includes(reference)&&selectedUnits.length>=maxSelectable} onChange={()=>setSelectedUnits(current=>current.includes(reference)?current.filter(item=>item!==reference):(current.length<maxSelectable?[...current,reference]:current))}/><span>{reference.startsWith('TR-')?`Apto ${reference.slice(3)}`:`Apto ${reference}`}</span></label>)}</div></section>)}</div>}
      <footer><Button variant="secondary" onClick={closeUnitPicker}>Cancelar</Button><Button onClick={()=>void confirmSelection()} disabled={saving||(effectiveQuantity<=0&&currentLines.length===0)}>{saving?'Salvando…':'✓ Confirmar seleção'}</Button></footer>
    </div></div>}
'''
s=s[:start]+block+s[end:]
p.write_text(s)

css=Path('src/modules/engineering/ui/guided-measurement-flow.css')
cs=css.read_text()
addition='''\n/* Origin service sheet: service-first measurement flow */\n.guided-measurement-origin-sheet{grid-template-rows:auto auto minmax(0,1fr) auto}.guided-measurement-origin-sheet__toolbar{grid-template-columns:minmax(0,1fr) auto;align-items:end}.guided-measurement-origin-sheet__toolbar>p{min-width:170px;text-align:center}.guided-measurement-origin-sheet__footer{display:grid!important;grid-template-columns:minmax(180px,.6fr) minmax(260px,1fr)!important;gap:12px}.guided-measurement-origin-sheet__footer button{width:100%}.guided-measurement-unit-picker{z-index:1300}.guided-measurement-service-row:hover{border-color:#9ec5f6;box-shadow:0 8px 20px rgba(37,99,235,.08);transform:translateY(-1px)}@media(max-width:760px){.guided-measurement-origin-sheet__toolbar{grid-template-columns:1fr}.guided-measurement-origin-sheet__footer{grid-template-columns:1fr!important}.guided-measurement-origin-sheet__footer button{min-height:50px!important}}\n'''
if 'Origin service sheet: service-first measurement flow' not in cs:
    css.write_text(cs+addition)
