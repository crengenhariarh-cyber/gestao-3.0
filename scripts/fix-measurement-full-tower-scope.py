from pathlib import Path

TSX = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
CSS = Path('src/modules/engineering/ui/guided-measurement-flow.css')

s = TSX.read_text()

old_scope = """function stageReferences(model:MeasurementParityModel,origin:MeasurementParityOrigin,stage:MeasurementParityStage):string[]{\n  const base=origin.type==='tower'?buildTowerReferences(model,origin):genericUnitReferences(stage);\n  if(stage.scopeUnits.length){const allowed=new Set(stage.scopeUnits.map(normalize));return base.filter(reference=>allowed.has(normalize(reference)));}\n"""
new_scope = """function stageReferences(model:MeasurementParityModel,origin:MeasurementParityOrigin,stage:MeasurementParityStage):string[]{\n  const base=origin.type==='tower'?buildTowerReferences(model,origin):genericUnitReferences(stage);\n  // Quando o quantitativo contratado cobre a torre inteira, o cadastro da medição\n  // deve refletir todas as unidades atuais, mesmo que exista um escopo antigo\n  // salvo antes da correção do quantitativo (ex.: 56 -> 96 apartamentos).\n  if(unitBased(stage)&&base.length>0&&stage.contractedQuantity>=base.length)return base;\n  if(stage.scopeUnits.length){const allowed=new Set(stage.scopeUnits.map(normalize));return base.filter(reference=>allowed.has(normalize(reference)));}\n"""
if old_scope in s:
    s = s.replace(old_scope, new_scope, 1)
elif 'stage.contractedQuantity>=base.length' not in s:
    raise SystemExit('stageReferences anchor not found')

old_bar = '''      <div className="guided-measurement-picker__bar approved-unit-picker__toolbar">{refs.length>0?<><Input label="Buscar apartamento" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar apartamento (ex.: 101, 203, 401...)"/><Button variant="secondary" onClick={()=>setSelectedUnits([])}>Limpar seleção</Button><p><span>Selecionados:</span> <strong>{selectedUnits.length} un</strong><br/><span>Valor total:</span> <strong>{currency.format(selectedUnits.length*stage.unitPrice)}</strong></p></>:<Input label="Quantidade nesta medição" value={manualQuantity} onChange={event=>setManualQuantity(event.target.value)} inputMode="decimal" placeholder="0,00"/>}</div>'''
new_bar = '''      <div className="guided-measurement-picker__bar approved-unit-picker__toolbar approved-unit-picker__toolbar--compact">{refs.length>0?<><Button variant="secondary" onClick={()=>setSelectedUnits([])} disabled={selectedUnits.length===0}>Limpar seleção</Button><p><span>Selecionados:</span> <strong>{selectedUnits.length} un</strong> <span>· Valor total:</span> <strong>{currency.format(selectedUnits.length*stage.unitPrice)}</strong></p></>:<Input label="Quantidade nesta medição" value={manualQuantity} onChange={event=>setManualQuantity(event.target.value)} inputMode="decimal" placeholder="0,00"/>}</div>'''
if old_bar in s:
    s = s.replace(old_bar, new_bar, 1)
elif 'approved-unit-picker__toolbar--compact' not in s:
    raise SystemExit('approved unit toolbar anchor not found')

TSX.write_text(s)

css = CSS.read_text()
marker = '/* Full-tower scope + compact unit toolbar 2026-09-07 */'
if marker not in css:
    css += r'''

/* Full-tower scope + compact unit toolbar 2026-09-07 */
.approved-unit-picker__toolbar--compact{grid-template-columns:auto minmax(240px,1fr)!important;align-items:center!important;padding:9px 22px!important;min-height:58px}.approved-unit-picker__toolbar--compact>p{grid-column:auto!important;justify-self:end!important;min-height:38px!important;margin:0!important}.approved-unit-picker__toolbar--compact>button{min-height:40px}.approved-unit-picker__floors{padding-top:8px!important}@media(max-width:640px){.approved-unit-picker__toolbar--compact{grid-template-columns:1fr!important;padding:8px 12px!important}.approved-unit-picker__toolbar--compact>p{justify-self:start!important}.approved-unit-picker__toolbar--compact>button{width:100%}}
'''
    CSS.write_text(css)
