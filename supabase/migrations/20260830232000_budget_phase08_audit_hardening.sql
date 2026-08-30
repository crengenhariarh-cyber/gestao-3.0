begin;
create index if not exists budget_limits_cost_center_fk_idx on public.budget_limits(tenant_id,company_id,cost_center_id) where cost_center_id is not null;
create index if not exists budget_limits_category_fk_idx on public.budget_limits(tenant_id,company_id,category_id) where category_id is not null;
create index if not exists budget_limits_created_by_idx on public.budget_limits(created_by) where created_by is not null;
commit;
