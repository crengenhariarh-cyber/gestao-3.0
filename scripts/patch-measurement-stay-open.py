from pathlib import Path
p=Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s=p.read_text()
old="activeMeasurementId=created.id;setMeasurementId(created.id);setModel(refreshed);onDraftPersisted?.();onChanged();"
new="activeMeasurementId=created.id;setMeasurementId(created.id);setModel(refreshed);onDraftPersisted?.();"
if old not in s: raise SystemExit('draft creation anchor not found')
s=s.replace(old,new,1)
old="const nextModel=await reload();onChanged();setUnitPickerOpen(false);"
new="const nextModel=await reload();setUnitPickerOpen(false);"
if old not in s: raise SystemExit('save reload anchor not found')
s=s.replace(old,new,1)
anchor="  if(loading&&!model)return <Dialog open variant=\"measurement-fullscreen\" title=\"Lançar medição\" onClose={onClose} onBack={onClose}><LoadingState label=\"Carregando medição…\"/></Dialog>;"
insert="  function closeFlow(){onChanged();onClose();}\n\n"+anchor.replace('onClose={onClose} onBack={onClose}','onClose={closeFlow} onBack={closeFlow}')
if anchor not in s: raise SystemExit('loading dialog anchor not found')
s=s.replace(anchor,insert,1)
s=s.replace('if(!model)return <Dialog open variant="measurement-fullscreen" title="Lançar medição" onClose={onClose} onBack={onClose}>','if(!model)return <Dialog open variant="measurement-fullscreen" title="Lançar medição" onClose={closeFlow} onBack={closeFlow}>',1)
s=s.replace('description={origin?\'Elabore a medição dos serviços desta origem.\':\'Selecione a origem da medição.\'} onClose={onClose} onBack={onClose}>','description={origin?\'Elabore a medição dos serviços desta origem.\':\'Selecione a origem da medição.\'} onClose={closeFlow} onBack={closeFlow}>',1)
s=s.replace('<Button variant="secondary" onClick={onClose}>Cancelar medição</Button>','<Button variant="secondary" onClick={closeFlow}>Cancelar medição</Button>',1)
s=s.replace('<Button onClick={onClose}>✓ Finalizar medição</Button>','<Button onClick={closeFlow}>✓ Finalizar medição</Button>',1)
p.write_text(s)
