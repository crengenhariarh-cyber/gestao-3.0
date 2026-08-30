begin;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 2 and 200),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table public.employment_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  employee_id uuid not null,
  hired_on date not null,
  terminated_on date,
  job_title text not null check (length(btrim(job_title)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employment_contracts_company_fk foreign key (tenant_id, company_id)
    references public.companies(tenant_id, id) on delete restrict,
  constraint employment_contracts_employee_fk foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete restrict,
  constraint employment_contracts_dates_ck check (terminated_on is null or terminated_on >= hired_on),
  unique (tenant_id, company_id, id)
);

create table public.employee_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  employment_contract_id uuid not null,
  cost_center_id uuid not null,
  valid_from date not null,
  valid_to date,
  allocation_percent numeric(5,2) not null default 100.00 check (allocation_percent > 0 and allocation_percent <= 100),
  created_at timestamptz not null default now(),
  constraint employee_allocations_contract_fk foreign key (tenant_id, company_id, employment_contract_id)
    references public.employment_contracts(tenant_id, company_id, id) on delete restrict,
  constraint employee_allocations_cost_center_fk foreign key (tenant_id, company_id, cost_center_id)
    references public.cost_centers(tenant_id, company_id, id) on delete restrict,
  constraint employee_allocations_dates_ck check (valid_to is null or valid_to >= valid_from)
);

create table public.compensation_terms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  employment_contract_id uuid not null,
  valid_from date not null,
  valid_to date,
  base_salary numeric(14,2) not null check (base_salary >= 0),
  created_at timestamptz not null default now(),
  constraint compensation_terms_contract_fk foreign key (tenant_id, company_id, employment_contract_id)
    references public.employment_contracts(tenant_id, company_id, id) on delete restrict,
  constraint compensation_terms_dates_ck check (valid_to is null or valid_to >= valid_from),
  unique (tenant_id, company_id, employment_contract_id, valid_from)
);

create index employees_tenant_idx on public.employees(tenant_id);
create index employment_contracts_company_idx on public.employment_contracts(tenant_id, company_id);
create index employment_contracts_employee_idx on public.employment_contracts(tenant_id, employee_id);
create index employee_allocations_contract_date_idx on public.employee_allocations(tenant_id, company_id, employment_contract_id, valid_from);
create index employee_allocations_cost_center_idx on public.employee_allocations(tenant_id, company_id, cost_center_id);
create index compensation_terms_contract_date_idx on public.compensation_terms(tenant_id, company_id, employment_contract_id, valid_from);

create trigger employees_set_updated_at before update on public.employees
for each row execute function public.set_updated_at();
create trigger employment_contracts_set_updated_at before update on public.employment_contracts
for each row execute function public.set_updated_at();

alter table public.employees enable row level security;
alter table public.employment_contracts enable row level security;
alter table public.employee_allocations enable row level security;
alter table public.compensation_terms enable row level security;

create policy employees_select_member on public.employees for select to authenticated
using (app_private.is_tenant_member(tenant_id));
create policy employees_insert_admin on public.employees for insert to authenticated
with check (app_private.is_tenant_admin(tenant_id));
create policy employees_update_admin on public.employees for update to authenticated
using (app_private.is_tenant_admin(tenant_id)) with check (app_private.is_tenant_admin(tenant_id));

create policy employment_contracts_select_authorized on public.employment_contracts for select to authenticated
using (app_private.can_access_company(tenant_id, company_id));
create policy employment_contracts_insert_manager on public.employment_contracts for insert to authenticated
with check (app_private.can_manage_company(tenant_id, company_id));
create policy employment_contracts_update_manager on public.employment_contracts for update to authenticated
using (app_private.can_manage_company(tenant_id, company_id)) with check (app_private.can_manage_company(tenant_id, company_id));

create policy employee_allocations_select_authorized on public.employee_allocations for select to authenticated
using (app_private.can_access_company(tenant_id, company_id));
create policy employee_allocations_insert_manager on public.employee_allocations for insert to authenticated
with check (app_private.can_manage_company(tenant_id, company_id));
create policy employee_allocations_update_manager on public.employee_allocations for update to authenticated
using (app_private.can_manage_company(tenant_id, company_id)) with check (app_private.can_manage_company(tenant_id, company_id));

create policy compensation_terms_select_authorized on public.compensation_terms for select to authenticated
using (app_private.can_access_company(tenant_id, company_id));
create policy compensation_terms_insert_manager on public.compensation_terms for insert to authenticated
with check (app_private.can_manage_company(tenant_id, company_id));
create policy compensation_terms_update_manager on public.compensation_terms for update to authenticated
using (app_private.can_manage_company(tenant_id, company_id)) with check (app_private.can_manage_company(tenant_id, company_id));

commit;
