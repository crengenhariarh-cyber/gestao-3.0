create or replace view public.finance_card_installments_operational
with (security_invoker = true) as
select
  ci.tenant_id, ci.company_id, ci.card_id, cc.name as card_name,
  ci.transaction_id, ct.purchase_date, ct.description, ct.counterparty_name,
  ct.category_id, ct.cost_center_id,
  ci.installment_number, ci.installment_count,
  (ci.installment_number::text || '/' || ci.installment_count::text) as installment_label,
  ci.statement_month, ci.amount,
  cs.id as statement_id, cs.due_date,
  case when cs.id is null then 'open_statement' else coalesce(sb.payment_status,'pending') end as statement_status,
  coalesce(sb.paid_amount,0)::numeric(14,2) as statement_paid_amount,
  coalesce(sb.remaining_amount,ci.amount)::numeric(14,2) as statement_remaining_amount
from public.card_installments ci
join public.credit_cards cc on cc.tenant_id=ci.tenant_id and cc.company_id=ci.company_id and cc.id=ci.card_id
join public.card_transactions ct on ct.tenant_id=ci.tenant_id and ct.company_id=ci.company_id and ct.id=ci.transaction_id
left join public.card_statements cs on cs.tenant_id=ci.tenant_id and cs.company_id=ci.company_id and cs.card_id=ci.card_id and cs.statement_month=ci.statement_month
left join public.credit_card_statement_balances sb on sb.statement_id=cs.id;

create or replace view public.finance_card_statements_operational
with (security_invoker = true) as
select
  cs.tenant_id, cs.company_id, cs.card_id, cc.name as card_name,
  cs.id as statement_id, cs.statement_month, cs.due_date, cs.statement_amount,
  sb.paid_amount, sb.remaining_amount,
  case
    when sb.payment_status='paid' then 'paid'
    when sb.payment_status='partial' and cs.due_date < current_date then 'partial_overdue'
    when sb.payment_status='partial' then 'partial'
    when cs.due_date < current_date then 'overdue'
    else 'pending'
  end as operational_status,
  count(ci.id)::integer as installment_lines,
  coalesce(sum(case when ci.installment_number=1 then 1 else 0 end),0)::integer as purchase_count
from public.card_statements cs
join public.credit_cards cc on cc.tenant_id=cs.tenant_id and cc.company_id=cs.company_id and cc.id=cs.card_id
join public.credit_card_statement_balances sb on sb.statement_id=cs.id
left join public.card_installments ci on ci.tenant_id=cs.tenant_id and ci.company_id=cs.company_id and ci.card_id=cs.card_id and ci.statement_month=cs.statement_month
group by cs.tenant_id,cs.company_id,cs.card_id,cc.name,cs.id,cs.statement_month,cs.due_date,cs.statement_amount,sb.paid_amount,sb.remaining_amount,sb.payment_status;

create or replace view public.finance_cards_dashboard
with (security_invoker = true) as
select
  cc.tenant_id, cc.company_id, cc.id as card_id, cc.name as card_name, cc.status,
  cc.credit_limit, cl.committed_amount, cl.available_limit,
  coalesce(sum(case when so.operational_status in ('pending','partial') then so.remaining_amount else 0 end),0)::numeric(14,2) as current_open_statements,
  coalesce(sum(case when so.operational_status in ('overdue','partial_overdue') then so.remaining_amount else 0 end),0)::numeric(14,2) as overdue_statements,
  min(so.due_date) filter (where so.operational_status in ('pending','partial','overdue','partial_overdue')) as next_open_due_date
from public.credit_cards cc
join public.credit_card_limits cl on cl.tenant_id=cc.tenant_id and cl.company_id=cc.company_id and cl.card_id=cc.id
left join public.finance_card_statements_operational so on so.tenant_id=cc.tenant_id and so.company_id=cc.company_id and so.card_id=cc.id
group by cc.tenant_id,cc.company_id,cc.id,cc.name,cc.status,cc.credit_limit,cl.committed_amount,cl.available_limit;

create index if not exists card_installments_transaction_fk_idx on public.card_installments(transaction_id);
create index if not exists card_statement_payments_account_fk_idx on public.card_statement_payments(account_id);
create index if not exists card_statement_payments_card_fk_idx on public.card_statement_payments(card_id);
create index if not exists card_transactions_category_fk_idx on public.card_transactions(category_id);
create index if not exists card_transactions_cost_center_fk_idx on public.card_transactions(cost_center_id);
create index if not exists credit_cards_payment_account_fk_idx on public.credit_cards(default_payment_account_id);

comment on view public.finance_card_installments_operational is 'Operational card installment projection. Installment number/count are explicit for every row.';
comment on view public.finance_card_statements_operational is 'Closed card statements with partial-payment and overdue operational status.';
comment on view public.finance_cards_dashboard is 'Card dashboard with credit limit, committed amount, restored available limit, open and overdue statements.';