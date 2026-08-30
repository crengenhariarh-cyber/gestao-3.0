begin;
alter table public.budget_plans drop constraint if exists budget_plans_source_kind_check;
alter table public.budget_plans add constraint budget_plans_source_kind_check check (source_kind in ('manual','salary','engineering','financial_commitment','recurring','import'));

create view public.budget_monthly_control with (security_invoker=true) as
with planned as (
 select tenant_id,company_id,cost_center_id,category_id,competence_month,sum(planned_amount)::numeric(18,2) planned_amount
 from public.budget_plans group by tenant_id,company_id,cost_center_id,category_id,competence_month
), actual as (
 select fe.tenant_id,fe.company_id,fe.cost_center_id,fe.category_id,date_trunc('month',s.settled_on)::date competence_month,
 sum(case when fe.entry_type='expense' then s.amount else 0 end)::numeric(18,2) actual_expense,
 sum(case when fe.entry_type='income' then s.amount else 0 end)::numeric(18,2) actual_income
 from public.financial_settlements s
 join public.financial_installments i on i.tenant_id=s.tenant_id and i.company_id=s.company_id and i.id=s.installment_id
 join public.financial_entries fe on fe.tenant_id=i.tenant_id and fe.company_id=i.company_id and fe.id=i.entry_id
 group by fe.tenant_id,fe.company_id,fe.cost_center_id,fe.category_id,date_trunc('month',s.settled_on)::date
), keys as (
 select tenant_id,company_id,cost_center_id,category_id,competence_month from planned
 union select tenant_id,company_id,cost_center_id,category_id,competence_month from actual
)
select k.tenant_id,k.company_id,k.cost_center_id,k.category_id,k.competence_month,
coalesce(p.planned_amount,0)::numeric(18,2) planned_amount,
coalesce(a.actual_expense,0)::numeric(18,2) actual_expense,
coalesce(a.actual_income,0)::numeric(18,2) actual_income,
(coalesce(p.planned_amount,0)-coalesce(a.actual_expense,0))::numeric(18,2) expense_budget_balance,
case when coalesce(p.planned_amount,0)>0 then round(coalesce(a.actual_expense,0)*100/coalesce(p.planned_amount,0),2) else 0 end execution_percent
from keys k
left join planned p on p.tenant_id=k.tenant_id and p.company_id=k.company_id and p.cost_center_id is not distinct from k.cost_center_id and p.category_id is not distinct from k.category_id and p.competence_month=k.competence_month
left join actual a on a.tenant_id=k.tenant_id and a.company_id=k.company_id and a.cost_center_id is not distinct from k.cost_center_id and a.category_id is not distinct from k.category_id and a.competence_month=k.competence_month;

create view public.budget_annual_control with (security_invoker=true) as
select tenant_id,company_id,cost_center_id,category_id,date_trunc('year',competence_month)::date budget_year,
sum(planned_amount)::numeric(18,2) planned_amount,sum(actual_expense)::numeric(18,2) actual_expense,sum(actual_income)::numeric(18,2) actual_income,sum(expense_budget_balance)::numeric(18,2) expense_budget_balance,
case when sum(planned_amount)>0 then round(sum(actual_expense)*100/sum(planned_amount),2) else 0 end execution_percent
from public.budget_monthly_control group by tenant_id,company_id,cost_center_id,category_id,date_trunc('year',competence_month)::date;
commit;
