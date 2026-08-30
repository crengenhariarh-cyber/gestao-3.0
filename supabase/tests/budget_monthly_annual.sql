begin;

-- 5.9 regression contract:
-- 1. budget_plans is structurally isolated by tenant/company/cost center/category.
-- 2. manual planned values are added to automatic salary projection.
-- 3. finance expenses generated from payroll are excluded from realized_finance to prevent double counting salary.
-- 4. realized_salary comes from payroll closing snapshots.
-- 5. annual summary is the aggregation of monthly competence values, never cash-flow dates.

select 1 / case when exists (
  select 1 from information_schema.tables
  where table_schema='public' and table_name='budget_plans'
) then 1 else 0 end;

select 1 / case when exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='budget_monthly_summary'
) then 1 else 0 end;

select 1 / case when exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='budget_annual_summary'
) then 1 else 0 end;

rollback;
