begin;

alter policy engineering_production_entries_insert on public.engineering_production_entries with check (app_private.can_edit_company(tenant_id, company_id));
alter policy engineering_production_entries_update on public.engineering_production_entries using (app_private.can_edit_company(tenant_id, company_id)) with check (app_private.can_edit_company(tenant_id, company_id));
alter policy engineering_production_entries_delete on public.engineering_production_entries using (app_private.can_edit_company(tenant_id, company_id));

alter policy engineering_production_periods_insert on public.engineering_production_periods with check (app_private.can_edit_company(tenant_id, company_id));
alter policy engineering_production_periods_update on public.engineering_production_periods using (app_private.can_edit_company(tenant_id, company_id)) with check (app_private.can_edit_company(tenant_id, company_id));
alter policy engineering_production_periods_delete on public.engineering_production_periods using (app_private.can_edit_company(tenant_id, company_id));

alter policy engineering_revenue_projections_insert on public.engineering_revenue_projections with check (app_private.can_edit_company(tenant_id, company_id));
alter policy engineering_revenue_projections_update on public.engineering_revenue_projections using (app_private.can_edit_company(tenant_id, company_id)) with check (app_private.can_edit_company(tenant_id, company_id));
alter policy engineering_revenue_projections_delete on public.engineering_revenue_projections using (app_private.can_edit_company(tenant_id, company_id));

alter policy measurement_lines_insert on public.measurement_lines with check (app_private.can_edit_company(tenant_id, company_id));
alter policy measurement_lines_update on public.measurement_lines using (app_private.can_edit_company(tenant_id, company_id)) with check (app_private.can_edit_company(tenant_id, company_id));
alter policy measurement_lines_delete on public.measurement_lines using (app_private.can_edit_company(tenant_id, company_id));

alter policy measurement_retentions_insert on public.measurement_retentions with check (app_private.can_edit_company(tenant_id, company_id));
alter policy measurement_retentions_update on public.measurement_retentions using (app_private.can_edit_company(tenant_id, company_id)) with check (app_private.can_edit_company(tenant_id, company_id));
alter policy measurement_retentions_delete on public.measurement_retentions using (app_private.can_edit_company(tenant_id, company_id));

alter policy measurements_insert on public.measurements with check (app_private.can_edit_company(tenant_id, company_id));
alter policy measurements_update on public.measurements using (app_private.can_edit_company(tenant_id, company_id)) with check (app_private.can_edit_company(tenant_id, company_id));
alter policy measurements_delete on public.measurements using (app_private.can_edit_company(tenant_id, company_id));

commit;
