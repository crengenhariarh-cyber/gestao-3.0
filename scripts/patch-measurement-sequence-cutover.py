from pathlib import Path

p=Path('src/modules/engineering/ui/EngineeringOperationsPanel.tsx')
s=p.read_text()

anchor="  const selectedMeasurementOrigin=measurementOrigins.find(item=>item.key===(form.originKey??''));\n"
insert=anchor+"  const suggestedMeasurementNumber=(()=>{if(!focusedContractId)return '';const used=new Set((data?.measurements??[]).filter(item=>item.contractId===focusedContractId).map(item=>Number(item.measurementNumber)).filter(value=>Number.isInteger(value)&&value>0));let next=1;while(used.has(next))next+=1;return String(next).padStart(3,'0');})();\n"
if 'const suggestedMeasurementNumber=' not in s:
    if anchor not in s: raise SystemExit('sequence anchor not found')
    s=s.replace(anchor,insert,1)

old="    if(focusedContractId&&['contractStatus','contractService','allocation','addendum','measurement'].includes(next))base.contractId=focusedContractId;\n    if(focusedContract?.workId&&['structure','allocation','provisional','productionPeriod'].includes(next))base.workId=focusedContract.workId;\n    setForm(base);setKind(next);"
new="    if(focusedContractId&&['contractStatus','contractService','allocation','addendum','measurement'].includes(next))base.contractId=focusedContractId;\n    if(focusedContract?.workId&&['structure','allocation','provisional','productionPeriod'].includes(next))base.workId=focusedContract.workId;\n    if(next==='measurement'&&suggestedMeasurementNumber)base.measurementNumber=suggestedMeasurementNumber;\n    setForm(base);setKind(next);"
if old not in s: raise SystemExit('open measurement anchor not found')
s=s.replace(old,new,1)

p.write_text(s)
print('measurement sequential numbering patch applied')
