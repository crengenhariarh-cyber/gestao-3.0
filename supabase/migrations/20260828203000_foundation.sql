begin;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  legal_name text not null,
  trade_name text,
  tax_id text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, tax_id)
);

create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('tenant_owner', 'tenant_admin', 'manager', 'operator', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('company_admin', 'manager', 'operator', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_memberships_company_fk
    foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id)
    on delete cascade,
  unique (company_id, user_id)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  company_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_company_fk
    foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id)
    on delete restrict
);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tenants',
    'profiles',
    'companies',
    'tenant_memberships',
    'company_memberships'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.company_memberships enable row level security;
alter table public.audit_log enable row level security;

comment on table public.tenants is 'Top-level tenant boundary for Gestão 3.0.';
comment on table public.companies is 'Companies scoped to a tenant. Business-domain tables must carry tenant_id and company_id.';
comment on table public.tenant_memberships is 'Tenant-level authorization membership.';
comment on table public.company_memberships is 'Company-level authorization membership.';
comment on table public.audit_log is 'Append-only audit foundation for critical business actions.';

commit;
