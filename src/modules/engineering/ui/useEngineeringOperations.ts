import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EngineeringOperationalSnapshot, EngineeringScope } from '../application/EngineeringOperationsRepository';
import { getEngineeringOperationsRepository } from '../infrastructure/createEngineeringRepositories';

interface State { busy:boolean; data:EngineeringOperationalSnapshot|null; errorMessage:string|null; successMessage:string|null; }
function messageFrom(error: unknown): string { return error instanceof Error && error.message ? error.message : 'Não foi possível concluir a operação de Engenharia.'; }

export function useEngineeringOperations(scope: EngineeringScope) {
  const repository = useMemo(() => getEngineeringOperationsRepository(), []);
  const [state, setState] = useState<State>({ busy:false, data:null, errorMessage:null, successMessage:null });
  const reload = useCallback(async () => {
    setState(current=>({...current,busy:true,errorMessage:null}));
    try { const data=await repository.getSnapshot(scope); setState(current=>({...current,busy:false,data})); return data; }
    catch(error){ setState(current=>({...current,busy:false,errorMessage:messageFrom(error)})); throw error; }
  },[repository,scope]);
  useEffect(()=>{ void reload().catch(()=>undefined); },[reload]);
  const execute = useCallback(async(action:()=>Promise<void>,successMessage:string)=>{
    setState(current=>({...current,busy:true,errorMessage:null,successMessage:null}));
    try { await action(); const data=await repository.getSnapshot(scope); setState({busy:false,data,errorMessage:null,successMessage}); }
    catch(error){ setState(current=>({...current,busy:false,errorMessage:messageFrom(error),successMessage:null})); throw error; }
  },[repository,scope]);
  return {
    state,reload,clearFeedback:()=>setState(current=>({...current,errorMessage:null,successMessage:null})),
    createWork:(input:Parameters<typeof repository.createWork>[1])=>execute(()=>repository.createWork(scope,input),'Obra cadastrada.'),
    createStructure:(input:Parameters<typeof repository.createStructure>[1])=>execute(()=>repository.createStructure(scope,input),'Estrutura cadastrada.'),
    createContract:(input:Parameters<typeof repository.createContract>[1])=>execute(()=>repository.createContract(scope,input),'Contrato cadastrado.'),
    updateContractStatus:(id:string,status:Parameters<typeof repository.updateContractStatus>[2])=>execute(()=>repository.updateContractStatus(scope,id,status),'Status do contrato atualizado.'),
    createService:(input:Parameters<typeof repository.createService>[1])=>execute(()=>repository.createService(scope,input),'Serviço cadastrado.'),
    addContractService:(input:Parameters<typeof repository.addContractService>[1])=>execute(()=>repository.addContractService(scope,input),'Serviço adicionado ao contrato.'),
    allocateContractService:(input:Parameters<typeof repository.allocateContractService>[1])=>execute(()=>repository.allocateContractService(scope,input),'Serviço distribuído na estrutura.'),
    createProvisional:(input:Parameters<typeof repository.createProvisional>[1])=>execute(()=>repository.createProvisional(scope,input),'Provisório criado.'),
    addProvisionalLine:(input:Parameters<typeof repository.addProvisionalLine>[1])=>execute(()=>repository.addProvisionalLine(scope,input),'Item adicionado ao provisório.'),
    convertProvisional:(input:Parameters<typeof repository.convertProvisional>[0])=>execute(()=>repository.convertProvisional(input),'Provisório convertido.'),
    createAddendum:(input:Parameters<typeof repository.createAddendum>[1])=>execute(()=>repository.createAddendum(scope,input),'Aditivo criado.'),
    addAddendumLine:(input:Parameters<typeof repository.addAddendumLine>[1])=>execute(()=>repository.addAddendumLine(scope,input),'Item adicionado ao aditivo.'),
    createMeasurement:(input:Parameters<typeof repository.createMeasurement>[1])=>execute(()=>repository.createMeasurement(scope,input),'Medição criada.'),
    addMeasurementLine:(input:Parameters<typeof repository.addMeasurementLine>[1])=>execute(()=>repository.addMeasurementLine(scope,input),'Item incluído na medição.'),
    addRetention:(input:Parameters<typeof repository.addRetention>[1])=>execute(()=>repository.addRetention(scope,input),'Retenção incluída.'),
    setMeasurementStatus:(id:string,action:Parameters<typeof repository.setMeasurementStatus>[1],reason?:string|null)=>execute(()=>repository.setMeasurementStatus(id,action,reason),'Status da medição atualizado.'),
    generateMeasurementReceivable:(id:string,dueDate:string)=>execute(()=>repository.generateMeasurementReceivable(id,dueDate),'Conta a receber gerada.'),
    receiveMeasurement:(id:string,accountId:string,receivedOn:string,amount:number)=>execute(()=>repository.receiveMeasurement(id,accountId,receivedOn,amount),'Recebimento registrado.'),
    createProductionPeriod:(input:Parameters<typeof repository.createProductionPeriod>[1])=>execute(()=>repository.createProductionPeriod(scope,input),'Período de produção criado.'),
    addProductionEntry:(input:Parameters<typeof repository.addProductionEntry>[1])=>execute(()=>repository.addProductionEntry(scope,input),'Produção registrada.'),
    setProductionPeriodStatus:(id:string,action:Parameters<typeof repository.setProductionPeriodStatus>[1],reason?:string|null)=>execute(()=>repository.setProductionPeriodStatus(id,action,reason),'Status do período atualizado.'),
  };
}
