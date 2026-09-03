begin;

alter table public.budget_planning_settings alter column target_net_margin_percent set default 20;

create or replace view public.budget_required_revenue_projection as
with expense as (
  select p.tenant_id,p.company_id,p.cost_center_id,p.budget_year,sum(p.annual_amount)::numeric(18,2) annual_expense
  from public.budget_annual_plans p
  left join public.financial_categories c
    on c.tenant_id=p.tenant_id and c.company_id=p.company_id and c.id=p.category_id
  where p.flow_type='expense'
    and upper(trim(coalesce(c.name,''))) not in ('INSS','ISS','RT','RETENÇÃO','RETENCAO','RETENÇÃO TÉCNICA','RETENCAO TECNICA')
    and upper(trim(coalesce(c.name,''))) not like 'RETENÇÃO %'
    and upper(trim(coalesce(c.name,''))) not like 'RETENCAO %'
  group by p.tenant_id,p.company_id,p.cost_center_id,p.budget_year
), retention as (
  select tenant_id,company_id,contract_id,
         coalesce(sum(case when calculation_type='percentage' then rate else 0 end),0)::numeric(10,4) retention_rate_percent,
         coalesce(sum(case when calculation_type='fixed' then fixed_amount else 0 end),0)::numeric(18,2) fixed_retention_amount
  from public.engineering_contract_retention_rules where active group by tenant_id,company_id,contract_id
), realized as (
  select tenant_id,company_id,contract_id,extract(year from competence)::int budget_year,
         sum(gross_amount)::numeric(18,2) measured_gross,sum(retained_amount)::numeric(18,2) retained_actual,sum(net_amount)::numeric(18,2) measured_net
  from public.measurement_financial_summary where status in ('closed','approved','paid','received')
  group by tenant_id,company_id,contract_id,extract(year from competence)::int
)
select ps.tenant_id,ps.company_id,ps.cost_center_id,ps.budget_year,ps.contract_id,ps.target_net_margin_percent,
       coalesce(e.annual_expense,0)::numeric(18,2) annual_expense,
       round(coalesce(e.annual_expense,0)/(1-ps.target_net_margin_percent/100),2)::numeric(18,2) required_net_revenue,
       coalesce(r.retention_rate_percent,0)::numeric(10,4) retention_rate_percent,
       coalesce(r.fixed_retention_amount,0)::numeric(18,2) fixed_retention_amount,
       case when ps.contract_id is null then round(coalesce(e.annual_expense,0)/(1-ps.target_net_margin_percent/100),2)
            else round((coalesce(e.annual_expense,0)/(1-ps.target_net_margin_percent/100)+coalesce(r.fixed_retention_amount,0))/(1-coalesce(r.retention_rate_percent,0)/100),2) end::numeric(18,2) required_gross_revenue,
       coalesce(x.measured_gross,0)::numeric(18,2) realized_gross_revenue,
       coalesce(x.retained_actual,0)::numeric(18,2) realized_retained_amount,
       coalesce(x.measured_net,0)::numeric(18,2) realized_net_revenue
from public.budget_planning_settings ps
left join expense e on e.tenant_id=ps.tenant_id and e.company_id=ps.company_id and e.budget_year=ps.budget_year and e.cost_center_id is not distinct from ps.cost_center_id
left join retention r on r.tenant_id=ps.tenant_id and r.company_id=ps.company_id and r.contract_id=ps.contract_id
left join realized x on x.tenant_id=ps.tenant_id and x.company_id=ps.company_id and x.contract_id=ps.contract_id and x.budget_year=ps.budget_year;

grant select on public.budget_required_revenue_projection to authenticated;

commit;
