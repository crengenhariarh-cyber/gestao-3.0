create index if not exists provisional_contracts_converted_by_idx on public.provisional_contracts(converted_by) where converted_by is not null;

create or replace view public.finance_company_operational_summary
with (security_invoker=true) as
with account_totals as (
  select tenant_id, company_id,
    coalesce(sum(current_balance),0)::numeric(14,2) as account_balance
  from public.financial_account_balances
  group by tenant_id,company_id
), installment_totals as (
  select tenant_id,company_id,
    coalesce(sum(open_amount) filter(where entry_type='expense' and payment_status in ('pending','partial','overdue')),0)::numeric(14,2) as payable_open,
    coalesce(sum(open_amount) filter(where entry_type='income' and payment_status in ('pending','partial','overdue')),0)::numeric(14,2) as receivable_open,
    coalesce(sum(open_amount) filter(where payment_status='overdue'),0)::numeric(14,2) as overdue_open
  from public.finance_operational_installments
  group by tenant_id,company_id
), card_totals as (
  select tenant_id,company_id,
    total_credit_limit,committed_amount,available_limit,current_open_statements,overdue_statements
  from public.finance_cards_company_summary
), attention_totals as (
  select tenant_id,company_id,count(*)::integer as attention_items,coalesce(sum(amount),0)::numeric(14,2) as attention_amount
  from public.finance_operational_attention
  group by tenant_id,company_id
)
select c.tenant_id,c.id as company_id,
  coalesce(a.account_balance,0)::numeric(14,2) as account_balance,
  coalesce(i.payable_open,0)::numeric(14,2) as payable_open,
  coalesce(i.receivable_open,0)::numeric(14,2) as receivable_open,
  coalesce(i.overdue_open,0)::numeric(14,2) as overdue_open,
  coalesce(k.total_credit_limit,0)::numeric(14,2) as card_credit_limit,
  coalesce(k.committed_amount,0)::numeric(14,2) as card_committed,
  coalesce(k.available_limit,0)::numeric(14,2) as card_available,
  coalesce(k.current_open_statements,0)::numeric(14,2) as card_open_statements,
  coalesce(k.overdue_statements,0)::numeric(14,2) as card_overdue_statements,
  coalesce(t.attention_items,0)::integer as attention_items,
  coalesce(t.attention_amount,0)::numeric(14,2) as attention_amount
from public.companies c
left join account_totals a on a.tenant_id=c.tenant_id and a.company_id=c.id
left join installment_totals i on i.tenant_id=c.tenant_id and i.company_id=c.id
left join card_totals k on k.tenant_id=c.tenant_id and k.company_id=c.id
left join attention_totals t on t.tenant_id=c.tenant_id and t.company_id=c.id;

comment on view public.finance_company_operational_summary is 'Consolidated operational finance summary per tenant/company. Realized cash remains settlement-based; transfers are not income/expense.';