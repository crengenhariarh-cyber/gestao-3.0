from pathlib import Path

ui=Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s=ui.read_text()
needle="import './approved-measurement-sheet.css';"
if "measurement-scroll-fix.css" not in s:
    if needle not in s: raise SystemExit('approved stylesheet import not found')
    s=s.replace(needle, needle+"\nimport './measurement-scroll-fix.css';")
ui.write_text(s)

repo=Path('src/modules/engineering/infrastructure/LegacyMeasurementParityRepository.ts')
r=repo.read_text()
old="type ScopeRow={origin_key:string;service_code:string;scope_active:boolean;start_floor:number|string|null;scope_floors:string[]|null;scope_units:string[]|null};"
new="type ScopeRow={origin_key:string;service_code:string;scope_active:boolean;start_floor:number|string|null;scope_floors:string[]|null;scope_units:string[]|null;scoped_quantity:number|string|null};"
if old in r:r=r.replace(old,new)
elif new not in r:raise SystemExit('ScopeRow anchor not found')
old="client.from('engineering_measurement_service_scopes').select('origin_key,service_code,scope_active,start_floor,scope_floors,scope_units')"
new="client.from('engineering_measurement_service_scopes').select('origin_key,service_code,scope_active,start_floor,scope_floors,scope_units,scoped_quantity')"
if old in r:r=r.replace(old,new)
elif new not in r:raise SystemExit('scope select anchor not found')
old="""  const scope=scopeFor(scopeRows,originName,code);
  return {
    legacyServiceId:row.id,"""
new="""  const scope=scopeFor(scopeRows,originName,code);
  const contractedQuantity=number(row.contracted_quantity);
  const persistedScopedQuantity=scope?.scoped_quantity===null||scope?.scoped_quantity===undefined?contractedQuantity:number(scope.scoped_quantity);
  const scopeStillMatchesContract=Boolean(scope?.scope_active)&&Math.abs(persistedScopedQuantity-contractedQuantity)<0.0001;
  return {
    legacyServiceId:row.id,"""
if old in r:r=r.replace(old,new)
elif new not in r:raise SystemExit('stage scope anchor not found')
r=r.replace("    contractedQuantity:number(row.contracted_quantity),","    contractedQuantity,",1)
r=r.replace("    scopeActive:Boolean(scope?.scope_active),\n    startFloor:scope?.start_floor===null||scope?.start_floor===undefined?null:number(scope.start_floor),\n    scopeFloors:Array.isArray(scope?.scope_floors)?scope.scope_floors.map(value=>safeText(value)):[],\n    scopeUnits:Array.isArray(scope?.scope_units)?scope.scope_units.map(value=>safeText(value)):[],","    scopeActive:scopeStillMatchesContract,\n    startFloor:scopeStillMatchesContract&&scope?.start_floor!==null&&scope?.start_floor!==undefined?number(scope.start_floor):null,\n    scopeFloors:scopeStillMatchesContract&&Array.isArray(scope?.scope_floors)?scope.scope_floors.map(value=>safeText(value)):[],\n    scopeUnits:scopeStillMatchesContract&&Array.isArray(scope?.scope_units)?scope.scope_units.map(value=>safeText(value)):[],",1)
repo.write_text(r)

flow=ui.read_text()
old="""function stageReferences(model:MeasurementParityModel,origin:MeasurementParityOrigin,stage:MeasurementParityStage):string[]{
  const base=origin.type==='tower'?buildTowerReferences(model,origin):genericUnitReferences(stage);"""
new="""function exactTowerReferences(origin:MeasurementParityOrigin,stage:MeasurementParityStage):string[]{
  const total=Math.max(0,Math.floor(stage.contractedQuantity));
  if(!unitBased(stage)||total<=0||total>500||Math.abs(stage.contractedQuantity-total)>0.0001||total%8!==0)return [];
  const refs:string[]=[];
  let remaining=total;
  if(origin.hasGround&&remaining>=8){for(let unit=1;unit<=8;unit++)refs.push(`TR-${String(unit).padStart(2,'0')}`);remaining-=8;}
  let floor=1;
  while(remaining>0){const take=Math.min(8,remaining);for(let unit=1;unit<=take;unit++)refs.push(`${floor}${String(unit).padStart(2,'0')}`);remaining-=take;floor+=1;}
  return refs;
}

function stageReferences(model:MeasurementParityModel,origin:MeasurementParityOrigin,stage:MeasurementParityStage):string[]{
  const exact=origin.type==='tower'&&!stage.scopeActive?exactTowerReferences(origin,stage):[];
  const base=exact.length?exact:origin.type==='tower'?buildTowerReferences(model,origin):genericUnitReferences(stage);"""
if old in flow:flow=flow.replace(old,new)
elif new not in flow:raise SystemExit('stageReferences anchor not found')
ui.write_text(flow)
