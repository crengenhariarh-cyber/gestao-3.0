begin;

alter table public.budget_planning_settings
  add column if not exists target_markup_percent numeric(8,4) not null default 20
  check (target_markup_percent>=0 and target_markup_percent<1000);

create table if not exists public.budget_item_treatments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  cost_center_id uuid,
  budget_year integer not null check (budget_year between 2000 and 2200),
  category_id uuid not null,
  treatment text not null default 'operational_cost' check (treatment in ('operational_cost','tax_cost','retention')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id,company_id) references public.companies(tenant_id,id) on delete cascade,
  foreign key (tenant_id,company_id,cost_center_id) references public.cost_centers(tenant_id,company_id,id) on delete cascade,
  foreign key (tenant_id,company_id,category_id) references public.financial_categories(tenant_id,company_id,id) on delete cascade
);
create unique index if not exists budget_item_treatments_scope_uq
  on public.budget_item_treatments(tenant_id,company_id,coalesce(cost_center_id,'00000000-0000-0000-0000-000000000000'::uuid),budget_year,category_id);
alter table public.budget_item_treatments enable row level security;
drop policy if exists budget_item_treatments_select on public.budget_item_treatments;
create policy budget_item_treatments_select on public.budget_item_treatments for select using (app_private.can_access_company(tenant_id,company_id));
drop policy if exists budget_item_treatments_write on public.budget_item_treatments;
create policy budget_item_treatments_write on public.budget_item_treatments for all using (app_private.can_manage_company(tenant_id,company_id)) with check (app_private.can_manage_company(tenant_id,company_id));
grant select,insert,update,delete on public.budget_item_treatments to authenticated;

insert into public.budget_item_treatments(tenant_id,company_id,cost_center_id,budget_year,category_id,treatment)
select distinct cc.tenant_id,cc.company_id,cc.id,2026,c.id,'retention'
from public.cost_centers cc
join public.financial_categories c on c.tenant_id=cc.tenant_id and c.company_id=cc.company_id
where upper(trim(cc.name))='SARTORI'
  and upper(trim(c.name)) in ('INSS','ISS','RETENÇÃO','RETENCAO')
on conflict do nothing;

drop view if exists public.budget_required_revenue_projection;
create view public.budget_required_revenue_projection
with (security_invoker=true) as
with expense as (
  select p.tenant_id,p.company_id,p.cost_center_id,p.budget_year,
         sum(p.annual_amount)::numeric(18,2) annual_expense
  from public.budget_annual_plans p
  left join public.budget_item_treatments t
    on t.tenant_id=p.tenant_id and t.company_id=p.company_id
   and t.budget_year=p.budget_year and t.category_id=p.category_id
   and t.cost_center_id is not distinct from p.cost_center_id
  where p.flow_type='expense' and coalesce(t.treatment,'operational_cost')<>'retention'
  group by p.tenant_id,p.company_id,p.cost_center_id,p.budget_year
), retention as (
  select tenant_id,company_id,contract_id,
         coalesce(sum(case when calculation_type='percentage' then rate else 0 end),0)::numeric(10,4) retention_rate_percent,
         coalesce(sum(case when calculation_type='fixed' then fixed_amount else 0 end),0)::numeric(18,2) fixed_retention_amount
  from public.engineering_contract_retention_rules where active
  group by tenant_id,company_id,contract_id
), realized as (
  select tenant_id,company_id,contract_id,extract(year from competence)::int budget_year,
         sum(gross_amount)::numeric(18,2) measured_gross,
         sum(retained_amount)::numeric(18,2) retained_actual,
         sum(net_amount)::numeric(18,2) measured_net
  from public.measurement_financial_summary
  where status in ('closed','approved','paid','received')
  group by tenant_id,company_id,contract_id,extract(year from competence)::int
)
select ps.tenant_id,ps.company_id,ps.cost_center_id,ps.budget_year,ps.contract_id,
       ps.target_markup_percent,
       coalesce(e.annual_expense,0)::numeric(18,2) annual_expense,
       round(coalesce(e.annual_expense,0)*(1+ps.target_markup_percent/100),2)::numeric(18,2) required_net_revenue,
       coalesce(r.retention_rate_percent,0)::numeric(10,4) retention_rate_percent,
       coalesce(r.fixed_retention_amount,0)::numeric(18,2) fixed_retention_amount,
       case when ps.contract_id is null then round(coalesce(e.annual_expense,0)*(1+ps.target_markup_percent/100),2)
            else round((coalesce(e.annual_expense,0)*(1+ps.target_markup_percent/100)+coalesce(r.fixed_retention_amount,0))/(1-coalesce(r.retention_rate_percent,0)/100),2) end::numeric(18,2) required_gross_revenue,
       coalesce(x.measured_gross,0)::numeric(18,2) realized_gross_revenue,
       coalesce(x.retained_actual,0)::numeric(18,2) realized_retained_amount,
       coalesce(x.measured_net,0)::numeric(18,2) realized_net_revenue
from public.budget_planning_settings ps
left join expense e on e.tenant_id=ps.tenant_id and e.company_id=ps.company_id and e.budget_year=ps.budget_year and e.cost_center_id is not distinct from ps.cost_center_id
left join retention r on r.tenant_id=ps.tenant_id and r.company_id=ps.company_id and r.contract_id=ps.contract_id
left join realized x on x.tenant_id=ps.tenant_id and x.company_id=ps.company_id and x.contract_id=ps.contract_id and x.budget_year=ps.budget_year;
grant select on public.budget_required_revenue_projection to authenticated;

commit;
