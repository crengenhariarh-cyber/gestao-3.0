begin;
alter table public.budget_plans drop constraint if exists budget_plans_tenant_id_company_id_cost_center_id_category_i_key;
create unique index budget_plans_scope_month_source_uidx on public.budget_plans(
  tenant_id, company_id,
  coalesce(cost_center_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(category_id,'00000000-0000-0000-0000-000000000000'::uuid),
  competence_month, source_kind
);
commit;
