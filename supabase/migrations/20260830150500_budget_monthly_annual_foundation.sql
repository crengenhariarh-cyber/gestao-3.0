begin;

create table public.budget_plans (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null,
  cost_center_id uuid, category_id uuid,
  competence_month date not null check (competence_month = date_trunc('month', competence_month)::date),
  planned_amount numeric(14,2) not null check (planned_amount >= 0),
  source_kind text not null default 'manual' check (source_kind in ('manual','salary')),
  notes text, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint budget_plans_company_fk foreign key (tenant_id,company_id) references public.companies(tenant_id,id) on delete restrict,
  constraint budget_plans_cost_center_fk foreign key (tenant_id,company_id,cost_center_id) references public.cost_centers(tenant_id,company_id,id) on delete restrict,
  constraint budget_plans_category_fk foreign key (tenant_id,company_id,category_id) references public.financial_categories(tenant_id,company_id,id) on delete restrict,
  constraint budget_plans_salary_shape_ck check (source_kind <> 'salary' or category_id is null),
  unique (tenant_id,company_id,cost_center_id,category_id,competence_month,source_kind)
);
create index budget_plans_company_month_idx on public.budget_plans(tenant_id,company_id,competence_month);
create index budget_plans_cost_center_month_idx on public.budget_plans(tenant_id,company_id,cost_center_id,competence_month);
create trigger budget_plans_set_updated_at before update on public.budget_plans for each row execute function public.set_updated_at();
alter table public.budget_plans enable row level security;
create policy budget_plans_select_authorized on public.budget_plans for select to authenticated using (app_private.can_access_company(tenant_id,company_id));
create policy budget_plans_insert_manager on public.budget_plans for insert to authenticated with check (app_private.can_manage_company(tenant_id,company_id));
create policy budget_plans_update_manager on public.budget_plans for update to authenticated using (app_private.can_manage_company(tenant_id,company_id)) with check (app_private.can_manage_company(tenant_id,company_id));
create policy budget_plans_delete_manager on public.budget_plans for delete to authenticated using (app_private.can_manage_company(tenant_id,company_id));

create or replace function public.budget_monthly_summary(p_tenant_id uuid,p_company_id uuid,p_from_competence date,p_to_competence date)
returns table(competence_month date,cost_center_id uuid,cost_center_name text,planned_manual numeric,planned_salary numeric,planned_total numeric,realized_finance numeric,realized_salary numeric,realized_total numeric,variance_amount numeric)
language sql stable set search_path=''
as $$
with months as (select gs::date competence_month from pg_catalog.generate_series(date_trunc('month',p_from_competence)::date,date_trunc('month',p_to_competence)::date,interval '1 month') gs where p_from_competence is not null and p_to_competence is not null and p_from_competence<=p_to_competence),
centers as (select cc.id,cc.name from public.cost_centers cc where cc.tenant_id=p_tenant_id and cc.company_id=p_company_id and cc.status='active'),
salary as (select s.competence_month,s.cost_center_id,sum(s.planned_salary)::numeric(14,2) planned_salary,sum(s.realized_salary)::numeric(14,2) realized_salary from public.payroll_salary_projection(p_tenant_id,p_company_id,p_from_competence,p_to_competence) s group by s.competence_month,s.cost_center_id),
manual as (select bp.competence_month,bp.cost_center_id,sum(bp.planned_amount)::numeric(14,2) planned_manual from public.budget_plans bp where bp.tenant_id=p_tenant_id and bp.company_id=p_company_id and bp.source_kind='manual' and bp.competence_month between date_trunc('month',p_from_competence)::date and date_trunc('month',p_to_competence)::date group by bp.competence_month,bp.cost_center_id),
actual_fin as (select fi.competence_month,fe.cost_center_id,sum(fi.amount)::numeric(14,2) realized_finance from public.financial_installments fi join public.financial_entries fe on fe.tenant_id=fi.tenant_id and fe.company_id=fi.company_id and fe.id=fi.entry_id where fi.tenant_id=p_tenant_id and fi.company_id=p_company_id and fe.entry_type='expense' and fi.competence_month between date_trunc('month',p_from_competence)::date and date_trunc('month',p_to_competence)::date and not exists (select 1 from public.payroll_finance_links pfl where pfl.tenant_id=fi.tenant_id and pfl.company_id=fi.company_id and pfl.financial_installment_id=fi.id) group by fi.competence_month,fe.cost_center_id),
keys as (select m.competence_month,c.id cost_center_id,c.name cost_center_name from months m cross join centers c union select competence_month,null::uuid,null::text from months)
select k.competence_month,k.cost_center_id,k.cost_center_name,coalesce(manual.planned_manual,0)::numeric(14,2),coalesce(salary.planned_salary,0)::numeric(14,2),(coalesce(manual.planned_manual,0)+coalesce(salary.planned_salary,0))::numeric(14,2),coalesce(actual_fin.realized_finance,0)::numeric(14,2),coalesce(salary.realized_salary,0)::numeric(14,2),(coalesce(actual_fin.realized_finance,0)+coalesce(salary.realized_salary,0))::numeric(14,2),((coalesce(manual.planned_manual,0)+coalesce(salary.planned_salary,0))-(coalesce(actual_fin.realized_finance,0)+coalesce(salary.realized_salary,0)))::numeric(14,2)
from keys k left join manual on manual.competence_month=k.competence_month and manual.cost_center_id is not distinct from k.cost_center_id left join salary on salary.competence_month=k.competence_month and salary.cost_center_id is not distinct from k.cost_center_id left join actual_fin on actual_fin.competence_month=k.competence_month and actual_fin.cost_center_id is not distinct from k.cost_center_id order by k.competence_month,k.cost_center_name nulls last;
$$;
grant execute on function public.budget_monthly_summary(uuid,uuid,date,date) to authenticated;

create or replace function public.budget_annual_summary(p_tenant_id uuid,p_company_id uuid,p_year integer)
returns table(cost_center_id uuid,cost_center_name text,planned_total numeric,realized_total numeric,variance_amount numeric,utilization_percent numeric)
language sql stable set search_path=''
as $$ select m.cost_center_id,m.cost_center_name,sum(m.planned_total)::numeric(14,2),sum(m.realized_total)::numeric(14,2),(sum(m.planned_total)-sum(m.realized_total))::numeric(14,2),case when sum(m.planned_total)=0 then 0::numeric else round(sum(m.realized_total)*100.0/sum(m.planned_total),2) end::numeric(8,2) from public.budget_monthly_summary(p_tenant_id,p_company_id,make_date(p_year,1,1),make_date(p_year,12,1)) m group by m.cost_center_id,m.cost_center_name order by m.cost_center_name nulls last; $$;
grant execute on function public.budget_annual_summary(uuid,uuid,integer) to authenticated;
commit;
