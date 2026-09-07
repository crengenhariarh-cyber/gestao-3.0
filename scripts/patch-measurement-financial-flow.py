from pathlib import Path
import re

root=Path('.')

def replace_required(text, old, new, label):
    if old in text:
        return text.replace(old,new)
    if new in text:
        return text
    raise SystemExit(f'{label} not found')

# Repository contract
p=root/'src/modules/engineering/application/EngineeringOperationsRepository.ts'
s=p.read_text()
s=replace_required(s,"export interface EngineeringMeasurementOption { id: string; contractId: string; competence: string; status: string; }", "export interface EngineeringMeasurementOption { id:string; contractId:string; competence:string; status:string; measurementNumber:string; dueDate:string|null; expectedPaymentDate:string|null; paymentMethod:string|null; originLabel:string|null; }",'measurement option')
s=replace_required(s,"createMeasurement(scope: EngineeringScope, input: { contractId: string; competence: string; notes?: string | null }): Promise<void>;", "createMeasurement(scope: EngineeringScope, input: { contractId:string; competence:string; measurementNumber:string; dueDate?:string|null; expectedPaymentDate?:string|null; paymentMethod?:string|null; originLabel?:string|null; notes?:string|null }): Promise<void>;",'create measurement contract')
p.write_text(s)

# Supabase operations repository
p=root/'src/modules/engineering/infrastructure/SupabaseEngineeringOperationsRepository.ts'
s=p.read_text()
s=replace_required(s,"type MeasurementRow={id:string;contract_id:string;competence:string;status:string};", "type MeasurementRow={id:string;contract_id:string;competence:string;status:string;measurement_number:string|null;due_date:string|null;expected_payment_date:string|null;payment_method:string|null;origin_label:string|null};",'measurement row')
s=replace_required(s,"this.client.from('measurements').select('id,contract_id,competence,status')", "this.client.from('measurements').select('id,contract_id,competence,status,measurement_number,due_date,expected_payment_date,payment_method,origin_label')",'measurement select')
s=replace_required(s,"measurements:(measurements.data??[]).map(row=>({id:row.id,contractId:row.contract_id,competence:row.competence,status:row.status}))", "measurements:(measurements.data??[]).map(row=>({id:row.id,contractId:row.contract_id,competence:row.competence,status:row.status,measurementNumber:row.measurement_number??'',dueDate:row.due_date,expectedPaymentDate:row.expected_payment_date,paymentMethod:row.payment_method,originLabel:row.origin_label}))",'measurement map')
if "measurementNumber=required(input.measurementNumber,'Número da medição')" not in s:
    pattern=r"  async createMeasurement\(scope:EngineeringScope,input:Parameters<EngineeringOperationsRepository\['createMeasurement'\]>\[1\]\)\{.*?\n  async addMeasurementLine"
    m=re.search(pattern,s,re.S)
    if not m: raise SystemExit('createMeasurement implementation not found')
    replacement="""  async createMeasurement(scope:EngineeringScope,input:Parameters<EngineeringOperationsRepository['createMeasurement']>[1]){const measurementNumber=required(input.measurementNumber,'Número da medição');const duplicate=await this.client.from('measurements').select('id').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',required(input.contractId,'Contrato')).eq('measurement_number',measurementNumber).maybeSingle();if(duplicate.error)throw duplicate.error;if(duplicate.data)throw new Error('Já existe uma medição com este número neste contrato.');const r=await this.client.from('measurements').insert({tenant_id:scope.tenantId,company_id:scope.companyId,contract_id:input.contractId,competence:month(input.competence),measurement_number:measurementNumber,due_date:input.dueDate||null,expected_payment_date:input.expectedPaymentDate||null,payment_method:input.paymentMethod||null,origin_label:input.originLabel||null,notes:input.notes||null});if(r.error)throw r.error;}
  async addMeasurementLine"""
    s=s[:m.start()]+replacement+s[m.end():]
p.write_text(s)

# Main measurement creation form
p=root/'src/modules/engineering/ui/EngineeringOperationsPanel.tsx'
s=p.read_text()
s=replace_required(s,"measurement:{contractId:'',competence:currentMonth(),notes:''}", "measurement:{contractId:'',competence:currentMonth(),measurementNumber:'',dueDate:'',expectedPaymentDate:'',paymentMethod:'PIX',originLabel:'',notes:''}",'measurement defaults')
s=replace_required(s,"operations.createMeasurement({contractId:form.contractId||focusedContractId||'',competence:form.competence??currentMonth(),notes:form.notes||null})", "operations.createMeasurement({contractId:form.contractId||focusedContractId||'',competence:form.competence??currentMonth(),measurementNumber:form.measurementNumber??'',dueDate:form.dueDate||null,expectedPaymentDate:form.expectedPaymentDate||null,paymentMethod:form.paymentMethod||null,originLabel:form.originLabel||null,notes:form.notes||null})",'measurement submit')
old="case 'measurement':content=shell(<>{!focusedContractId&&select('Contrato','contractId',contractOptions,true)}{input('Competência','competence','month',true)}{input('Observações','notes')}</>,'INSS, ISS e retenção técnica serão carregados automaticamente conforme o contrato.');break;"
new="case 'measurement':content=shell(<>{!focusedContractId&&select('Contrato','contractId',contractOptions,true)}{input('Competência','competence','month',true)}{input('Nº medição','measurementNumber','text',true)}{input('Vencimento previsto','dueDate','date')}{input('Data prevista para pagamento','expectedPaymentDate','date')}{input('Forma de pagamento','paymentMethod')}{input('Torre / Aditivo','originLabel')}{input('Observações','notes')}</>,'INSS, ISS e retenção técnica serão carregados automaticamente conforme o contrato. Os dados financeiros acompanharão a medição até o contas a receber.');break;"
s=replace_required(s,old,new,'measurement form')
p.write_text(s)

# Parity model: expose number in selector
p=root/'src/modules/engineering/infrastructure/LegacyMeasurementParityRepository.ts'
s=p.read_text()
s=replace_required(s,"export interface MeasurementParityMeasurement { id:string; competence:string; status:string }", "export interface MeasurementParityMeasurement { id:string; competence:string; status:string; measurementNumber:string }",'parity measurement interface')
s=replace_required(s,"type MeasurementRow={id:string;competence:string;status:string};", "type MeasurementRow={id:string;competence:string;status:string;measurement_number:string|null};",'parity measurement row')
s=replace_required(s,"client.from('measurements').select('id,competence,status')", "client.from('measurements').select('id,competence,status,measurement_number')",'parity measurement select')
s=replace_required(s,"measurements:measurements.map(item=>({id:item.id,competence:item.competence,status:item.status}))", "measurements:measurements.map(item=>({id:item.id,competence:item.competence,status:item.status,measurementNumber:item.measurement_number??''}))",'parity measurement map')
p.write_text(s)

p=root/'src/modules/engineering/ui/GuidedMeasurementFlow.tsx'
s=p.read_text()
s=replace_required(s,"label:`${item.competence.slice(0,7)} · rascunho`", "label:`${item.measurementNumber?`Medição ${item.measurementNumber} · `:''}${item.competence.slice(0,7)} · rascunho`",'measurement selector label')
p.write_text(s)
