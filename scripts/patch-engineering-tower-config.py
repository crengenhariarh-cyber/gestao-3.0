from pathlib import Path

repo = Path('src/modules/engineering/application/EngineeringOperationsRepository.ts')
s = repo.read_text()
if 'updateStructure(scope: EngineeringScope' not in s:
    marker = "  createStructure(scope: EngineeringScope, input: { workId: string; parentId?: string | null; type: 'tower'|'block'|'sector'|'quad'|'floor'|'unit'|'house'|'area'|'basement'|'ground_floor'|'roof'|'other'; code?: string | null; name: string }): Promise<void>;"
    assert marker in s
    s = s.replace(marker, marker + "\n  updateStructure(scope: EngineeringScope, input: { structureId: string; code?: string | null; name: string; metadata?: Record<string, unknown> | null }): Promise<void>;")
repo.write_text(s)

infra = Path('src/modules/engineering/infrastructure/SupabaseEngineeringOperationsRepository.ts')
s = infra.read_text()
if "async updateStructure(scope:EngineeringScope" not in s:
    lines = s.splitlines()
    for i, line in enumerate(lines):
        if line.startswith("  async createStructure(scope:EngineeringScope"):
            lines.insert(i + 1, "  async updateStructure(scope:EngineeringScope,input:Parameters<EngineeringOperationsRepository['updateStructure']>[1]){const r=await this.client.from('work_structures').update({code:input.code||null,name:required(input.name,'Estrutura'),metadata:input.metadata??null,updated_at:new Date().toISOString()}).eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',required(input.structureId,'Estrutura'));if(r.error)throw r.error;}")
            break
    else: raise AssertionError('createStructure not found')
    s = '\n'.join(lines) + ('\n' if s.endswith('\n') else '')
infra.write_text(s)

hook = Path('src/modules/engineering/ui/useEngineeringOperations.ts')
s = hook.read_text()
if 'updateStructure:(input:' not in s:
    lines = s.splitlines()
    for i, line in enumerate(lines):
        if 'createStructure:(input:' in line:
            lines.insert(i + 1, "    updateStructure:(input:Parameters<typeof repository.updateStructure>[1])=>execute(()=>repository.updateStructure(scope,input),'Estrutura atualizada.'),")
            break
    else: raise AssertionError('createStructure hook not found')
    s = '\n'.join(lines) + ('\n' if s.endswith('\n') else '')
hook.write_text(s)

