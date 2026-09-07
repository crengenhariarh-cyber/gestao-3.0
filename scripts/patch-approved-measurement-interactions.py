from pathlib import Path

ui=Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s=ui.read_text()

# Remove pagination/expand state: the approved screen uses one scrollable table with all filtered services.
s=s.replace("  const [page,setPage]=useState(1);\n  const [showAll,setShowAll]=useState(false);\n","")
s=s.replace("  const pageSize=12;\n  const totalPages=Math.max(1,Math.ceil(approvedRows.length/pageSize));\n  const approvedPagedRows=showAll?approvedRows:approvedRows.slice((Math.min(page,totalPages)-1)*pageSize,Math.min(page,totalPages)*pageSize);\n  useEffect(()=>{setPage(1);},[serviceSearch,typeFilter,statusFilter]);\n","")

# Toolbar button must match the approved layout.
s=s.replace("<Button variant=\"secondary\" onClick={()=>setShowAll(value=>!value)}>↗ {showAll?'Paginar':'Expandir todos'}</Button>","<Button variant=\"secondary\" onClick={()=>{setServiceSearch('');setTypeFilter('');setStatusFilter('');}}>Limpar filtros</Button>")

# Exact approved table columns: value unit replaces redundant Actions column.
s=s.replace("<th>#</th><th>Código</th><th>Descrição do serviço</th><th>Referência</th><th>Contratado</th><th>Medido</th><th>Saldo</th><th>Tipo</th><th>Nesta medição</th><th>Total</th><th>Ações</th>","<th>#</th><th>Código</th><th>Descrição do serviço</th><th>Referência</th><th>Contratado</th><th>Medido</th><th>Saldo</th><th>Tipo</th><th>Valor unitário</th><th>Nesta medição</th><th>Total</th>")

old="""return <tr key={`${item.targetKind}:${item.targetId}`}><td>{showAll?rowPosition+1:(page-1)*pageSize+rowPosition+1}</td><td><strong>{item.code||`#${index+1}`}</strong></td><td>{item.description}</td><td><span className=\"approved-measurement-sheet__unit\">{item.unit}</span>{refs.length>0&&<Button size=\"sm\" onClick={()=>chooseService(index)}>Selecionar apartamentos/unidades</Button>}</td><td>{qty(item.contractedQuantity)}</td><td>{qty(previous)}</td><td>{qty(remaining)}</td><td><span className={`approved-measurement-sheet__type ${refs.length?'is-unit':'is-global'}`}>{refs.length?'Por unidade':'Global'}</span></td><td><input className=\"approved-measurement-sheet__quantity\" inputMode=\"decimal\" value={currentInput} readOnly={refs.length>0} onFocus={()=>{if(!refs.length)resetStage(index);}} onChange={event=>{resetStage(index);setManualQuantity(event.target.value);}} placeholder=\"0,00\"/></td><td>{currency.format(current*item.unitPrice)}</td><td><div className=\"approved-measurement-sheet__row-actions\"><button type=\"button\" onClick={()=>chooseService(index)}>▣</button><button type=\"button\" onClick={()=>chooseService(index)}>•••</button></div></td></tr>;"""
new="""return <tr key={`${item.targetKind}:${item.targetId}`}><td>{rowPosition+1}</td><td><strong>{item.code||`#${index+1}`}</strong></td><td>{item.description}</td><td><span className=\"approved-measurement-sheet__unit\">{item.unit}</span>{refs.length>0&&<Button size=\"sm\" onClick={()=>chooseService(index)}>Selecionar apartamentos/unidades</Button>}</td><td>{qty(item.contractedQuantity)}</td><td>{qty(previous)}</td><td>{qty(remaining)}</td><td><span className={`approved-measurement-sheet__type ${refs.length?'is-unit':'is-global'}`}>{refs.length?'Por unidade':'Global'}</span></td><td>{currency.format(item.unitPrice)}</td><td><input className=\"approved-measurement-sheet__quantity\" inputMode=\"decimal\" value={currentInput} readOnly={refs.length>0} onFocus={()=>{if(!refs.length)resetStage(index);}} onChange={event=>{resetStage(index);setManualQuantity(event.target.value);}} placeholder=\"0,00\"/></td><td>{currency.format(current*item.unitPrice)}</td></tr>;"""
if old not in s: raise SystemExit('approved row anchor not found')
s=s.replace(old,new)

# Show every filtered service inside the internal vertical scroll, no pagination footer.
s=s.replace("approvedPagedRows.map", "approvedRows.map")
start='<footer className="approved-measurement-sheet__pagination">'
end='</footer>'
idx=s.find(start)
if idx!=-1:
    j=s.find(end,idx)
    if j==-1: raise SystemExit('pagination footer end not found')
    s=s[:idx]+s[j+len(end):]

# Allow a previously saved unit selection to be cleared completely.
s=s.replace("    if(effectiveQuantity<=0){setError(referenceMode?'Selecione ao menos uma unidade.':'Informe a quantidade medida.');return;}","    if(effectiveQuantity<=0&&currentLines.length===0){setError(referenceMode?'Selecione ao menos uma unidade.':'Informe a quantidade medida.');return;}")
s=s.replace("<Button onClick={()=>void saveCurrent()} disabled={saving||selectedUnits.length===0}>{saving?'Salvando…':'Confirmar e próximo serviço →'}</Button>","<Button onClick={()=>void saveCurrent()} disabled={saving||(selectedUnits.length===0&&currentLines.length===0)}>{saving?'Salvando…':selectedUnits.length===0&&currentLines.length>0?'Remover seleção salva':'Confirmar e próximo serviço →'}</Button>")

ui.write_text(s)

css=Path('src/modules/engineering/ui/approved-measurement-sheet.css')
c=css.read_text()
c=c.replace('.approved-measurement-sheet__table-wrap{overflow:auto}', '.approved-measurement-sheet__table-wrap{max-height:52vh;overflow-x:auto;overflow-y:scroll;scrollbar-gutter:stable both-edges;overscroll-behavior:contain}')
# Old row-actions are no longer part of the approved screen.
c=c.replace('.approved-measurement-sheet__row-actions{display:flex;gap:7px}.approved-measurement-sheet__row-actions button,.approved-measurement-sheet__pagination button{height:34px;min-width:34px;border:1px solid #d7e0ea;border-radius:8px;background:#fff;color:#26364a;font-weight:800;cursor:pointer}', '.approved-measurement-sheet__table-wrap::-webkit-scrollbar{width:12px;height:12px}.approved-measurement-sheet__table-wrap::-webkit-scrollbar-thumb{background:#aab7c6;border:3px solid #fff;border-radius:999px}.approved-measurement-sheet__table-wrap::-webkit-scrollbar-track{background:#f3f6f9}.approved-measurement-sheet__pagination button{height:34px;min-width:34px;border:1px solid #d7e0ea;border-radius:8px;background:#fff;color:#26364a;font-weight:800;cursor:pointer}')
css.write_text(c)
