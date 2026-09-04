create table public.finance_counterparties (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null,
  name text not null, kind text not null default 'supplier' check (kind in ('supplier','payer','both')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint finance_counterparties_name_upper check (name = upper(name)),
  constraint finance_counterparties_unique unique (tenant_id, company_id, name, kind)
);
create index finance_counterparties_company_idx on public.finance_counterparties (tenant_id, company_id, status, name);
alter table public.finance_counterparties enable row level security;
create policy finance_counterparties_select_authorized on public.finance_counterparties for select to authenticated using (app_private.can_access_company(tenant_id, company_id));
create policy finance_counterparties_insert_manager on public.finance_counterparties for insert to authenticated with check (app_private.can_manage_company(tenant_id, company_id));
create policy finance_counterparties_update_manager on public.finance_counterparties for update to authenticated using (app_private.can_manage_company(tenant_id, company_id)) with check (app_private.can_manage_company(tenant_id, company_id));