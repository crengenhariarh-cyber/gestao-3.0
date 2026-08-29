begin;

alter table public.financial_categories
  add constraint financial_categories_scope_id_unique unique (tenant_id, company_id, id);

alter table public.cost_centers
  add constraint cost_centers_scope_id_unique unique (tenant_id, company_id, id);

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  entry_type text not null check (entry_type in ('income', 'expense')),
  description text not null check (length(btrim(description)) > 0),
  counterparty_name text,
  category_id uuid not null,
  cost_center_id uuid,
  competence_month date not null check (extract(day from competence_month) = 1),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_entries_company_fk
    foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id)
    on delete restrict,
  constraint financial_entries_category_fk
    foreign key (tenant_id, company_id, category_id)
    references public.financial_categories (tenant_id, company_id, id)
    on delete restrict,
  constraint financial_entries_cost_center_fk
    foreign key (tenant_id, company_id, cost_center_id)
    references public.cost_centers (tenant_id, company_id, id)
    on delete restrict,
  unique (tenant_id, company_id, id)
);

create table public.financial_installments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  entry_id uuid not null,
  installment_number integer not null check (installment_number >= 1),
  installment_count integer not null check (installment_count >= 1),
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_installments_number_check
    check (installment_number <= installment_count),
  constraint financial_installments_entry_fk
    foreign key (tenant_id, company_id, entry_id)
    references public.financial_entries (tenant_id, company_id, id)
    on delete restrict,
  unique (entry_id, installment_number),
  unique (tenant_id, company_id, id)
);

create index financial_entries_company_competence_idx
  on public.financial_entries (tenant_id, company_id, competence_month);
create index financial_entries_category_idx
  on public.financial_entries (tenant_id, company_id, category_id);
create index financial_entries_cost_center_idx
  on public.financial_entries (tenant_id, company_id, cost_center_id)
  where cost_center_id is not null;
create index financial_installments_company_due_idx
  on public.financial_installments (tenant_id, company_id, due_date);
create index financial_installments_entry_idx
  on public.financial_installments (tenant_id, company_id, entry_id);

create trigger financial_entries_set_updated_at
before update on public.financial_entries
for each row execute function public.set_updated_at();

create trigger financial_installments_set_updated_at
before update on public.financial_installments
for each row execute function public.set_updated_at();

alter table public.financial_entries enable row level security;
alter table public.financial_installments enable row level security;

create policy financial_entries_select_authorized
on public.financial_entries
for select
to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create policy financial_entries_insert_manager
on public.financial_entries
for insert
to authenticated
with check (app_private.can_manage_company(tenant_id, company_id));

create policy financial_entries_update_manager
on public.financial_entries
for update
to authenticated
using (app_private.can_manage_company(tenant_id, company_id))
with check (app_private.can_manage_company(tenant_id, company_id));

create policy financial_installments_select_authorized
on public.financial_installments
for select
to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create policy financial_installments_insert_manager
on public.financial_installments
for insert
to authenticated
with check (app_private.can_manage_company(tenant_id, company_id));

create policy financial_installments_update_manager
on public.financial_installments
for update
to authenticated
using (app_private.can_manage_company(tenant_id, company_id))
with check (app_private.can_manage_company(tenant_id, company_id));

comment on table public.financial_entries is 'Company-scoped financial commitment header. Company scope is immutable by business rule.';
comment on table public.financial_installments is 'Explicit occurrence/installment for every financial entry; cash entries are represented as installment 1/1.';
comment on column public.financial_installments.installment_number is 'Explicit installment number exposed to all relevant finance views.';
comment on column public.financial_installments.installment_count is 'Total installments for this entry; one-time entry uses 1.';

commit;
