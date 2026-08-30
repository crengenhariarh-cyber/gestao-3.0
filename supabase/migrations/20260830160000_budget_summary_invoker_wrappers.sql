begin;
grant execute on function app_private.budget_monthly_summary_impl(uuid,uuid,date,date) to authenticated;
create or replace function public.budget_monthly_summary(p_tenant_id uuid,p_company_id uuid,p_from_competence date,p_to_competence date)
returns table(competence_month date,cost_center_id uuid,cost_center_name text,planned_manual numeric,planned_salary numeric,planned_total numeric,realized_finance numeric,realized_salary numeric,realized_total numeric,variance_amount numeric)
language plpgsql stable security invoker set search_path=''
as $$ begin if not app_private.can_access_company(p_tenant_id,p_company_id) then raise exception 'not authorized to access company'; end if; return query select * from app_private.budget_monthly_summary_impl(p_tenant_id,p_company_id,p_from_competence,p_to_competence); end $$;
create or replace function public.budget_annual_summary(p_tenant_id uuid,p_company_id uuid,p_year integer)
returns table(cost_center_id uuid,cost_center_name text,planned_total numeric,realized_total numeric,variance_amount numeric,utilization_percent numeric)
language plpgsql stable security invoker set search_path=''
as $$ begin if not app_private.can_access_company(p_tenant_id,p_company_id) then raise exception 'not authorized to access company'; end if; return query select m.cost_center_id,m.cost_center_name,sum(m.planned_total)::numeric(14,2),sum(m.realized_total)::numeric(14,2),(sum(m.planned_total)-sum(m.realized_total))::numeric(14,2),case when sum(m.planned_total)=0 then 0::numeric else round(sum(m.realized_total)*100.0/sum(m.planned_total),2) end::numeric(8,2) from app_private.budget_monthly_summary_impl(p_tenant_id,p_company_id,make_date(p_year,1,1),make_date(p_year,12,1)) m group by m.cost_center_id,m.cost_center_name order by m.cost_center_name nulls last; end $$;
revoke all on function public.budget_monthly_summary(uuid,uuid,date,date) from public,anon;
revoke all on function public.budget_annual_summary(uuid,uuid,integer) from public,anon;
grant execute on function public.budget_monthly_summary(uuid,uuid,date,date) to authenticated;
grant execute on function public.budget_annual_summary(uuid,uuid,integer) to authenticated;
commit;
