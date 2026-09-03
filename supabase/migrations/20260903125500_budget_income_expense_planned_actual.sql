begin;

-- Planejamento mensal passa a distinguir explicitamente entradas e saídas.
alter table public.budget_plans
  add column if not exists flow_type text;

update public.budget_plans
set flow_type = 'expense'
where flow_type is null;

alter table public.budget_plans
  alter column flow_type set default 'expense';
alter table public.budget_plans
  alter column flow_type set not null;
alter table public.budget_plans
  drop constraint if exists budget_plans_flow_type_check;
alter table public.budget_plans
  add constraint budget_plans_flow_type_check check (flow_type in ('income','expense'));

create index if not exists budget_plans_company_month_flow_idx
  on public.budget_plans(tenant_id,company_id,competence_month,flow_type);

-- Previsto x realizado mensal por empresa, centro de custo e categoria.
create or replace view public.budget_monthly_control with (security_invoker=true) as
with planned as (
  select tenant_id,company_id,cost_center_id,category_id,competence_month,
    sum(case when flow_type='income' then planned_amount else 0 end)::numeric(18,2) planned_income,
    sum(case when flow_type='expense' then planned_amount else 0 end)::numeric(18,2) planned_expense
  from public.budget_plans
  group by tenant_id,company_id,cost_center_id,category_id,competence_month
), actual as (
  select fe.tenant_id,fe.company_id,fe.cost_center_id,fe.category_id,
    date_trunc('month',s.settled_on)::date competence_month,
    sum(case when fe.entry_type='expense' then s.amount else 0 end)::numeric(18,2) actual_expense,
    sum(case when fe.entry_type='income' then s.amount else 0 end)::numeric(18,2) actual_income
  from public.financial_settlements s
  join public.financial_installments i on i.tenant_id=s.tenant_id and i.company_id=s.company_id and i.id=s.installment_id
  join public.financial_entries fe on fe.tenant_id=i.tenant_id and fe.company_id=i.company_id and fe.id=i.entry_id
  group by fe.tenant_id,fe.company_id,fe.cost_center_id,fe.category_id,date_trunc('month',s.settled_on)::date
), keys as (
  select tenant_id,company_id,cost_center_id,category_id,competence_month from planned
  union
  select tenant_id,company_id,cost_center_id,category_id,competence_month from actual
)
select k.tenant_id,k.company_id,k.cost_center_id,k.category_id,k.competence_month,
  coalesce(p.planned_expense,0)::numeric(18,2) planned_amount,
  coalesce(p.planned_income,0)::numeric(18,2) planned_income,
  coalesce(p.planned_expense,0)::numeric(18,2) planned_expense,
  coalesce(a.actual_expense,0)::numeric(18,2) actual_expense,
  coalesce(a.actual_income,0)::numeric(18,2) actual_income,
  (coalesce(p.planned_expense,0)-coalesce(a.actual_expense,0))::numeric(18,2) expense_budget_balance,
  (coalesce(p.planned_income,0)-coalesce(a.actual_income,0))::numeric(18,2) income_budget_balance,
  (coalesce(p.planned_income,0)-coalesce(p.planned_expense,0))::numeric(18,2) planned_result,
  (coalesce(a.actual_income,0)-coalesce(a.actual_expense,0))::numeric(18,2) actual_result,
  case when coalesce(p.planned_expense,0)>0 then round(coalesce(a.actual_expense,0)*100/coalesce(p.planned_expense,0),2) else 0 end execution_percent,
  case when coalesce(p.planned_income,0)>0 then round(coalesce(a.actual_income,0)*100/coalesce(p.planned_income,0),2) else 0 end income_execution_percent
from keys k
left join planned p on p.tenant_id=k.tenant_id and p.company_id=k.company_id and p.cost_center_id is not distinct from k.cost_center_id and p.category_id is not distinct from k.category_id and p.competence_month=k.competence_month
left join actual a on a.tenant_id=k.tenant_id and a.company_id=k.company_id and a.cost_center_id is not distinct from k.cost_center_id and a.category_id is not distinct from k.category_id and a.competence_month=k.competence_month;

create or replace view public.budget_annual_control with (security_invoker=true) as
select tenant_id,company_id,cost_center_id,category_id,date_trunc('year',competence_month)::date budget_year,
  sum(planned_expense)::numeric(18,2) planned_amount,
  sum(planned_income)::numeric(18,2) planned_income,
  sum(planned_expense)::numeric(18,2) planned_expense,
  sum(actual_expense)::numeric(18,2) actual_expense,
  sum(actual_income)::numeric(18,2) actual_income,
  sum(expense_budget_balance)::numeric(18,2) expense_budget_balance,
  sum(income_budget_balance)::numeric(18,2) income_budget_balance,
  sum(planned_result)::numeric(18,2) planned_result,
  sum(actual_result)::numeric(18,2) actual_result,
  case when sum(planned_expense)>0 then round(sum(actual_expense)*100/sum(planned_expense),2) else 0 end execution_percent,
  case when sum(planned_income)>0 then round(sum(actual_income)*100/sum(planned_income),2) else 0 end income_execution_percent
from public.budget_monthly_control
group by tenant_id,company_id,cost_center_id,category_id,date_trunc('year',competence_month)::date;

-- Consolidado usado pelo painel: entrada, saída e Resultado do mês.
create or replace view public.budget_monthly_result with (security_invoker=true) as
select tenant_id,company_id,competence_month,
  sum(planned_income)::numeric(18,2) planned_income,
  sum(actual_income)::numeric(18,2) actual_income,
  sum(planned_expense)::numeric(18,2) planned_expense,
  sum(actual_expense)::numeric(18,2) actual_expense,
  (sum(planned_income)-sum(planned_expense))::numeric(18,2) planned_result,
  (sum(actual_income)-sum(actual_expense))::numeric(18,2) actual_result
from public.budget_monthly_control
group by tenant_id,company_id,competence_month;

commit;