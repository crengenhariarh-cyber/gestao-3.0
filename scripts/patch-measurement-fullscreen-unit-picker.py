from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
tsx = root / 'src/modules/engineering/ui/GuidedMeasurementFlow.tsx'
css = root / 'src/modules/engineering/ui/guided-measurement-flow.css'
s = tsx.read_text()

s = s.replace("const unitBased=(stage:MeasurementParityStage)=>/^(un|und|unid|unidade|unidades)$/i.test(stage.unit.trim());", "const unitBased=(stage:MeasurementParityStage)=>/^(apto|apt|apartamento|apartamentos|un|und|unid|unidade|unidades)$/i.test(stage.unit.trim());")

old = '''function buildTowerReferences(model:MeasurementParityModel,origin:MeasurementParityOrigin):string[]{
  if(model.enterpriseType==='casas'&&model.houses.length)return Array.from(new Set(model.houses.map(value=>value.trim()).filter(Boolean)));
  const floors=Math.max(0,Number(origin.floorCount||0)+(origin.hasGround?1:0));
  const quantities=origin.services.filter(unitBased).map(service=>Number(service.contractedQuantity||0)).filter(value=>value>0);
  const perFloor=floors>0&&quantities.length?Math.max(1,Math.round(Math.max(...quantities)/floors)):8;
  const references:string[]=[];
  for(let floor=1;floor<=floors;floor++)for(let unit=1;unit<=perFloor;unit++)references.push(`${floor}${String(unit).padStart(2,'0')}`);
  return references;
}'''
new = '''function buildTowerReferences(model:MeasurementParityModel,origin:MeasurementParityOrigin):string[]{
  if(model.enterpriseType==='casas'&&model.houses.length)return Array.from(new Set(model.houses.map(value=>value.trim()).filter(Boolean)));
  const numericFloors=Math.max(0,Number(origin.floorCount||0));
  const levelCount=numericFloors+(origin.hasGround?1:0);
  const quantities=origin.services.filter(unitBased).map(service=>Number(service.contractedQuantity||0)).filter(value=>value>0);
  const perFloor=levelCount>0&&quantities.length?Math.max(1,Math.round(Math.max(...quantities)/levelCount)):8;
  const references:string[]=[];
  if(origin.hasGround)for(let unit=1;unit<=perFloor;unit++)references.push(`TR-${String(unit).padStart(2,'0')}`);
  for(let floor=1;floor<=numericFloors;floor++)for(let unit=1;unit<=perFloor;unit++)references.push(`${floor}${String(unit).padStart(2,'0')}`);
  return references;
}'''
if old not in s:
    raise SystemExit('buildTowerReferences fragment not found')
s = s.replace(old, new, 1)

anchor = "const referenceFloor=(reference:string)=>{const match=reference.match(/^(\\d{1,2})\\d{2}$/);return match?String(Number(match[1])):null;};"
replacement = anchor + "\nconst referenceLevel=(reference:string)=>reference.startsWith('TR-')?'TR':referenceFloor(reference)??'OUTROS';\nconst referenceLevelLabel=(level:string)=>level==='TR'?'Térreo':level==='OUTROS'?'Outras unidades':`${level}º pavimento`;"
if anchor not in s:
    raise SystemExit('referenceFloor anchor not found')
s = s.replace(anchor, replacement, 1)

old_visible = "  const visibleReferences=availableReferences.filter(reference=>!normalize(search)||normalize(reference).includes(normalize(search)));\n  const effectiveQuantity=referenceMode?selectedUnits.length:Number(manualQuantity.replace(',','.'))||0;"
new_visible = "  const visibleReferences=availableReferences.filter(reference=>!normalize(search)||normalize(reference).includes(normalize(search)));\n  const groupedVisibleReferences=useMemo(()=>{const groups=new Map<string,string[]>();for(const reference of visibleReferences){const level=referenceLevel(reference);groups.set(level,[...(groups.get(level)??[]),reference]);}const rank=(level:string)=>level==='TR'?-1:level==='OUTROS'?9999:Number(level);return [...groups.entries()].sort((a,b)=>rank(a[0])-rank(b[0]));},[visibleReferences]);\n  const effectiveQuantity=referenceMode?selectedUnits.length:Number(manualQuantity.replace(',','.'))||0;"
if old_visible not in s:
    raise SystemExit('visibleReferences fragment not found')
