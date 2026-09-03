begin;

create or replace view public.budget_monthly_control as
with category_map as (
  select fc.tenant_id,fc.company_id,fc.id source_category_id,
         case when upper(fc.name) like 'COMBUSTÍVEL%' then coalesce((select root.id from public.financial_categories root where root.tenant_id=fc.tenant_id and root.company_id=fc.company_id and upper(root.name)='COMBUSTÍVEL' and root.status='active' order by root.created_at limit 1),fc.id) else fc.id end budget_category_id
  from public.financial_categories fc
), planned as (
  select bp.tenant_id,bp.company_id,bp.cost_center_id,bp.category_id,bp.competence_month,sum(bp.planned_amount)::numeric(18,2) planned_amount
  from public.budget_plans bp group by bp.tenant_id,bp.company_id,bp.cost_center_id,bp.category_id,bp.competence_month
), financial_actual as (
  select fe.tenant_id,fe.company_id,fe.cost_center_id,coalesce(cm.budget_category_id,fe.category_id) category_id,i.competence_month,
         sum(case when fe.entry_type='expense' then i.amount else 0 end)::numeric(18,2) actual_expense,
         sum(case when fe.entry_type='income' then i.amount else 0 end)::numeric(18,2) actual_income
  from public.financial_entries fe join public.financial_installments i on i.tenant_id=fe.tenant_id and i.company_id=fe.company_id and i.entry_id=fe.id
  left join category_map cm on cm.tenant_id=fe.tenant_id and cm.company_id=fe.company_id and cm.source_category_id=fe.category_id
  group by fe.tenant_id,fe.company_id,fe.cost_center_id,coalesce(cm.budget_category_id,fe.category_id),i.competence_month
), card_actual as (
  select ct.tenant_id,coalesce(ct.expense_company_id,ct.company_id) company_id,ct.cost_center_id,coalesce(cm.budget_category_id,ct.category_id) category_id,
         date_trunc('month',ct.purchase_date::timestamp with time zone)::date competence_month,
         sum(ci.amount)::numeric(18,2) actual_expense,0::numeric(18,2) actual_income
  from public.card_transactions ct join public.card_installments ci on ci.tenant_id=ct.tenant_id and ci.company_id=ct.company_id and ci.transaction_id=ct.id
  left join category_map cm on cm.tenant_id=ct.tenant_id and cm.company_id=coalesce(ct.expense_company_id,ct.company_id) and cm.source_category_id=ct.category_id
  group by ct.tenant_id,coalesce(ct.expense_company_id,ct.company_id),ct.cost_center_id,coalesce(cm.budget_category_id,ct.category_id),date_trunc('month',ct.purchase_date::timestamp with time zone)::date
), actual as (
  select x.tenant_id,x.company_id,x.cost_center_id,x.category_id,x.competence_month,sum(x.actual_expense)::numeric(18,2) actual_expense,sum(x.actual_income)::numeric(18,2) actual_income
  from (select * from financial_actual union all select * from card_actual) x
  group by x.tenant_id,x.company_id,x.cost_center_id,x.category_id,x.competence_month
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

create or replace view public.budget_limit_transaction_details as
with category_map as (
  select fc.tenant_id,fc.company_id,fc.id source_category_id,fc.name source_category_name,
         case when upper(fc.name) like 'COMBUSTÍVEL%' then coalesce((select root.id from public.financial_categories root where root.tenant_id=fc.tenant_id and root.company_id=fc.company_id and upper(root.name)='COMBUSTÍVEL' and root.status='active' order by root.created_at limit 1),fc.id) else fc.id end budget_category_id
  from public.financial_categories fc
), financial_rows as (
  select fe.tenant_id,fe.company_id,fe.cost_center_id,coalesce(cm.budget_category_id,fe.category_id) budget_category_id,i.competence_month,
         ('financial:'||i.id::text) detail_id,i.due_date movement_date,fe.description,fe.counterparty_name,coalesce(cm.source_category_name,fc.name) source_category_name,
         i.amount::numeric(18,2) amount,coalesce(nullif(fe.payment_method,''),'Lançamento financeiro') payment_method,null::text card_name
  from public.financial_entries fe join public.financial_installments i on i.tenant_id=fe.tenant_id and i.company_id=fe.company_id and i.entry_id=fe.id
  left join category_map cm on cm.tenant_id=fe.tenant_id and cm.company_id=fe.company_id and cm.source_category_id=fe.category_id
  left join public.financial_categories fc on fc.id=fe.category_id where fe.entry_type='expense'
), card_rows as (
  select ct.tenant_id,coalesce(ct.expense_company_id,ct.company_id) company_id,ct.cost_center_id,coalesce(cm.budget_category_id,ct.category_id) budget_category_id,
         date_trunc('month',ct.purchase_date::timestamp with time zone)::date competence_month,
         ('card:'||ct.id::text) detail_id,ct.purchase_date movement_date,ct.description,ct.counterparty_name,coalesce(cm.source_category_name,fc.name) source_category_name,
         sum(ci.amount)::numeric(18,2) amount,'Cartão de crédito'::text payment_method,cc.name card_name
  from public.card_transactions ct join public.card_installments ci on ci.tenant_id=ct.tenant_id and ci.company_id=ct.company_id and ci.transaction_id=ct.id
  left join category_map cm on cm.tenant_id=ct.tenant_id and cm.company_id=coalesce(ct.expense_company_id,ct.company_id) and cm.source_category_id=ct.category_id
  left join public.financial_categories fc on fc.id=ct.category_id left join public.credit_cards cc on cc.id=ct.card_id
  group by ct.tenant_id,coalesce(ct.expense_company_id,ct.company_id),ct.cost_center_id,coalesce(cm.budget_category_id,ct.category_id),date_trunc('month',ct.purchase_date::timestamp with time zone)::date,ct.id,ct.purchase_date,ct.description,ct.counterparty_name,coalesce(cm.source_category_name,fc.name),cc.name
), rows as (select * from financial_rows union all select * from card_rows)
select bl.id limit_id,bl.tenant_id,bl.company_id,bl.cost_center_id,bl.category_id,bl.competence_month,r.detail_id,r.movement_date,r.description,r.counterparty_name,r.source_category_name,r.amount,r.payment_method,r.card_name
from public.budget_limits bl join rows r on r.tenant_id=bl.tenant_id and r.company_id=bl.company_id and r.cost_center_id is not distinct from bl.cost_center_id and r.budget_category_id is not distinct from bl.category_id and r.competence_month=bl.competence_month
where bl.status='active';

revoke all on public.budget_limit_transaction_details from public,anon;
grant select on public.budget_limit_transaction_details to authenticated;

commit;
