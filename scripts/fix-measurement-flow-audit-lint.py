from pathlib import Path
p=Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s=p.read_text()
s=s.replace("export function GuidedMeasurementFlow({scope,contractId,initialMeasurementId='',initialOriginId='',initialOriginName='',draftHeader=null,onDraftPersisted,onChanged,onClose}:Props){","export function GuidedMeasurementFlow({scope,contractId,initialMeasurementId='',initialOriginId='',draftHeader=null,onDraftPersisted,onChanged,onClose}:Props){")
s=s.replace("},[measurementId,snapshotMeasurement?.id,draftHeader]);","},[measurementId,snapshotMeasurement,draftHeader]);")
s=s.replace("}catch{}}\n  function closeFlow", "}catch{return;}}\n  function closeFlow")
p.write_text(s)
print('measurement audit lint fixes applied')