s = s.replace(old_visible, new_visible, 1)

s = s.replace('<Dialog open title="Lançar medição" onClose={onClose} onBack={onClose}>', '<Dialog open variant="measurement-fullscreen" title="Lançar medição" onClose={onClose} onBack={onClose}>')
s = s.replace('<Dialog open title="Lançar medição" description="Fluxo sequencial por origem, serviço e unidade" onClose={onClose} onBack={onClose}>', '<Dialog open variant="measurement-fullscreen" title="Lançar medição" description="Fluxo sequencial por origem, serviço e unidade" onClose={onClose} onBack={onClose}>')

old_list = '''      <div className="guided-measurement-picker__list">{visibleReferences.map(reference=><label key={reference} className={selectedUnits.includes(reference)?'is-selected':''}><input type="checkbox" checked={selectedUnits.includes(reference)} disabled={!selectedUnits.includes(reference)&&selectedUnits.length>=maxSelectable} onChange={()=>toggleReference(reference)}/><span>{reference}</span></label>)}</div>'''
new_list = '''      <div className="guided-measurement-picker__list guided-measurement-picker__list--floors">{groupedVisibleReferences.map(([level,references])=><section className="guided-measurement-floor" key={level}><header><strong>{referenceLevelLabel(level)}</strong><span>{references.filter(reference=>selectedUnits.includes(reference)).length}/{references.length} selecionado(s)</span></header><div className="guided-measurement-floor__units">{references.map(reference=><label key={reference} className={selectedUnits.includes(reference)?'is-selected':''}><input type="checkbox" checked={selectedUnits.includes(reference)} disabled={!selectedUnits.includes(reference)&&selectedUnits.length>=maxSelectable} onChange={()=>toggleReference(reference)}/><span>{reference.startsWith('TR-')?`Apto ${reference.slice(3)}`:`Apto ${reference}`}</span></label>)}</div></section>)}</div>'''
if old_list not in s:
    raise SystemExit('unit picker list fragment not found')
s = s.replace(old_list, new_list, 1)

tsx.write_text(s)

c = css.read_text()
addition = '''\n.ui-dialog-backdrop[data-variant="measurement-fullscreen"]{padding:0}.ui-dialog-backdrop[data-variant="measurement-fullscreen"] .ui-dialog{width:100vw;height:100dvh;max-width:none;max-height:none;border-radius:0}.ui-dialog-backdrop[data-variant="measurement-fullscreen"] .ui-dialog__content{min-height:0;overflow:auto}.guided-measurement-picker{padding:0}.guided-measurement-picker__panel{width:100vw;height:100dvh;max-height:none;border-radius:0}.guided-measurement-picker__list--floors{align-content:start}.guided-measurement-floor{display:grid;gap:10px;border:1px solid #dbe3ea;border-radius:20px;padding:14px;background:#f8fafc}.guided-measurement-floor>header{display:flex;justify-content:space-between;gap:12px;align-items:center}.guided-measurement-floor>header strong{font-size:1rem}.guided-measurement-floor>header span{font-size:.82rem;color:#64748b;font-weight:800}.guided-measurement-floor__units{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}.guided-measurement-floor__units label{min-height:54px!important;border-radius:14px!important;padding:0 14px!important}.guided-measurement-floor__units input{width:22px!important;height:22px!important}@media(max-width:760px){.guided-measurement-floor__units{grid-template-columns:repeat(2,minmax(0,1fr))}.guided-measurement-floor{padding:12px}.guided-measurement-floor__units label{font-size:.95rem!important}}\n'''
if 'data-variant="measurement-fullscreen"' not in c:
    c += addition
css.write_text(c)
print('measurement fullscreen unit picker patch applied')
