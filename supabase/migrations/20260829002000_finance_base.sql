begin;

create function app_private.can_manage_company(target_tenant_id uuid, target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_private.is_tenant_admin(target_tenant_id)
    or app_private.is_company_admin(target_tenant_id, target_company_id)
    or exists (
      select 1
      from public.company_memberships cm
      where cm.tenant_id = target_tenant_id
        and cm.company_id = target_company_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.role = 'manager'
    );
$$;

revoke all on function app_private.can_manage_company(uuid, uuid) from public, anon;
grant execute on function app_private.can_manage_company(uuid, uuid) to authenticated;

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  name text not null,
  kind text not null check (kind in ('income', 'expense', 'both')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_categories_company_fk
    foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id)
    on delete restrict,
  unique (tenant_id, company_id, name)
);

create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  name text not null,
  code text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cost_centers_company_fk
    foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id)
    on delete restrict,
  unique (tenant_id, company_id, name),
  unique (tenant_id, company_id, code)
);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  name text not null,
  account_type text not null check (account_type in ('bank', 'cash', 'other')),
  opening_balance numeric(14,2) not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_accounts_company_fk
    foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id)
    on delete restrict,
  unique (tenant_id, company_id, name)
);

create index financial_categories_company_idx on public.financial_categories (tenant_id, company_id);
create index cost_centers_company_idx on public.cost_centers (tenant_id, company_id);
create index financial_accounts_company_idx on public.financial_accounts (tenant_id, company_id);

create trigger financial_categories_set_updated_at
before update on public.financial_categories
for each row execute function public.set_updated_at();

create trigger cost_centers_set_updated_at
before update on public.cost_centers
for each row execute function public.set_updated_at();

create trigger financial_accounts_set_updated_at
before update on public.financial_accounts
for each row execute function public.set_updated_at();

alter table public.financial_categories enable row level security;
alter table public.cost_centers enable row level security;
alter table public.financial_accounts enable row level security;

create policy financial_categories_select_authorized
on public.financial_categories
for select
to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create policy financial_categories_insert_manager
on public.financial_categories
for insert
to authenticated
with check (app_private.can_manage_company(tenant_id, company_id));

create policy financial_categories_update_manager
on public.financial_categories
for update
to authenticated
using (app_private.can_manage_company(tenant_id, company_id))
with check (app_private.can_manage_company(tenant_id, company_id));

create policy cost_centers_select_authorized
on public.cost_centers
for select
to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create policy cost_centers_insert_manager
on public.cost_centers
for insert
to authenticated
with check (app_private.can_manage_company(tenant_id, company_id));

create policy cost_centers_update_manager
on public.cost_centers
for update
to authenticated
using (app_private.can_manage_company(tenant_id, company_id))
with check (app_private.can_manage_company(tenant_id, company_id));

create policy financial_accounts_select_authorized
on public.financial_accounts
for select
to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create policy financial_accounts_insert_manager
on public.financial_accounts
for insert
to authenticated
with check (app_private.can_manage_company(tenant_id, company_id));

create policy financial_accounts_update_manager
on public.financial_accounts
for update
to authenticated
using (app_private.can_manage_company(tenant_id, company_id))
with check (app_private.can_manage_company(tenant_id, company_id));

comment on table public.financial_categories is 'Company-scoped financial classification for income and expense entries.';
comment on table public.cost_centers is 'Company-scoped cost center or work/project reference shared by finance and later domains.';
comment on table public.financial_accounts is 'Company-scoped real balance account such as bank or cash.';

commit;
