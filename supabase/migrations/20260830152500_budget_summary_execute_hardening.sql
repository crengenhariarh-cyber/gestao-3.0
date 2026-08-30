begin;
revoke all on function public.budget_monthly_summary(uuid,uuid,date,date) from public,anon;
revoke all on function public.budget_annual_summary(uuid,uuid,integer) from public,anon;
grant execute on function public.budget_monthly_summary(uuid,uuid,date,date) to authenticated;
grant execute on function public.budget_annual_summary(uuid,uuid,integer) to authenticated;
commit;
