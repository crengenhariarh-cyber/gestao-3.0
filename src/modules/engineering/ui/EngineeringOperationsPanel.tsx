import { useState, type ReactNode } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { useEngineeringOperations } from './useEngineeringOperations';

type TabId='contratos'|'medicoes'|'producao'|'aditivos'|'provisorios';
type Kind='work'|'structure'|'contract'|'contractStatus'|'service'|'contractService'|'allocation'|'provisional'|'provisionalLine'|'convert'|'addendum'|'addendumLine'|'measurement'|'measurementLine'|'retention'|'measurementStatus'|'receivable'|'receive'|'productionPeriod'|'productionEntry'|'productionStatus'|null;
type ActionsMode='default'|'contract-create'|'contract-maintenance'|'contract-data'|'contract-services'|'measurement-create'|'measurement-close'|'contract-taxes';
interface Props { activeTab:TabId; scope:{tenantId:string;companyId:string}; onChanged:()=>void; actionsMode?:ActionsMode; focusedContractId?:string|null; initialKind?:Exclude<Kind,null>; hideActions?:boolean; onDialogClosed?:()=>void; }
interface Option { value:string; label:string; }

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const today=()=>new Date().toISOString().slice(0,10);
const currentMonth=()=>new Date().toISOString().slice(0,7);
const numberValue=(value:string)=>{const parsed=Number(value.replace(',','.'));return Number.isFinite(parsed)?parsed:0;};
const options=(items:readonly {id:string;name:string}[],placeholder='Selecione…'):Option[]=>[{value:'',label:placeholder},...items.map(item=>({value:item.id,label:item.name}))];

const titles:Record<Exclude<Kind,null>,string>={
  work:'Nova obra',structure:'Nova estrutura',contract:'Novo contrato',contractStatus:'Status do contrato',service:'Novo serviço',contractService:'Serviço do contrato',allocation:'Distribuir serviço',provisional:'Novo provisório',provisionalLine:'Item do provisório',convert:'Converter provisório',addendum:'Novo aditivo',addendumLine:'Item do aditivo',measurement:'Nova medição',measurementLine:'Item da medição',retention:'Nova retenção',measurementStatus:'Status da medição',receivable:'Gerar conta a receber',receive:'Receber medição',productionPeriod:'Novo período',productionEntry:'Lançar produção',productionStatus:'Fechar / reabrir produção',
};
const descriptions:Record<Exclude<Kind,null>,string>={
  work:'Cadastre os dados principais da obra.',structure:'Cadastre torre, bloco, pavimento, unidade ou outra estrutura da obra.',contract:'Cadastre os dados contratuais e as retenções padrão.',contractStatus:'Altere a situação atual do contrato.',service:'Cadastre um serviço para reutilização nas planilhas.',contractService:'Inclua quantidade e valor unitário na base contratual.',allocation:'Distribua a quantidade contratada por torre, pavimento ou unidade.',provisional:'Crie uma negociação antes de virar contrato ou aditivo.',provisionalLine:'Inclua um serviço na composição do provisório.',convert:'Converta o provisório aprovado preservando o histórico.',addendum:'Cadastre uma alteração vinculada ao contrato.',addendumLine:'Inclua o item que altera a composição contratual.',measurement:'Abra uma nova competência de medição.',measurementLine:'Registre quantidade e valor efetivamente medidos.',retention:'Registre INSS, ISS, retenção técnica ou outra retenção.',measurementStatus:'Feche, aprove, reabra ou cancele uma medição.',receivable:'Gere a conta a receber da medição aprovada.',receive:'Registre o recebimento financeiro da medição.',productionPeriod:'Abra uma competência para produção da equipe.',productionEntry:'Registre a produção executada por colaborador.',productionStatus:'Feche ou reabra o período de produção.',
};

