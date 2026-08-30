-- 07.10 Phase 07 final audit hardening.
-- Integrity audit returned zero issues for:
-- duplicate measurement-finance links;
-- measurement/company scope mismatch;
-- contract/work/company scope mismatch;
-- settlement overpayments;
-- active projections above contract balance;
-- negative open receivables;
-- executive dashboard cross-company mismatch.
-- Security advisor: zero lints.
-- Performance advisor identified two relevant unindexed budget_plans foreign keys used by Phase 07 cash-flow/budget integration.
create index if not exists budget_plans_category_fk_idx on public.budget_plans(tenant_id,company_id,category_id);
create index if not exists budget_plans_created_by_idx on public.budget_plans(created_by) where created_by is not null;
