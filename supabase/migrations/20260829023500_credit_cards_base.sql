begin;

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  name text not null,
  last_four text,
  credit_limit numeric(14,2) not null check (credit_limit >= 0),
  closing_day integer not null check (closing_day between 1 and 28),
  due_day integer not null check (due_day between 1 and 28),
  default_payment_account_id uuid,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_cards_company_fk
    foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id)
    on delete restrict,
  constraint credit_cards_payment_account_fk
    foreign key (tenant_id, company_id, default_payment_account_id)
    references public.financial_accounts (tenant_id, company_id, id)
    on delete restrict,
  constraint credit_cards_last_four_check
    check (last_four is null or last_four ~ '^[0-9]{4}$'),
  unique (tenant_id, company_id, name),
  unique (tenant_id, company_id, id)
);

create table public.card_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  card_id uuid not null,
  purchase_date date not null,
  description text not null check (length(btrim(description)) > 0),
  counterparty_name text,
  category_id uuid not null,
  cost_center_id uuid,
  total_amount numeric(14,2) not null check (total_amount > 0),
  installment_count integer not null check (installment_count between 1 and 120),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint card_transactions_card_fk
    foreign key (tenant_id, company_id, card_id)
    references public.credit_cards (tenant_id, company_id, id)
    on delete restrict,
  constraint card_transactions_category_fk
    foreign key (tenant_id, company_id, category_id)
    references public.financial_categories (tenant_id, company_id, id)
    on delete restrict,
  constraint card_transactions_cost_center_fk
    foreign key (tenant_id, company_id, cost_center_id)
    references public.cost_centers (tenant_id, company_id, id)
    on delete restrict,
  unique (tenant_id, company_id, id)
);

create table public.card_installments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  card_id uuid not null,
  transaction_id uuid not null,
  installment_number integer not null,
  installment_count integer not null,
  statement_month date not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint card_installments_card_fk
    foreign key (tenant_id, company_id, card_id)
    references public.credit_cards (tenant_id, company_id, id)
    on delete restrict,
  constraint card_installments_transaction_fk
    foreign key (tenant_id, company_id, transaction_id)
    references public.card_transactions (tenant_id, company_id, id)
    on delete restrict,
  constraint card_installments_number_check
    check (installment_number >= 1 and installment_number <= installment_count),
  constraint card_installments_statement_month_check
    check (extract(day from statement_month) = 1),
  unique (transaction_id, installment_number),
  unique (tenant_id, company_id, id)
);

create index credit_cards_company_idx on public.credit_cards (tenant_id, company_id);
create index card_transactions_card_date_idx on public.card_transactions (tenant_id, company_id, card_id, purchase_date);
create index card_installments_statement_idx on public.card_installments (tenant_id, company_id, card_id, statement_month);

create trigger credit_cards_set_updated_at
before update on public.credit_cards
for each row execute function public.set_updated_at();

alter table public.credit_cards enable row level security;
alter table public.card_transactions enable row level security;
alter table public.card_installments enable row level security;

create policy credit_cards_select_authorized
on public.credit_cards for select to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create policy credit_cards_insert_manager
on public.credit_cards for insert to authenticated
with check (app_private.can_manage_company(tenant_id, company_id));

create policy credit_cards_update_manager
on public.credit_cards for update to authenticated
using (app_private.can_manage_company(tenant_id, company_id))
with check (app_private.can_manage_company(tenant_id, company_id));

create policy card_transactions_select_authorized
on public.card_transactions for select to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create policy card_installments_select_authorized
on public.card_installments for select to authenticated
using (app_private.can_access_company(tenant_id, company_id));

revoke insert, update, delete on public.card_transactions from anon, authenticated;
revoke insert, update, delete on public.card_installments from anon, authenticated;
grant select on public.card_transactions to authenticated;
grant select on public.card_installments to authenticated;

comment on table public.credit_cards is 'Company-scoped credit card configuration, limit and statement cycle.';
comment on table public.card_transactions is 'Credit card purchase header. Purchase recognition is separate from statement payment.';
comment on table public.card_installments is 'Explicit card installment identity with number/count and statement competence.';

commit;
