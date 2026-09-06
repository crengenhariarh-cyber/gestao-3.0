create table if not exists public.engineering_measurement_origin_profiles(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  work_id uuid not null,
  origin_key text not null,
  origin_name text not null,
  origin_type text not null check(origin_type in('tower','addendum','provisional','other')),
  floor_count integer not null default 0,
  has_ground boolean not null default false,
  modes text[] not null default '{}',
  enterprise_type text not null default 'apartamentos',
  houses text[] not null default '{}',
  legacy_origin_id uuid,
  status text not null default 'active' check(status in('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,company_id,work_id,origin_key)
);

create table if not exists public.engineering_measurement_service_scopes(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  work_id uuid not null,
  origin_key text not null,
  service_code text not null,
  scope_active boolean not null default false,
  start_floor integer,
  scope_floors text[] not null default '{}',
  scope_units text[] not null default '{}',
  original_quantity numeric(18,6),
  scoped_quantity numeric(18,6),
  outside_quantity numeric(18,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,company_id,work_id,origin_key,service_code)
);

create index if not exists engineering_measurement_origin_profiles_work_idx on public.engineering_measurement_origin_profiles(tenant_id,company_id,work_id,status);
create index if not exists engineering_measurement_service_scopes_work_idx on public.engineering_measurement_service_scopes(tenant_id,company_id,work_id,origin_key);

alter table public.engineering_measurement_origin_profiles enable row level security;
alter table public.engineering_measurement_service_scopes enable row level security;

drop policy if exists engineering_measurement_origin_profiles_select on public.engineering_measurement_origin_profiles;
create policy engineering_measurement_origin_profiles_select on public.engineering_measurement_origin_profiles for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
drop policy if exists engineering_measurement_origin_profiles_write on public.engineering_measurement_origin_profiles;
create policy engineering_measurement_origin_profiles_write on public.engineering_measurement_origin_profiles for all to authenticated using(app_private.can_access_company(tenant_id,company_id)) with check(app_private.can_access_company(tenant_id,company_id));

drop policy if exists engineering_measurement_service_scopes_select on public.engineering_measurement_service_scopes;
create policy engineering_measurement_service_scopes_select on public.engineering_measurement_service_scopes for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
drop policy if exists engineering_measurement_service_scopes_write on public.engineering_measurement_service_scopes;
create policy engineering_measurement_service_scopes_write on public.engineering_measurement_service_scopes for all to authenticated using(app_private.can_access_company(tenant_id,company_id)) with check(app_private.can_access_company(tenant_id,company_id));
