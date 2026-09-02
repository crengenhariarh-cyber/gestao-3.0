begin;

drop view if exists public.finance_planning_items;

create view public.finance_planning_items
with (security_invoker = true)
as
select
  fib.tenant_id,
  fib.company_id,
  ('financial:' || fib.installment_id::text) as item_key,
  'financial_installment'::text as source_kind,
  fe.entry_type,
  fe.description,
  fe.counterparty_name,
  coalesce(
    nullif(substring(coalesce(fe.notes,'') from 'parcela=([0-9]+)/[0-9]+'),'')::integer,
    fib.installment_number
  ) as installment_number,
  coalesce(
    nullif(substring(coalesce(fe.notes,'') from 'parcela=[0-9]+/([0-9]+)'),'')::integer,
    fib.installment_count
  ) as installment_count,
  fib.due_date,
  fib.remaining_amount::numeric(14,2) as amount,
  fib.financial_status::text as payment_status
from public.financial_installment_balances fib
join public.financial_entries fe
  on fe.tenant_id = fib.tenant_id
 and fe.company_id = fib.company_id
 and fe.id = fib.entry_id
where fib.remaining_amount > 0
  and coalesce(fe.notes,'') not like '%[LEGACY_RECONCILED_PAID]%'

union all

select
  ci.tenant_id,
  ci.company_id,
  ('card:' || ci.card_id::text || ':' || ci.statement_month::text) as item_key,
  'card_statement'::text as source_kind,
  'expense'::text as entry_type,
  ('Fatura ' || cc.name)::text as description,
  cc.name::text as counterparty_name,
  1::integer as installment_number,
  1::integer as installment_count,
  coalesce(
    cs.due_date,
    case
      when cc.due_day > cc.closing_day
        then (ci.statement_month + ((cc.due_day - 1)::text || ' days')::interval)::date
      else ((ci.statement_month + interval '1 month') + ((cc.due_day - 1)::text || ' days')::interval)::date
    end
  ) as due_date,
  case
    when cs.id is not null then coalesce(sb.remaining_amount, 0)::numeric(14,2)
    else sum(ci.amount)::numeric(14,2)
  end as amount,
  case
    when cs.id is null then 'open'
    else coalesce(sb.payment_status, 'pending')::text
  end as payment_status
from public.card_installments ci
join public.credit_cards cc
  on cc.tenant_id = ci.tenant_id
 and cc.company_id = ci.company_id
 and cc.id = ci.card_id
left join public.card_statements cs
  on cs.tenant_id = ci.tenant_id
 and cs.company_id = ci.company_id
 and cs.card_id = ci.card_id
 and cs.statement_month = ci.statement_month
left join public.credit_card_statement_balances sb
  on sb.statement_id = cs.id
where cc.status = 'active'
group by
  ci.tenant_id,
  ci.company_id,
  ci.card_id,
  ci.statement_month,
  cc.name,
  cc.due_day,
  cc.closing_day,
  cs.id,
  cs.due_date,
  sb.remaining_amount,
  sb.payment_status
having case when cs.id is not null then coalesce(sb.remaining_amount,0) else sum(ci.amount) end > 0;

comment on view public.finance_planning_items is 'Pending planning items. Migrated installment labels are recovered from legacy notes and reconciled legacy payments are excluded without creating a second bank movement.';

commit;
