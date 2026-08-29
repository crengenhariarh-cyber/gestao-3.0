begin;

create view public.finance_monthly_items
with (security_invoker = true)
as
select
  fib.tenant_id,
  fib.company_id,
  'financial_installment'::text as source_kind,
  fib.installment_id as item_id,
  fib.entry_id as parent_id,
  fib.competence_month,
  fib.due_date,
  fe.entry_type,
  fe.description,
  fe.counterparty_name,
  fe.category_id,
  fe.cost_center_id,
  fib.installment_number,
  fib.installment_count,
  fib.installment_amount::numeric(14,2) as planned_amount,
  fib.settled_amount::numeric(14,2) as realized_amount,
  fib.remaining_amount::numeric(14,2) as pending_amount,
  fib.financial_status as payment_status
from public.financial_installment_balances fib
join public.financial_entries fe
  on fe.tenant_id = fib.tenant_id
  and fe.company_id = fib.company_id
  and fe.id = fib.entry_id

union all

select
  ci.tenant_id,
  ci.company_id,
  'card_installment'::text as source_kind,
  ci.id as item_id,
  ci.transaction_id as parent_id,
  ci.statement_month as competence_month,
  coalesce(
    cs.due_date,
    (ci.statement_month + ((cc.due_day - 1)::text || ' days')::interval)::date
  ) as due_date,
  'expense'::text as entry_type,
  ct.description,
  ct.counterparty_name,
  ct.category_id,
  ct.cost_center_id,
  ci.installment_number,
  ci.installment_count,
  ci.amount::numeric(14,2) as planned_amount,
  ci.amount::numeric(14,2) as realized_amount,
  0::numeric(14,2) as pending_amount,
  case
    when cs.id is null then 'open'
    when coalesce(csp.paid_total, 0) = 0 then 'pending'
    when coalesce(csp.paid_total, 0) < cs.statement_amount then 'partial'
    else 'paid'
  end as payment_status
from public.card_installments ci
join public.card_transactions ct
  on ct.tenant_id = ci.tenant_id
  and ct.company_id = ci.company_id
  and ct.id = ci.transaction_id
join public.credit_cards cc
  on cc.tenant_id = ci.tenant_id
  and cc.company_id = ci.company_id
  and cc.id = ci.card_id
left join public.card_statements cs
  on cs.tenant_id = ci.tenant_id
  and cs.company_id = ci.company_id
  and cs.card_id = ci.card_id
  and cs.statement_month = ci.statement_month
left join lateral (
  select coalesce(sum(csp0.amount), 0)::numeric(14,2) as paid_total
  from public.card_statement_payments csp0
  where csp0.tenant_id = cs.tenant_id
    and csp0.company_id = cs.company_id
    and csp0.statement_id = cs.id
) csp on true;

revoke all on public.finance_monthly_items from public, anon;
grant select on public.finance_monthly_items to authenticated;

comment on view public.finance_monthly_items is
'Unified monthly operating view. Ordinary entries realize through settlements; card installments realize in statement competence, while statement payments affect cash only and do not duplicate operating expense.';

commit;
