import { useEffect, useMemo, useState } from 'react';
import type { EngineeringOverview } from '../domain/overview';
import { getEngineeringOverviewRepository } from '../infrastructure/createEngineeringRepositories';

export type EngineeringOverviewState =
  | { status:'idle'|'loading'; data:null; errorMessage:null }
  | { status:'ready'; data:EngineeringOverview; errorMessage:null }
  | { status:'error'; data:null; errorMessage:string };

type Scope={tenantId:string;companyId:string};

export function useEngineeringOverview(scopes:readonly Scope[], refreshToken = 0):EngineeringOverviewState {
  const repository = useMemo(()=>getEngineeringOverviewRepository(),[]);
  const [state,setState] = useState<EngineeringOverviewState>({status:'idle',data:null,errorMessage:null});
  const scopeKey=scopes.map(scope=>`${scope.tenantId}:${scope.companyId}`).sort().join('|');

  useEffect(()=>{
    if(scopes.length===0){ setState({status:'idle',data:null,errorMessage:null}); return; }
    let cancelled=false;
    setState({status:'loading',data:null,errorMessage:null});
    void Promise.all(scopes.map(scope=>repository.load(scope))).then(results=>{
      if(cancelled)return;
      setState({status:'ready',data:{
        contracts:results.flatMap(item=>item.contracts),
        measurements:results.flatMap(item=>item.measurements),
        production:results.flatMap(item=>item.production),
        addenda:results.flatMap(item=>item.addenda),
        provisionals:results.flatMap(item=>item.provisionals),
      },errorMessage:null});
    }).catch(()=>{
      if(!cancelled)setState({status:'error',data:null,errorMessage:'Não foi possível carregar a Engenharia para o filtro selecionado.'});
    });
    return ()=>{cancelled=true;};
  },[repository,scopeKey,refreshToken]);

  return state;
}
