import { useEffect, useMemo, useState } from 'react';
import type { EngineeringOverview } from '../domain/overview';
import { getEngineeringOverviewRepository } from '../infrastructure/createEngineeringRepositories';

export type EngineeringOverviewState =
  | { status:'idle'|'loading'; data:null; errorMessage:null }
  | { status:'ready'; data:EngineeringOverview; errorMessage:null }
  | { status:'error'; data:null; errorMessage:string };

export function useEngineeringOverview(scope:{tenantId:string;companyId:string}|null, refreshToken = 0):EngineeringOverviewState {
  const repository = useMemo(()=>getEngineeringOverviewRepository(),[]);
  const [state,setState] = useState<EngineeringOverviewState>({status:'idle',data:null,errorMessage:null});
  const tenantId=scope?.tenantId ?? null;
  const companyId=scope?.companyId ?? null;

  useEffect(()=>{
    if(!tenantId||!companyId){ setState({status:'idle',data:null,errorMessage:null}); return; }
    let cancelled=false;
    setState({status:'loading',data:null,errorMessage:null});
    void repository.load({tenantId,companyId}).then(data=>{
      if(!cancelled) setState({status:'ready',data,errorMessage:null});
    }).catch(()=>{
      if(!cancelled) setState({status:'error',data:null,errorMessage:'Não foi possível carregar a Engenharia desta empresa.'});
    });
    return ()=>{cancelled=true;};
  },[repository,tenantId,companyId,refreshToken]);

  return state;
}