export function EngineeringOperationsPanel({activeTab,scope,onChanged,actionsMode='default',focusedContractId=null,initialKind,hideActions=false,onDialogClosed}:Props){
  const operations=useEngineeringOperations(scope);
  const data=operations.state.data;
  const [kind,setKind]=useState<Kind>(initialKind??null);
  const [form,setForm]=useState<Record<string,string>>({});
  const field=(name:string,value:string)=>setForm(current=>({...current,[name]:value}));
  const workOptions=options(data?.works??[]);
  const contractOptions=options((data?.contracts??[]).map(item=>({id:item.id,name:`${item.contractNumber} · ${item.status}`})));
  const serviceOptions=options((data?.services??[]).map(item=>({id:item.id,name:`${item.name} · ${item.unit}`})));
  const provisionalOptions=options((data?.provisionals??[]).filter(item=>item.status!=='converted'&&item.status!=='cancelled').map(item=>({id:item.id,name:`${item.number} · ${item.status}`})));
  const measurementOptions=options((data?.measurements??[]).filter(item=>!focusedContractId||item.contractId===focusedContractId).map(item=>({id:item.id,name:`${item.competence.slice(0,7)} · ${item.status}`})));
  const periodOptions=options((data?.productionPeriods??[]).map(item=>({id:item.id,name:`${item.competence.slice(0,7)} · ${item.status}`})));
  const addendumOptions=options((data?.addenda??[]).filter(item=>!focusedContractId||item.contractId===focusedContractId).map(item=>({id:item.id,name:`${item.number} · ${item.status}`})));
  const employeeOptions=options(data?.employees??[]);
  const accountOptions=options(data?.accounts??[]);
  const focusedContract=data?.contracts.find(item=>item.id===focusedContractId);
  const selectedContract=data?.contracts.find(item=>item.id===(form.contractId??''));
  const selectedPeriod=data?.productionPeriods.find(item=>item.id===(form.periodId??''));
  const selectedWork=form.workId||selectedContract?.workId||selectedPeriod?.workId||focusedContract?.workId||'';
  const effectiveContractId=form.contractId||focusedContractId||'';
  const contractServiceOptions=options((data?.contractServices??[]).filter(item=>!effectiveContractId||item.contractId===effectiveContractId).map(item=>({id:item.id,name:`${item.description} · ${currency.format(item.unitPrice)}/${item.unit}`})));
  const structureOptions=options((data?.structures??[]).filter(item=>!selectedWork||item.workId===selectedWork));

  const defaults:Record<Exclude<Kind,null>,Record<string,string>>={
    work:{name:'',code:'',clientName:'',city:'',state:'',notes:''},structure:{workId:'',parentId:'',type:'tower',code:'',name:''},
    contract:{workId:'',contractNumber:'',clientName:'',signedAt:'',startDate:'',endDate:'',inssRate:'',issRate:'',retentionRate:'',notes:''},contractStatus:{contractId:'',status:'active'},
    service:{name:'',unit:'un',code:'',category:'',notes:''},contractService:{contractId:'',serviceId:'',description:'',unit:'un',quantity:'',unitPrice:'',notes:''},allocation:{contractId:'',workId:'',contractServiceId:'',structureId:'',quantity:'',notes:''},
    provisional:{workId:'',number:'',title:'',clientName:'',notes:''},provisionalLine:{provisionalId:'',serviceId:'',description:'',unit:'un',quantity:'',unitPrice:'',notes:''},convert:{provisionalId:'',destination:'contract',number:'',contractId:'',addendumType:'increase'},
    addendum:{contractId:'',number:'',type:'increase',effectiveDate:today(),statedValue:'',notes:''},addendumLine:{addendumId:'',contractId:'',contractServiceId:'',serviceId:'',description:'',unit:'un',quantityDelta:'',unitPrice:'',notes:''},
    measurement:{contractId:'',competence:currentMonth(),notes:''},measurementLine:{measurementId:'',contractId:'',contractServiceId:'',structureId:'',measuredQuantity:'',unitPrice:'',notes:''},retention:{measurementId:'',retentionType:'inss',calculationType:'percentage',rate:'',fixedAmount:'',description:'',notes:''},measurementStatus:{measurementId:'',action:'close',reason:''},receivable:{measurementId:'',dueDate:today()},receive:{measurementId:'',accountId:'',receivedOn:today(),amount:''},
    productionPeriod:{workId:'',competence:currentMonth()},productionEntry:{periodId:'',employmentContractId:'',structureId:'',serviceId:'',productionDate:today(),executedQuantity:'',unitValue:'',notes:''},productionStatus:{periodId:'',action:'close',reason:''},
  };

  function open(next:Exclude<Kind,null>){
    operations.clearFeedback();
    const base={...defaults[next]};
    if(focusedContractId&&['contractStatus','contractService','allocation','addendum','measurement'].includes(next))base.contractId=focusedContractId;
    if(focusedContract?.workId&&['structure','allocation','provisional','productionPeriod'].includes(next))base.workId=focusedContract.workId;
    setForm(base);setKind(next);
  }
  function close(){setKind(null);operations.clearFeedback();onDialogClosed?.();}
  async function done(action:()=>Promise<unknown>){await action();onChanged();setKind(null);onDialogClosed?.();}
  async function submit(){
    try{
      switch(kind){
        case 'work':await done(()=>operations.createWork({name:form.name??'',code:form.code||null,clientName:form.clientName||null,city:form.city||null,state:form.state||null,notes:form.notes||null}));break;
        case 'structure':await done(()=>operations.createStructure({workId:form.workId??'',parentId:form.parentId||null,type:(form.type??'tower') as Parameters<typeof operations.createStructure>[0]['type'],code:form.code||null,name:form.name??''}));break;
        case 'contract':await done(()=>operations.createContract({workId:form.workId??'',contractNumber:form.contractNumber??'',clientName:form.clientName||null,signedAt:form.signedAt||null,startDate:form.startDate||null,endDate:form.endDate||null,inssRate:form.inssRate?numberValue(form.inssRate):null,issRate:form.issRate?numberValue(form.issRate):null,retentionRate:form.retentionRate?numberValue(form.retentionRate):null,notes:form.notes||null}));break;
        case 'contractStatus':await done(()=>operations.updateContractStatus(form.contractId||focusedContractId||'',(form.status??'active') as Parameters<typeof operations.updateContractStatus>[1]));break;
        case 'service':await done(()=>operations.createService({name:form.name??'',unit:form.unit??'un',code:form.code||null,category:form.category||null,notes:form.notes||null}));break;
        case 'contractService':await done(()=>operations.addContractService({contractId:form.contractId||focusedContractId||'',serviceId:form.serviceId||null,description:form.description??'',unit:form.unit??'un',quantity:numberValue(form.quantity??''),unitPrice:numberValue(form.unitPrice??''),notes:form.notes||null}));break;
        case 'allocation':await done(()=>operations.allocateContractService({workId:form.workId||selectedContract?.workId||focusedContract?.workId||'',contractServiceId:form.contractServiceId??'',structureId:form.structureId??'',quantity:numberValue(form.quantity??''),notes:form.notes||null}));break;
        case 'provisional':await done(()=>operations.createProvisional({workId:form.workId||focusedContract?.workId||'',number:form.number??'',title:form.title||null,clientName:form.clientName||null,notes:form.notes||null}));break;
        case 'provisionalLine':await done(()=>operations.addProvisionalLine({provisionalId:form.provisionalId??'',serviceId:form.serviceId||null,description:form.description??'',unit:form.unit??'un',quantity:numberValue(form.quantity??''),unitPrice:numberValue(form.unitPrice??''),notes:form.notes||null}));break;
        case 'convert':await done(()=>operations.convertProvisional({provisionalId:form.provisionalId??'',destination:(form.destination??'contract') as 'contract'|'addendum',number:form.number??'',contractId:form.contractId||focusedContractId||null,addendumType:(form.addendumType||null) as 'increase'|'reduction'|'adjustment'|null}));break;
        case 'addendum':await done(()=>operations.createAddendum({contractId:form.contractId||focusedContractId||'',number:form.number??'',type:(form.type??'increase') as 'increase'|'reduction'|'adjustment',effectiveDate:form.effectiveDate||null,statedValue:form.statedValue?numberValue(form.statedValue):null,notes:form.notes||null}));break;
        case 'addendumLine':await done(()=>operations.addAddendumLine({addendumId:form.addendumId??'',contractServiceId:form.contractServiceId||null,serviceId:form.serviceId||null,description:form.description??'',unit:form.unit??'un',quantityDelta:numberValue(form.quantityDelta??''),unitPrice:numberValue(form.unitPrice??''),notes:form.notes||null}));break;
        case 'measurement':await done(()=>operations.createMeasurement({contractId:form.contractId||focusedContractId||'',competence:form.competence??currentMonth(),notes:form.notes||null}));break;
        case 'measurementLine':await done(()=>operations.addMeasurementLine({measurementId:form.measurementId??'',contractServiceId:form.contractServiceId??'',structureId:form.structureId||null,measuredQuantity:numberValue(form.measuredQuantity??''),unitPrice:numberValue(form.unitPrice??''),notes:form.notes||null}));break;
        case 'retention':await done(()=>operations.addRetention({measurementId:form.measurementId??'',retentionType:(form.retentionType??'inss') as 'inss'|'iss'|'rt'|'other',calculationType:(form.calculationType??'percentage') as 'percentage'|'fixed',rate:form.rate?numberValue(form.rate):null,fixedAmount:form.fixedAmount?numberValue(form.fixedAmount):null,description:form.description||null,notes:form.notes||null}));break;
        case 'measurementStatus':await done(()=>operations.setMeasurementStatus(form.measurementId??'',(form.action??'close') as 'close'|'approve'|'cancel'|'reopen',form.reason||null));break;
        case 'receivable':await done(()=>operations.generateMeasurementReceivable(form.measurementId??'',form.dueDate??today()));break;
        case 'receive':await done(()=>operations.receiveMeasurement(form.measurementId??'',form.accountId??'',form.receivedOn??today(),numberValue(form.amount??'')));break;
        case 'productionPeriod':await done(()=>operations.createProductionPeriod({workId:form.workId??focusedContract?.workId??'',competence:form.competence??currentMonth()}));break;
        case 'productionEntry':await done(()=>operations.addProductionEntry({periodId:form.periodId??'',employmentContractId:form.employmentContractId??'',structureId:form.structureId??'',serviceId:form.serviceId??'',productionDate:form.productionDate??today(),executedQuantity:numberValue(form.executedQuantity??''),unitValue:form.unitValue?numberValue(form.unitValue):null,notes:form.notes||null}));break;
        case 'productionStatus':await done(()=>operations.setProductionPeriodStatus(form.periodId??'',(form.action??'close') as 'close'|'reopen',form.reason||null));break;
        default:break;
      }
    }catch{return;}
  }

  const defaultContractActions=<><Button size="sm" onClick={()=>open('work')}>Nova obra</Button><Button size="sm" variant="secondary" onClick={()=>open('structure')}>Estrutura</Button><Button size="sm" onClick={()=>open('contract')}>Novo contrato</Button><Button size="sm" variant="secondary" onClick={()=>open('service')}>Novo serviço</Button><Button size="sm" variant="secondary" onClick={()=>open('contractService')}>Serviço no contrato</Button><Button size="sm" variant="secondary" onClick={()=>open('allocation')}>Distribuir serviço</Button><Button size="sm" variant="tertiary" onClick={()=>open('contractStatus')}>Status</Button></>;
  const contractCreateAction=<Button onClick={()=>open('contract')}>＋ Novo contrato</Button>;
  const contractMaintenanceActions=<><Button size="sm" onClick={()=>open('contractStatus')}>Status</Button><Button size="sm" variant="secondary" onClick={()=>open('contractService')}>Serviços</Button><Button size="sm" variant="secondary" onClick={()=>open('allocation')}>Distribuição</Button><Button size="sm" variant="secondary" onClick={()=>open('addendum')}>Aditivo</Button><Button size="sm" variant="secondary" onClick={()=>open('measurement')}>Nova medição</Button></>;
  const contractDataActions=<><Button size="sm" onClick={()=>open('contractStatus')}>Alterar status</Button><Button size="sm" variant="secondary" onClick={()=>open('structure')}>Nova estrutura</Button><Button size="sm" variant="secondary" onClick={()=>open('addendum')}>Novo aditivo</Button></>;
  const contractServiceActions=<><Button size="sm" onClick={()=>open('contractService')}>Adicionar serviço</Button><Button size="sm" variant="secondary" onClick={()=>open('allocation')}>Distribuir por estrutura</Button><Button size="sm" variant="secondary" onClick={()=>open('addendum')}>Novo aditivo</Button><Button size="sm" variant="secondary" onClick={()=>open('addendumLine')}>Item de aditivo</Button></>;
  const measurementCreateActions=<><Button size="sm" onClick={()=>open('measurement')}>Nova medição</Button><Button size="sm" variant="secondary" onClick={()=>open('measurementLine')}>Adicionar serviço medido</Button></>;
  const measurementCloseActions=<><Button size="sm" onClick={()=>open('measurementStatus')}>Fechar / aprovar / reabrir</Button><Button size="sm" variant="secondary" onClick={()=>open('receivable')}>Gerar conta a receber</Button><Button size="sm" variant="secondary" onClick={()=>open('receive')}>Registrar recebimento</Button></>;
  const contractTaxActions=<><Button size="sm" onClick={()=>open('retention')}>Lançar retenção</Button><Button size="sm" variant="secondary" onClick={()=>open('measurementStatus')}>Revisar medição</Button></>;
  const actions:Record<TabId,ReactNode>={
    contratos:actionsMode==='contract-create'?contractCreateAction:actionsMode==='contract-data'?contractDataActions:actionsMode==='contract-services'?contractServiceActions:actionsMode==='contract-maintenance'?contractMaintenanceActions:defaultContractActions,
    medicoes:actionsMode==='measurement-create'?measurementCreateActions:actionsMode==='measurement-close'?measurementCloseActions:actionsMode==='contract-taxes'?contractTaxActions:<><Button size="sm" onClick={()=>open('measurement')}>Nova medição</Button><Button size="sm" variant="secondary" onClick={()=>open('measurementLine')}>Adicionar item</Button><Button size="sm" variant="secondary" onClick={()=>open('measurementStatus')}>Fechar / aprovar</Button><Button size="sm" variant="tertiary" onClick={()=>open('receivable')}>Gerar a receber</Button><Button size="sm" variant="tertiary" onClick={()=>open('receive')}>Receber</Button></>,
    producao:<><Button size="sm" onClick={()=>open('productionPeriod')}>Novo período</Button><Button size="sm" variant="secondary" onClick={()=>open('productionEntry')}>Lançar produção</Button><Button size="sm" variant="secondary" onClick={()=>open('productionStatus')}>Fechar / reabrir</Button></>,
    aditivos:<><Button size="sm" onClick={()=>open('addendum')}>Novo aditivo</Button><Button size="sm" variant="secondary" onClick={()=>open('addendumLine')}>Adicionar item</Button></>,
    provisorios:<><Button size="sm" onClick={()=>open('provisional')}>Novo provisório</Button><Button size="sm" variant="secondary" onClick={()=>open('provisionalLine')}>Adicionar item</Button><Button size="sm" variant="tertiary" onClick={()=>open('convert')}>Converter</Button></>,
  };

  const select=(label:string,name:string,source:Option[],required=false)=><Select label={label} value={form[name]??''} onChange={event=>field(name,event.target.value)} options={source} required={required}/>;
  const input=(label:string,name:string,type='text',required=false)=><Input label={label} type={type} value={form[name]??''} onChange={event=>field(name,event.target.value)} required={required}/>;
  const contractContext=focusedContractId?<div className="engineering-form-context"><span>Contrato selecionado</span><strong>{focusedContract?.contractNumber??'Contrato atual'}</strong></div>:null;
  const shell=(children:ReactNode,note?:string)=><div className="engineering-standard-form">{contractContext}{note&&<div className="engineering-standard-form__notice">{note}</div>}<div className="engineering-form-grid">{children}</div></div>;

  let content:ReactNode=null;
  switch(kind){
    case 'work':content=shell(<>{input('Nome da obra','name','text',true)}{input('Código','code')}{input('Cliente','clientName')}{input('Cidade','city')}{input('UF','state')}{input('Observações','notes')}</>);break;
    case 'structure':content=shell(<>{!focusedContractId&&select('Obra','workId',workOptions,true)}{select('Tipo','type',[{value:'tower',label:'Torre'},{value:'block',label:'Bloco'},{value:'floor',label:'Pavimento'},{value:'unit',label:'Unidade'},{value:'house',label:'Casa'},{value:'ground_floor',label:'Térreo'},{value:'basement',label:'Subsolo'},{value:'area',label:'Área'},{value:'other',label:'Outro'}],true)}{select('Estrutura pai','parentId',options((data?.structures??[]).filter(item=>item.workId===(form.workId||focusedContract?.workId))))}{input('Código','code')}{input('Nome','name','text',true)}</>);break;
    case 'contract':content=shell(<>{select('Obra','workId',workOptions,true)}{input('Número do contrato','contractNumber','text',true)}{input('Cliente','clientName')}{input('Assinatura','signedAt','date')}{input('Início','startDate','date')}{input('Fim','endDate','date')}{input('INSS (%)','inssRate','number')}{input('ISS (%)','issRate','number')}{input('Retenção técnica (%)','retentionRate','number')}{input('Observações','notes')}</>,'As retenções cadastradas aqui serão herdadas automaticamente pelas novas medições.');break;
    case 'contractStatus':content=shell(<>{!focusedContractId&&select('Contrato','contractId',contractOptions,true)}{select('Status','status',[{value:'draft',label:'Rascunho'},{value:'active',label:'Ativo'},{value:'suspended',label:'Suspenso'},{value:'completed',label:'Concluído'},{value:'cancelled',label:'Cancelado'}],true)}</>);break;
    case 'service':content=shell(<>{input('Serviço','name','text',true)}{input('Unidade','unit','text',true)}{input('Código','code')}{input('Categoria','category')}{input('Observações','notes')}</>);break;
    case 'contractService':content=shell(<>{!focusedContractId&&select('Contrato','contractId',contractOptions,true)}{select('Serviço cadastrado','serviceId',serviceOptions)}{input('Descrição','description','text',true)}{input('Unidade','unit','text',true)}{input('Quantidade','quantity','number',true)}{input('Valor unitário','unitPrice','number',true)}{input('Observações','notes')}</>);break;
    case 'allocation':content=shell(<>{!focusedContractId&&select('Contrato','contractId',contractOptions,true)}{select('Serviço do contrato','contractServiceId',contractServiceOptions,true)}{select('Torre / pavimento / unidade','structureId',structureOptions,true)}{input('Quantidade distribuída','quantity','number',true)}{input('Observações','notes')}</>,'A soma das distribuições deve respeitar a quantidade contratada do serviço.');break;
    case 'provisional':content=shell(<>{!focusedContractId&&select('Obra','workId',workOptions,true)}{input('Número','number','text',true)}{input('Título','title')}{input('Cliente','clientName')}{input('Observações','notes')}</>);break;
    case 'provisionalLine':content=shell(<>{select('Provisório','provisionalId',provisionalOptions,true)}{select('Serviço','serviceId',serviceOptions)}{input('Descrição','description','text',true)}{input('Unidade','unit','text',true)}{input('Quantidade','quantity','number',true)}{input('Valor unitário','unitPrice','number',true)}{input('Observações','notes')}</>);break;
    case 'convert':content=shell(<>{select('Provisório','provisionalId',provisionalOptions,true)}{select('Converter em','destination',[{value:'contract',label:'Contrato'},{value:'addendum',label:'Aditivo'}],true)}{input('Número de destino','number','text',true)}{form.destination==='addendum'&&!focusedContractId&&select('Contrato','contractId',contractOptions,true)}{form.destination==='addendum'&&select('Tipo','addendumType',[{value:'increase',label:'Acréscimo'},{value:'reduction',label:'Redução'},{value:'adjustment',label:'Ajuste'}],true)}</>,'A conversão preserva o histórico do provisório e de seus itens.');break;
    case 'addendum':content=shell(<>{!focusedContractId&&select('Contrato','contractId',contractOptions,true)}{input('Número','number','text',true)}{select('Tipo','type',[{value:'increase',label:'Acréscimo'},{value:'reduction',label:'Redução'},{value:'adjustment',label:'Ajuste'}],true)}{input('Vigência','effectiveDate','date')}{input('Valor declarado','statedValue','number')}{input('Observações','notes')}</>);break;
    case 'addendumLine':content=shell(<>{select('Aditivo','addendumId',addendumOptions,true)}{select('Serviço do contrato','contractServiceId',contractServiceOptions)}{select('Serviço novo','serviceId',serviceOptions)}{input('Descrição','description','text',true)}{input('Unidade','unit','text',true)}{input('Variação quantidade (+/-)','quantityDelta','number',true)}{input('Valor unitário','unitPrice','number',true)}{input('Observações','notes')}</>);break;
    case 'measurement':content=shell(<>{!focusedContractId&&select('Contrato','contractId',contractOptions,true)}{input('Competência','competence','month',true)}{input('Observações','notes')}</>,'INSS, ISS e retenção técnica serão carregados automaticamente conforme o contrato.');break;
    case 'measurementLine':content=shell(<>{select('Medição','measurementId',measurementOptions,true)}{select('Serviço do contrato','contractServiceId',contractServiceOptions,true)}{select('Estrutura','structureId',structureOptions)}{input('Quantidade medida','measuredQuantity','number',true)}{input('Valor unitário','unitPrice','number',true)}{input('Observações','notes')}</>);break;
    case 'retention':content=shell(<>{select('Medição','measurementId',measurementOptions,true)}{select('Retenção','retentionType',[{value:'inss',label:'INSS'},{value:'iss',label:'ISS'},{value:'rt',label:'RT'},{value:'other',label:'Outra'}],true)}{select('Cálculo','calculationType',[{value:'percentage',label:'Percentual'},{value:'fixed',label:'Valor fixo'}],true)}{form.calculationType==='fixed'?input('Valor','fixedAmount','number',true):input('Percentual','rate','number',true)}{input('Descrição','description')}{input('Observações','notes')}</>);break;
    case 'measurementStatus':content=shell(<>{select('Medição','measurementId',measurementOptions,true)}{select('Ação','action',[{value:'close',label:'Fechar'},{value:'approve',label:'Aprovar'},{value:'reopen',label:'Reabrir'},{value:'cancel',label:'Cancelar'}],true)}{input('Motivo','reason')}</>);break;
    case 'receivable':content=shell(<>{select('Medição','measurementId',measurementOptions,true)}{input('Vencimento','dueDate','date',true)}</>);break;
    case 'receive':content=shell(<>{select('Medição','measurementId',measurementOptions,true)}{select('Conta de recebimento','accountId',accountOptions,true)}{input('Recebido em','receivedOn','date',true)}{input('Valor','amount','number',true)}</>);break;
    case 'productionPeriod':content=shell(<>{select('Obra','workId',workOptions,true)}{input('Competência','competence','month',true)}</>);break;
    case 'productionEntry':content=shell(<>{select('Período','periodId',periodOptions,true)}{select('Colaborador','employmentContractId',employeeOptions,true)}{select('Estrutura','structureId',structureOptions,true)}{select('Serviço','serviceId',serviceOptions,true)}{input('Data','productionDate','date',true)}{input('Quantidade','executedQuantity','number',true)}{input('Valor unitário','unitValue','number')}{input('Observações','notes')}</>);break;
    case 'productionStatus':content=shell(<>{select('Período','periodId',periodOptions,true)}{select('Ação','action',[{value:'close',label:'Fechar'},{value:'reopen',label:'Reabrir'}],true)}{input('Motivo','reason')}</>);break;
    default:break;
  }

  return <>
    {!hideActions&&<div className="engineering-actions">{actions[activeTab]}</div>}
    {operations.state.errorMessage&&kind===null&&<Feedback tone="danger" title="Operação não concluída" message={operations.state.errorMessage}/>} 
    {operations.state.successMessage&&kind===null&&<Feedback tone="success" title="Concluído" message={operations.state.successMessage}/>} 
    <Dialog open={kind!==null} title={kind?titles[kind]:'Engenharia'} description={kind?descriptions[kind]:'Operação de Engenharia'} loading={operations.state.busy} onClose={close} onBack={close} onConfirm={kind?()=>{void submit();}:undefined} confirmLabel="Salvar">
      {operations.state.errorMessage&&<Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage}/>} 
      {content}
    </Dialog>
  </>;
}
