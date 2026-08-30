begin;
alter policy budget_limits_insert on public.budget_limits with check (app_private.can_manage_company(tenant_id, company_id));
alter policy budget_limits_update on public.budget_limits using (app_private.can_manage_company(tenant_id, company_id)) with check (app_private.can_manage_company(tenant_id, company_id));
alter policy budget_limits_delete on public.budget_limits using (app_private.can_manage_company(tenant_id, company_id));
commit;
