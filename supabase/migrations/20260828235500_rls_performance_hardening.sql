begin;

create index tenant_memberships_user_id_idx
  on public.tenant_memberships (user_id);

create index company_memberships_company_idx
  on public.company_memberships (tenant_id, company_id);

create index company_memberships_user_id_idx
  on public.company_memberships (user_id);

create index audit_log_tenant_id_idx
  on public.audit_log (tenant_id);

create index audit_log_company_idx
  on public.audit_log (tenant_id, company_id);

create index audit_log_actor_user_id_idx
  on public.audit_log (actor_user_id);

-- Cache auth.uid() once per statement instead of recalculating per row.
drop policy profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy tenant_memberships_select_authorized on public.tenant_memberships;
create policy tenant_memberships_select_authorized
on public.tenant_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or app_private.is_tenant_admin(tenant_id)
);

drop policy company_memberships_select_authorized on public.company_memberships;
create policy company_memberships_select_authorized
on public.company_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or app_private.is_tenant_admin(tenant_id)
  or app_private.is_company_admin(tenant_id, company_id)
);

commit;
