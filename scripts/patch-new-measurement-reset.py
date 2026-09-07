from pathlib import Path

p=Path('src/modules/engineering/ui/EngineeringContractWorkspace.tsx')
s=p.read_text()
old="  function open(kind:FormKind){if(kind==='measurementLine'){setGuidedMeasurementOpen(true);return;}setFormKind(kind);}"
new="  function open(kind:FormKind){if(kind==='measurementLine'){setGuidedMeasurementId('');setGuidedMeasurementOriginId('');setGuidedMeasurementOriginName('');setGuidedMeasurementDraft(null);setGuidedMeasurementOpen(true);return;}setFormKind(kind);}"
if old not in s:
    raise SystemExit('open measurementLine anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
print('new measurement reset applied')
