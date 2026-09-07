from pathlib import Path

repo=Path('src/modules/engineering/infrastructure/LegacyMeasurementParityRepository.ts')
s=repo.read_text()

old="""  const addendumIds=addenda.filter(item=>item.status==='effective').map(item=>item.id);\n  const addendumLinesResponse=addendumIds.length\n"""
new="""  const measurableAddenda=addenda.filter(item=>item.status!=='cancelled');\n  const addendumIds=measurableAddenda.map(item=>item.id);\n  const addendumLinesResponse=addendumIds.length\n"""
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('addendum status anchor not found')

old="""  const origins:MeasurementParityOrigin[]=profiles.map(profile=>{\n    const contractStages=contractServices\n      .filter(row=>normalize(originFromNotes(row.notes))===normalize(profile.origin_name))\n      .map(row=>stageFromContract(row,scopeRows));\n    const addendumStages=addendumLines\n      .filter(row=>normalize(originFromNotes(row.notes))===normalize(profile.origin_name))\n      .map(stageFromAddendum);\n    return {\n      id:profile.id,\n      name:profile.origin_name,\n      type:profile.origin_type,\n      floorCount:number(profile.floor_count),\n      hasGround:Boolean(profile.has_ground),\n      modes:Array.isArray(profile.modes)?profile.modes.map(value=>safeText(value)):[],\n      services:[...contractStages,...addendumStages],\n    };\n  }).filter(origin=>origin.services.length>0);\n"""
new="""  const structuralOrigins:MeasurementParityOrigin[]=profiles.filter(profile=>profile.origin_type!=='addendum').map(profile=>{\n    const contractStages=contractServices\n      .filter(row=>normalize(originFromNotes(row.notes))===normalize(profile.origin_name))\n      .map(row=>stageFromContract(row,scopeRows));\n    return {\n      id:profile.id,\n      name:profile.origin_name,\n      type:profile.origin_type,\n      floorCount:number(profile.floor_count),\n      hasGround:Boolean(profile.has_ground),\n      modes:Array.isArray(profile.modes)?profile.modes.map(value=>safeText(value)):[],\n      services:contractStages,\n    };\n  }).filter(origin=>origin.services.length>0);\n\n  const addendumOrigins:MeasurementParityOrigin[]=measurableAddenda.map(addendum=>({\n    id:addendum.id,\n    name:addendum.addendum_number,\n    type:'addendum',\n    floorCount:0,\n    hasGround:false,\n    modes:['unidade','percentual','valor'],\n    services:addendumLines.filter(row=>row.addendum_id===addendum.id).map(stageFromAddendum),\n  })).filter(origin=>origin.services.length>0);\n\n  const origins=[...structuralOrigins,...addendumOrigins];\n"""
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('origins anchor not found')
repo.write_text(s)

css=Path('src/modules/engineering/ui/approved-measurement-sheet.css')
c=css.read_text()
mobile="""\n@media(max-width:640px){\n  .ui-dialog-backdrop[data-variant=\"measurement-fullscreen\"] .ui-dialog{height:100dvh;max-height:100dvh;overflow:hidden}\n  .ui-dialog-backdrop[data-variant=\"measurement-fullscreen\"] .ui-dialog__content{min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}\n  .approved-measurement-sheet{min-height:0}\n  .approved-measurement-sheet__table-card{display:block;min-height:48dvh}\n  .approved-measurement-sheet__table-wrap{display:block;width:100%;height:48dvh;max-height:48dvh;overflow:auto;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y}\n  .approved-measurement-sheet__table{min-width:1180px}\n  .approved-measurement-sheet__bottom-actions{position:sticky;bottom:0}\n}\n"""
if 'height:48dvh' not in c:
    c += mobile
css.write_text(c)