component = Path('src/modules/engineering/ui/EditEngineeringStructureDialog.tsx')
if not component.exists():
    component.write_text('''import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { useEngineeringOperations } from './useEngineeringOperations';

interface Props { open:boolean; scope:{tenantId:string;companyId:string}; structure:{id:string;name:string;code:string|null;metadata:Record<string,unknown>|null}; onClose:()=>void; onSaved:()=>void; }
type TowerConfig={floorCount:number;firstFloor:number;unitsPerFloor:number;hasGroundFloor:boolean;groundFloorUnits:number;hasRoof:boolean;roofUnits:number};
function readConfig(metadata:Record<string,unknown>|null):TowerConfig{const raw=metadata?.towerConfig;const cfg=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};const n=(key:string,fallback:number)=>{const value=Number(cfg[key]);return Number.isFinite(value)?value:fallback;};return{floorCount:Math.max(0,n('floorCount',0)),firstFloor:Math.max(0,n('firstFloor',1)),unitsPerFloor:Math.max(0,n('unitsPerFloor',0)),hasGroundFloor:Boolean(cfg.hasGroundFloor??false),groundFloorUnits:Math.max(0,n('groundFloorUnits',0)),hasRoof:Boolean(cfg.hasRoof??false),roofUnits:Math.max(0,n('roofUnits',0))};}
export function EditEngineeringStructureDialog({open,scope,structure,onClose,onSaved}:Props){const operations=useEngineeringOperations(scope);const initial=useMemo(()=>readConfig(structure.metadata),[structure.metadata]);const[name,setName]=useState(structure.name);const[code,setCode]=useState(structure.code??'');const[floorCount,setFloorCount]=useState(String(initial.floorCount));const[firstFloor,setFirstFloor]=useState(String(initial.firstFloor));const[unitsPerFloor,setUnitsPerFloor]=useState(String(initial.unitsPerFloor));const[hasGroundFloor,setHasGroundFloor]=useState(initial.hasGroundFloor);const[groundFloorUnits,setGroundFloorUnits]=useState(String(initial.groundFloorUnits));const[hasRoof,setHasRoof]=useState(initial.hasRoof);const[roofUnits,setRoofUnits]=useState(String(initial.roofUnits));const[busy,setBusy]=useState(false);const[error,setError]=useState<string|null>(null);useEffect(()=>{if(!open)return;const next=readConfig(structure.metadata);setName(structure.name);setCode(structure.code??'');setFloorCount(String(next.floorCount));setFirstFloor(String(next.firstFloor));setUnitsPerFloor(String(next.unitsPerFloor));setHasGroundFloor(next.hasGroundFloor);setGroundFloorUnits(String(next.groundFloorUnits));setHasRoof(next.hasRoof);setRoofUnits(String(next.roofUnits));setError(null);},[open,structure]);const floors=Math.max(0,Number(floorCount)||0);const units=Math.max(0,Number(unitsPerFloor)||0);const total=floors*units+(hasGroundFloor?Math.max(0,Number(groundFloorUnits)||0):0)+(hasRoof?Math.max(0,Number(roofUnits)||0):0);async function save(){if(!name.trim()){setError('Informe o nome da torre ou estrutura.');return;}if(floors<=0||units<=0){setError('Informe a quantidade de pavimentos e apartamentos por pavimento.');return;}setBusy(true);setError(null);try{await operations.updateStructure({structureId:structure.id,name:name.trim(),code:code.trim()||null,metadata:{...(structure.metadata??{}),towerConfig:{floorCount:floors,firstFloor:Math.max(0,Number(firstFloor)||1),unitsPerFloor:units,hasGroundFloor,groundFloorUnits:hasGroundFloor?Math.max(0,Number(groundFloorUnits)||0):0,hasRoof,roofUnits:hasRoof?Math.max(0,Number(roofUnits)||0):0,totalUnits:total}}});onSaved();onClose();}catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar a configuração da torre.');}finally{setBusy(false);}}return <Dialog open={open} title={`Configuração · ${structure.name}`} description="Defina a estrutura física usada nas planilhas e medições." onClose={onClose} onBack={onClose} loading={busy} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} onClick={()=>{void save();}}>Salvar configuração</Button></>}><div className="engineering-form-grid">{error&&<div style={{gridColumn:'1 / -1'}}><Feedback tone="danger" title="Não foi possível salvar" message={error}/></div>}<Input label="Nome da torre / estrutura" value={name} onChange={e=>setName(e.target.value)} required/><Input label="Código" value={code} onChange={e=>setCode(e.target.value)}/><Input label="Quantidade de pavimentos" type="number" min="1" value={floorCount} onChange={e=>setFloorCount(e.target.value)} required/><Input label="Primeiro pavimento" type="number" min="0" value={firstFloor} onChange={e=>setFirstFloor(e.target.value)} required/><Input label="Apartamentos por pavimento" type="number" min="1" value={unitsPerFloor} onChange={e=>setUnitsPerFloor(e.target.value)} required/><div className="engineering-contract-create-form__block"><label><input type="checkbox" checked={hasGroundFloor} onChange={e=>setHasGroundFloor(e.target.checked)}/> Possui térreo</label>{hasGroundFloor&&<Input label="Apartamentos no térreo" type="number" min="0" value={groundFloorUnits} onChange={e=>setGroundFloorUnits(e.target.value)}/>}</div><div className="engineering-contract-create-form__block"><label><input type="checkbox" checked={hasRoof} onChange={e=>setHasRoof(e.target.checked)}/> Possui cobertura</label>{hasRoof&&<Input label="Apartamentos na cobertura" type="number" min="0" value={roofUnits} onChange={e=>setRoofUnits(e.target.value)}/>}</div><div className="engineering-contract-create-form__notice"><strong>Total calculado de apartamentos: {total}</strong><span>Esse total passa a ser a referência estrutural para distribuição e medição.</span></div></div></Dialog>;}
''')

ws=Path('src/modules/engineering/ui/EngineeringContractWorkspace.tsx')
s=ws.read_text()
if "EditEngineeringStructureDialog" not in s:s=s.replace("import { EngineeringAddendumSheetDialog } from './EngineeringAddendumSheetDialog';","import { EngineeringAddendumSheetDialog } from './EngineeringAddendumSheetDialog';\nimport { EditEngineeringStructureDialog } from './EditEngineeringStructureDialog';")
if "structureEditId" not in s:
    s=s.replace("  const [contractAddendumId,setContractAddendumId]=useState<string|null>(null);","  const [contractAddendumId,setContractAddendumId]=useState<string|null>(null);\n  const [structureEditId,setStructureEditId]=useState<string|null>(null);")
    s=s.replace("  const contractSelectedAddendum=contractAddendumId?addenda.find(item=>item.id===contractAddendumId):undefined;","  const contractSelectedAddendum=contractAddendumId?addenda.find(item=>item.id===contractAddendumId):undefined;\n  const selectedStructureEdit=structureEditId?structures.find(item=>item.id===structureEditId):undefined;")
old_click="onClick={()=>{onNavigate('planilhas');selectSheetGroup({type:'structure',id:item.id});}}"
if old_click in s:s=s.replace(old_click,"onClick={()=>setStructureEditId(item.id)}")
if "selectedStructureEdit&&<EditEngineeringStructureDialog" not in s:
    anchor="{contractSelectedAddendum&&<EngineeringAddendumSheetDialog open scope={scope} addendumId={contractSelectedAddendum.id} addendumNumber={contractSelectedAddendum.number} statusLabel={labelStatus(contractSelectedAddendum.status)} onClose={()=>setContractAddendumId(null)} onEditLine={()=>open('addendumLine')}/>}"
    assert anchor in s
    s=s.replace(anchor,"{selectedStructureEdit&&<EditEngineeringStructureDialog open scope={scope} structure={selectedStructureEdit} onClose={()=>setStructureEditId(null)} onSaved={changed}/>}"+anchor)
ws.write_text(s)
