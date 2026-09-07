from pathlib import Path

path = Path('src/modules/engineering/ui/EngineeringContractWorkspace.tsx')
text = path.read_text(encoding='utf-8')

old = """  const progress=Math.max(0,Math.min(100,contract.measuredPercent));
"""
new = """  const progress=Math.max(0,Math.min(100,contract.measuredPercent));
  const measurementValue=(measurementId:string)=>(data?.measurementLines??[]).filter(line=>line.measurementId===measurementId).reduce((sum,line)=>sum+line.grossValue,0);
  const draftMeasurementValue=measurements.filter(item=>item.status==='draft').reduce((sum,item)=>sum+measurementValue(item.id),0);
"""
if old not in text:
    raise SystemExit('progress anchor not found')
text = text.replace(old, new, 1)

old = """  const sheetHead=(count:number,totalLabel?:string,totalValue?:string)=><div className=\"engineering-sheet__stats\">\n    <div><span>Registros</span><strong>{count}</strong></div>\n    <div><span>Contrato</span><strong>{currency.format(contract.updatedContractValue)}</strong></div>\n    <div><span>Medido</span><strong className=\"engineering-positive\">{currency.format(contract.measuredNet)}</strong></div>\n    <div><span>{totalLabel??'Saldo'}</span><strong>{totalValue??currency.format(contract.grossBalance)}</strong></div>\n  </div>;"""
new = """  const sheetHead=(count:number,totalLabel?:string,totalValue?:string,measuredValue=contract.measuredNet)=><div className=\"engineering-sheet__stats\">\n    <div><span>Registros</span><strong>{count}</strong></div>\n    <div><span>Contrato</span><strong>{currency.format(contract.updatedContractValue)}</strong></div>\n    <div><span>Medido</span><strong className=\"engineering-positive\">{currency.format(measuredValue)}</strong></div>\n    <div><span>{totalLabel??'Saldo'}</span><strong>{totalValue??currency.format(contract.grossBalance)}</strong></div>\n  </div>;"""
if old not in text:
    raise SystemExit('sheetHead anchor not found')
text = text.replace(old, new, 1)

old = """      body=<>{toolbar('Nova medição','measurement')}{sheetHead(measurements.length)}<div className=\"engineering-sheet__table-wrap\"><table className=\"engineering-sheet__table\"><thead><tr><th>Competência</th><th>Nº medição</th><th>Origem</th><th>Status</th><th>Contrato</th><th>Evolução geral</th><th>Ações</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td><strong>{monthLabel(item.competence)}</strong></td><td>{item.measurementNumber||'—'}</td><td>{item.originLabel||'—'}</td><td><span className={`engineering-status engineering-status--${item.status}`}>{labelStatus(item.status)}</span></td><td>{contract.contractNumber}</td><td>{progress.toFixed(1)}%</td><td><div className=\"engineering-sheet__row-actions\"><Button size=\"sm\" variant=\"tertiary\" disabled={item.status!=='draft'||!item.originLabel} onClick={()=>openExistingMeasurement(item.id,item.originLabel)}>Editar</Button><Button size=\"sm\" variant=\"secondary\" disabled={item.status!=='draft'} onClick={()=>setMeasurementDeleteId(item.id)}>Excluir</Button></div></td></tr>)}</tbody></table>{rows.length===0&&emptyRow('Crie a primeira medição do contrato.')}</div></>;"""
new = """      body=<>{toolbar('Nova medição','measurement')}{sheetHead(measurements.length,undefined,undefined,contract.measuredNet+draftMeasurementValue)}<div className=\"engineering-sheet__table-wrap\"><table className=\"engineering-sheet__table\"><thead><tr><th>Competência</th><th>Nº medição</th><th>Origem</th><th>Status</th><th>Valor da medição</th><th>Contrato</th><th>Evolução geral</th><th>Ações</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td><strong>{monthLabel(item.competence)}</strong></td><td>{item.measurementNumber||'—'}</td><td>{item.originLabel||'—'}</td><td><span className={`engineering-status engineering-status--${item.status}`}>{labelStatus(item.status)}</span></td><td><strong className=\"engineering-positive\">{currency.format(measurementValue(item.id))}</strong></td><td>{contract.contractNumber}</td><td>{progress.toFixed(1)}%</td><td><div className=\"engineering-sheet__row-actions\"><Button size=\"sm\" variant=\"tertiary\" disabled={item.status!=='draft'||!item.originLabel} onClick={()=>openExistingMeasurement(item.id,item.originLabel)}>Editar</Button><Button size=\"sm\" variant=\"secondary\" disabled={item.status!=='draft'} onClick={()=>setMeasurementDeleteId(item.id)}>Excluir</Button></div></td></tr>)}</tbody></table>{rows.length===0&&emptyRow('Crie a primeira medição do contrato.')}</div></>;"""
if old not in text:
    raise SystemExit('measurement table anchor not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('patched EngineeringContractWorkspace.tsx')
