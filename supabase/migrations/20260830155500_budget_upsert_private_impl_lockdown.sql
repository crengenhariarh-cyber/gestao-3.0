begin;
revoke all on function app_private.upsert_budget_plan_impl(uuid,uuid,uuid,uuid,date,numeric,text) from public,anon;
grant execute on function app_private.upsert_budget_plan_impl(uuid,uuid,uuid,uuid,date,numeric,text) to authenticated;
commit;
