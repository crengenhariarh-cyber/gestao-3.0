begin;

-- Harden the shared timestamp trigger function.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Security helper functions live outside the exposed public schema.
-- SECURITY DEFINER is deliberately limited to boolean authorization checks so
-- RLS policies can inspect membership tables without recursive policy calls.
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create function app_private.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = target_tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

create function app_private.is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = target_tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and tm.role in ('tenant_owner', 'tenant_admin')
  );
$$;

create function app_private.is_company_admin(target_tenant_id uuid, target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.tenant_id = target_tenant_id
      and cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and cm.role = 'company_admin'
  );
$$;

create function app_private.can_access_company(target_tenant_id uuid, target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_private.is_tenant_admin(target_tenant_id)
    or exists (
      select 1
      from public.company_memberships cm
      where cm.tenant_id = target_tenant_id
        and cm.company_id = target_company_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    );
$$;

revoke all on function app_private.is_tenant_member(uuid) from public, anon;
revoke all on function app_private.is_tenant_admin(uuid) from public, anon;
revoke all on function app_private.is_company_admin(uuid, uuid) from public, anon;
revoke all on function app_private.can_access_company(uuid, uuid) from public, anon;

grant execute on function app_private.is_tenant_member(uuid) to authenticated;
grant execute on function app_private.is_tenant_admin(uuid) to authenticated;
grant execute on function app_private.is_company_admin(uuid, uuid) to authenticated;
grant execute on function app_private.can_access_company(uuid, uuid) to authenticated;

-- Profile: every authenticated user controls only their own profile.
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Tenant boundary: only active tenant members can see the tenant.
create policy tenants_select_member
on public.tenants
for select
to authenticated
using (app_private.is_tenant_member(id));

-- Membership visibility is intentionally narrow. Tenant owners/admins may
-- inspect the tenant roster; everyone else sees only their own membership.
create policy tenant_memberships_select_authorized
on public.tenant_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or app_private.is_tenant_admin(tenant_id)
);

-- Company access requires either tenant administration or explicit company
-- membership. This is the structural CR / PR / Pessoal isolation boundary.
create policy companies_select_authorized
on public.companies
for select
to authenticated
using (app_private.can_access_company(tenant_id, id));

create policy company_memberships_select_authorized
on public.company_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or app_private.is_tenant_admin(tenant_id)
  or app_private.is_company_admin(tenant_id, company_id)
);

-- Audit data is read-only from the client and visible only to tenant admins.
-- Writes remain reserved for trusted application/database operations.
create policy audit_log_select_tenant_admin
on public.audit_log
for select
to authenticated
using (app_private.is_tenant_admin(tenant_id));

commit;
