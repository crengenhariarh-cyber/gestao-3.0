create or replace view public.budget_limit_transaction_details as
with category_map as (
  select fc.tenant_id,fc.company_id,fc.id source_category_id,fc.name source_category_name,
         case when upper(fc.name) like 'COMBUSTÍVEL%' then coalesce((select root.id from public.financial_categories root where root.tenant_id=fc.tenant_id and root.company_id=fc.company_id and upper(root.name)='COMBUSTÍVEL' and root.status='active' order by root.created_at limit 1),fc.id) else fc.id end budget_category_id
  from public.financial_categories fc
), financial_rows as (
  select fe.tenant_id,fe.company_id,fe.cost_center_id,coalesce(cm.budget_category_id,fe.category_id) budget_category_id,
         date_trunc('month',fs.settled_on)::date competence_month,
         ('financial:settlement:'||fs.id::text) detail_id,fs.settled_on movement_date,fe.description,fe.counterparty_name,
         coalesce(cm.source_category_name,fc.name) source_category_name,fs.amount::numeric(18,2) amount,
         coalesce(nullif(fe.payment_method,''),'Lançamento financeiro') payment_method,null::text card_name
  from public.financial_settlements fs
  join public.financial_installments i on i.id=fs.installment_id and i.tenant_id=fs.tenant_id and i.company_id=fs.company_id
  join public.financial_entries fe on fe.id=i.entry_id and fe.tenant_id=i.tenant_id and fe.company_id=i.company_id
  left join category_map cm on cm.tenant_id=fe.tenant_id and cm.company_id=fe.company_id and cm.source_category_id=fe.category_id
  left join public.financial_categories fc on fc.id=fe.category_id
  where fe.entry_type='expense' and fe.include_in_budget=true
), card_rows as (
  select ct.tenant_id,coalesce(ct.expense_company_id,ct.company_id) company_id,ct.cost_center_id,
         coalesce(cm.budget_category_id,ct.category_id) budget_category_id,ci.statement_month competence_month,
         ('card:installment:'||ci.id::text) detail_id,ci.statement_month movement_date,ct.description,ct.counterparty_name,
         coalesce(cm.source_category_name,fc.name) source_category_name,ci.amount::numeric(18,2) amount,
         'Cartão de crédito'::text payment_method,cc.name card_name
  from public.card_transactions ct
  join public.card_installments ci on ci.tenant_id=ct.tenant_id and ci.company_id=ct.company_id and ci.transaction_id=ct.id
  left join category_map cm on cm.tenant_id=ct.tenant_id and cm.company_id=coalesce(ct.expense_company_id,ct.company_id) and cm.source_category_id=ct.category_id
  left join public.financial_categories fc on fc.id=ct.category_id
  left join public.credit_cards cc on cc.id=ct.card_id
  where ct.purchase_date<=current_date and ci.statement_month<=date_trunc('month',current_date)::date
), rows as (
  select * from financial_rows
  union all
  select * from card_rows
)
select bl.id limit_id,bl.tenant_id,bl.company_id,bl.cost_center_id,bl.category_id,bl.competence_month,
       r.detail_id,r.movement_date,r.description,r.counterparty_name,r.source_category_name,r.amount,r.payment_method,r.card_name
from public.budget_limits bl
join rows r on r.tenant_id=bl.tenant_id and r.company_id=bl.company_id
 and r.cost_center_id is not distinct from bl.cost_center_id
 and r.budget_category_id is not distinct from bl.category_id
 and r.competence_month=bl.competence_month
where bl.status='active';

revoke all on public.budget_limit_transaction_details from public,anon;
grant select on public.budget_limit_transaction_details to authenticated;

create or replace view public.budget_monthly_control as
with planned as (
  select tenant_id,company_id,cost_center_id,category_id,competence_month,
    sum(case when flow_type='income' then planned_amount else 0 end)::numeric(18,2) planned_income,
    sum(case when flow_type='expense' then planned_amount else 0 end)::numeric(18,2) planned_expense
  from public.budget_plans
  group by tenant_id,company_id,cost_center_id,category_id,competence_month
), expense_actual as (
  select bl.tenant_id,bl.company_id,bl.cost_center_id,bl.category_id,bl.competence_month,
    coalesce(sum(d.amount),0)::numeric(18,2) actual_expense
  from public.budget_limits bl
  left join public.budget_limit_transaction_details d on d.limit_id=bl.id
  where bl.status='active'
  group by bl.tenant_id,bl.company_id,bl.cost_center_id,bl.category_id,bl.competence_month
), income_actual as (
  select fe.tenant_id,fe.company_id,fe.cost_center_id,fe.category_id,
    date_trunc('month',fs.settled_on)::date competence_month,
    coalesce(sum(fs.amount),0)::numeric(18,2) actual_income
  from public.financial_settlements fs
  join public.financial_installments fi on fi.id=fs.installment_id and fi.tenant_id=fs.tenant_id and fi.company_id=fs.company_id
  join public.financial_entries fe on fe.id=fi.entry_id and fe.tenant_id=fi.tenant_id and fe.company_id=fi.company_id
  where fe.entry_type='income' and fe.include_in_budget=true
  group by fe.tenant_id,fe.company_id,fe.cost_center_id,fe.category_id,date_trunc('month',fs.settled_on)::date
), keys as (
  select tenant_id,company_id,cost_center_id,category_id,competence_month from planned
  union select tenant_id,company_id,cost_center_id,category_id,competence_month from expense_actual
  union select tenant_id,company_id,cost_center_id,category_id,competence_month from income_actual
)
select k.tenant_id,k.company_id,k.cost_center_id,k.category_id,k.competence_month,
  coalesce(p.planned_expense,0)::numeric(18,2) planned_amount,
  coalesce(e.actual_expense,0)::numeric(18,2) actual_expense,
  coalesce(i.actual_income,0)::numeric(18,2) actual_income,
  (coalesce(p.planned_expense,0)-coalesce(e.actual_expense,0))::numeric(18,2) expense_budget_balance,
  case when coalesce(p.planned_expense,0)>0 then round(coalesce(e.actual_expense,0)*100/coalesce(p.planned_expense,0),2) else 0 end execution_percent,
  coalesce(p.planned_income,0)::numeric(18,2) planned_income,
  coalesce(p.planned_expense,0)::numeric(18,2) planned_expense,
  (coalesce(p.planned_income,0)-coalesce(i.actual_income,0))::numeric(18,2) income_budget_balance,
  (coalesce(p.planned_income,0)-coalesce(p.planned_expense,0))::numeric(18,2) planned_result,
  (coalesce(i.actual_income,0)-coalesce(e.actual_expense,0))::numeric(18,2) actual_result,
  case when coalesce(p.planned_income,0)>0 then round(coalesce(i.actual_income,0)*100/coalesce(p.planned_income,0),2) else 0 end income_execution_percent
from keys k
left join planned p on p.tenant_id=k.tenant_id and p.company_id=k.company_id and p.cost_center_id is not distinct from k.cost_center_id and p.category_id is not distinct from k.category_id and p.competence_month=k.competence_month
left join expense_actual e on e.tenant_id=k.tenant_id and e.company_id=k.company_id and e.cost_center_id is not distinct from k.cost_center_id and e.category_id is not distinct from k.category_id and e.competence_month=k.competence_month
left join income_actual i on i.tenant_id=k.tenant_id and i.company_id=k.company_id and i.cost_center_id is not distinct from k.cost_center_id and i.category_id is not distinct from k.category_id and i.competence_month=k.competence_month;
