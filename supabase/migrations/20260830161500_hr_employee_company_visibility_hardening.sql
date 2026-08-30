begin;
create or replace function app_private.can_access_employee(target_tenant_id uuid,target_employee_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select app_private.is_tenant_admin(target_tenant_id)
    or exists (
      select 1 from public.employment_contracts ec
      where ec.tenant_id=target_tenant_id
        and ec.employee_id=target_employee_id
        and app_private.can_access_company(ec.tenant_id,ec.company_id)
    );
$$;
revoke all on function app_private.can_access_employee(uuid,uuid) from public,anon;
grant execute on function app_private.can_access_employee(uuid,uuid) to authenticated;
drop policy if exists employees_select_member on public.employees;
create policy employees_select_authorized_company on public.employees
for select to authenticated
using (app_private.can_access_employee(tenant_id,id));
commit;
