begin;
revoke all on function app_private.budget_monthly_summary_impl(uuid,uuid,date,date) from public,anon,authenticated;
commit;
