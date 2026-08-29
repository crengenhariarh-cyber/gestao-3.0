begin;

alter table public.financial_account_movements
  drop constraint if exists financial_account_movements_source_type_check;

alter table public.financial_account_movements
  add constraint financial_account_movements_source_type_check
  check (source_type in ('settlement', 'transfer', 'card_statement_payment'));

create table public.card_statements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  card_id uuid not null,
  statement_month date not null,
  due_date date not null,
  statement_amount numeric(14,2) not null check (statement_amount > 0),
  closed_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint card_statements_card_fk
    foreign key (tenant_id, company_id, card_id)
    references public.credit_cards (tenant_id, company_id, id)
    on delete restrict,
  constraint card_statements_month_check
    check (extract(day from statement_month) = 1),
  unique (tenant_id, company_id, card_id, statement_month),
  unique (tenant_id, company_id, id)
);

create table public.card_statement_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  statement_id uuid not null,
  card_id uuid not null,
  account_id uuid not null,
  paid_on date not null,
  amount numeric(14,2) not null check (amount > 0),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 200),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint card_statement_payments_statement_fk
    foreign key (tenant_id, company_id, statement_id)
    references public.card_statements (tenant_id, company_id, id)
    on delete restrict,
  constraint card_statement_payments_card_fk
    foreign key (tenant_id, company_id, card_id)
    references public.credit_cards (tenant_id, company_id, id)
    on delete restrict,
  constraint card_statement_payments_account_fk
    foreign key (tenant_id, company_id, account_id)
    references public.financial_accounts (tenant_id, company_id, id)
    on delete restrict,
  unique (tenant_id, company_id, idempotency_key),
  unique (tenant_id, company_id, id)
);

create index card_statements_card_month_idx
  on public.card_statements (tenant_id, company_id, card_id, statement_month);
create index card_statement_payments_statement_idx
  on public.card_statement_payments (tenant_id, company_id, statement_id, paid_on);

alter table public.card_statements enable row level security;
alter table public.card_statement_payments enable row level security;

create policy card_statements_select_authorized
on public.card_statements for select to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create policy card_statement_payments_select_authorized
on public.card_statement_payments for select to authenticated
using (app_private.can_access_company(tenant_id, company_id));

revoke insert, update, delete on public.card_statements from anon, authenticated;
revoke insert, update, delete on public.card_statement_payments from anon, authenticated;
grant select on public.card_statements to authenticated;
grant select on public.card_statement_payments to authenticated;

create view public.credit_card_statement_balances
with (security_invoker = true)
as
select
  cs.id as statement_id,
  cs.tenant_id,
  cs.company_id,
  cs.card_id,
  cs.statement_month,
  cs.due_date,
  cs.statement_amount,
  coalesce(sum(csp.amount), 0)::numeric(14,2) as paid_amount,
  greatest(cs.statement_amount - coalesce(sum(csp.amount), 0), 0)::numeric(14,2) as remaining_amount,
  case
    when coalesce(sum(csp.amount), 0) = 0 then 'pending'
    when coalesce(sum(csp.amount), 0) < cs.statement_amount then 'partial'
    else 'paid'
  end as payment_status
from public.card_statements cs
left join public.card_statement_payments csp
  on csp.tenant_id = cs.tenant_id
  and csp.company_id = cs.company_id
  and csp.statement_id = cs.id
group by cs.id, cs.tenant_id, cs.company_id, cs.card_id, cs.statement_month,
  cs.due_date, cs.statement_amount;

revoke all on public.credit_card_statement_balances from public, anon;
grant select on public.credit_card_statement_balances to authenticated;

drop view public.credit_card_limits;
create view public.credit_card_limits
with (security_invoker = true)
as
with installment_totals as (
  select tenant_id, company_id, card_id, coalesce(sum(amount),0)::numeric(14,2) as total
  from public.card_installments
  group by tenant_id, company_id, card_id
), payment_totals as (
  select tenant_id, company_id, card_id, coalesce(sum(amount),0)::numeric(14,2) as total
  from public.card_statement_payments
  group by tenant_id, company_id, card_id
)
select
  cc.id as card_id,
  cc.tenant_id,
  cc.company_id,
  cc.name,
  cc.credit_limit,
  greatest(coalesce(it.total,0) - coalesce(pt.total,0), 0)::numeric(14,2) as committed_amount,
  greatest(cc.credit_limit - greatest(coalesce(it.total,0) - coalesce(pt.total,0), 0), 0)::numeric(14,2) as available_limit
from public.credit_cards cc
left join installment_totals it
  on it.tenant_id=cc.tenant_id and it.company_id=cc.company_id and it.card_id=cc.id
left join payment_totals pt
  on pt.tenant_id=cc.tenant_id and pt.company_id=cc.company_id and pt.card_id=cc.id;

revoke all on public.credit_card_limits from public, anon;
grant select on public.credit_card_limits to authenticated;

comment on table public.card_statements is 'Closed credit-card statement snapshot. Closing and payment are separate operations.';
comment on table public.card_statement_payments is 'Statement payment history. It moves account balance but never creates a second expense.';
comment on view public.credit_card_statement_balances is 'Derived pending/partial/paid status for closed card statements.';

commit;
