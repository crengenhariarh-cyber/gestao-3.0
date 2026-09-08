import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export async function setEngineeringProductionPeriodStatus(input:{periodId:string;action:'close'|'reopen';reason:string|null}){
  const client=getSupabaseClient();
  const result=await client.rpc('set_engineering_production_period_status',{p_period_id:input.periodId,p_action:input.action,p_reason:input.reason});
  if(result.error)throw result.error;
}
