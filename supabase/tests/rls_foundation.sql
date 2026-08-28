begin;

create temporary table rls_test_results (
  test_name text primary key,
  passed boolean not null,
  observed integer not null,
  expected integer not null
);

grant insert, select on table rls_test_results to authenticated;

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'rls-user-a@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'rls-user-b@example.invalid'),
  ('10000000-0000-0000-0000-000000000003', 'rls-admin-a@example.invalid');

insert into public.tenants (id, name, slug)
values
  ('20000000-0000-0000-0000-000000000001', 'Tenant A', 'rls-tenant-a'),
  ('20000000-0000-0000-0000-000000000002', 'Tenant B', 'rls-tenant-b');

insert into public.companies (id, tenant_id, legal_name)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Company A1'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Company A2'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'Company B1');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'operator'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'operator'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'tenant_admin');

insert into public.company_memberships (tenant_id, company_id, user_id, role)
values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'operator'),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'operator');

set local role authenticated;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
insert into rls_test_results
select 'operator_sees_only_assigned_company', count(*) = 1, count(*), 1 from public.companies;
insert into rls_test_results
select 'operator_cannot_see_other_tenant', count(*) = 0, count(*), 0
from public.companies where tenant_id = '20000000-0000-0000-0000-000000000002';
insert into rls_test_results
select 'operator_sees_only_own_tenant', count(*) = 1, count(*), 1 from public.tenants;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
insert into rls_test_results
select 'second_operator_sees_only_company_b', count(*) = 1, count(*), 1 from public.companies;
insert into rls_test_results
select 'second_operator_cannot_see_tenant_a', count(*) = 0, count(*), 0
from public.tenants where id = '20000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
insert into rls_test_results
select 'tenant_admin_sees_all_tenant_companies', count(*) = 2, count(*), 2 from public.companies;
insert into rls_test_results
select 'tenant_admin_still_cannot_see_other_tenant', count(*) = 0, count(*), 0
from public.companies where tenant_id = '20000000-0000-0000-0000-000000000002';

reset role;

do $$
declare
  failure_count integer;
  failure_details text;
begin
  select count(*) into failure_count
  from rls_test_results
  where not passed;

  if failure_count > 0 then
    select string_agg(
      format('%s: observed=%s expected=%s', test_name, observed, expected),
      '; '
      order by test_name
    )
    into failure_details
    from rls_test_results
    where not passed;

    raise exception 'RLS foundation regression: %', failure_details;
  end if;
end;
$$;

select * from rls_test_results order by test_name;

rollback;
