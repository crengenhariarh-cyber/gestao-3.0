from pathlib import Path

path = Path('src/modules/engineering/ui/EngineeringOperationsPanel.tsx')
s = path.read_text(encoding='utf-8')

old = """  const suggestedMeasurementNumber=(()=>{if(!focusedContractId)return '';const used=new Set((data?.measurements??[]).filter(item=>item.contractId===focusedContractId).map(item=>Number(item.measurementNumber)).filter(value=>Number.isInteger(value)&&value>0));let next=1;while(used.has(next))next+=1;return String(next).padStart(3,'0');})();
"""
new = """  const nextMeasurementSequence=(()=>{
    if(!focusedContractId)return {number:'',competence:currentMonth()};
    const contractMeasurements=(data?.measurements??[]).filter(item=>item.contractId===focusedContractId);
    const used=new Set(contractMeasurements.map(item=>Number(item.measurementNumber)).filter(value=>Number.isInteger(value)&&value>0));
    let next=1;while(used.has(next))next+=1;
    const anchors=contractMeasurements.map(item=>({number:Number(item.measurementNumber),competence:item.competence?.slice(0,7)??''})).filter(item=>Number.isInteger(item.number)&&item.number>0&&/^\\d{4}-\\d{2}$/.test(item.competence));
    const anchor=anchors.sort((a,b)=>Math.abs(a.number-next)-Math.abs(b.number-next))[0];
    let competence=currentMonth();
    if(anchor){
      const [year,month]=anchor.competence.split('-').map(Number);
      const date=new Date(Date.UTC(year,month-1+(next-anchor.number),1));
      competence=`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
    }
    return {number:String(next).padStart(4,'0'),competence};
  })();
  const suggestedMeasurementNumber=nextMeasurementSequence.number;
  const suggestedMeasurementCompetence=nextMeasurementSequence.competence;
"""

if old not in s and 'const nextMeasurementSequence=' not in s:
    raise SystemExit('measurement sequence anchor not found')
if old in s:
    s = s.replace(old, new, 1)

old_open = """    if(next==='measurement'&&suggestedMeasurementNumber)base.measurementNumber=suggestedMeasurementNumber;
"""
new_open = """    if(next==='measurement'){
      if(suggestedMeasurementNumber)base.measurementNumber=suggestedMeasurementNumber;
      if(suggestedMeasurementCompetence)base.competence=suggestedMeasurementCompetence;
    }
"""
if old_open not in s and new_open.strip() not in s:
    raise SystemExit('measurement open anchor not found')
if old_open in s:
    s = s.replace(old_open, new_open, 1)

path.write_text(s, encoding='utf-8')
print('Automatic measurement number/competence sequencing applied.')
