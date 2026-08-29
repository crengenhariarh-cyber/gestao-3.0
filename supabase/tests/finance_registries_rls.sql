begin;

insert into auth.users (id, email)
values ('11000000-0000-0000-0000-000000000001', 'finance-rls@example.invalid');

insert into public.tenants (id, name, slug)
values
  ('21000000-0000-0000-0000-000000000001', 'Finance Tenant A', 'finance-tenant-a'),
  ('21000000-0000-0000-0000-000000000002', 'Finance Tenant B', 'finance-tenant-b');

insert into public.companies (id, tenant_id, legal_name)
values
  ('31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'Finance Company A'),
  ('31000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'Finance Company B');

insert into public.tenant_memberships (tenant_id, user_id, role)
values ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'operator');

insert into public.company_memberships (tenant_id, company_id, user_id, role)
values ('21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'manager');

insert into public.financial_categories (tenant_id, company_id, name, kind)
values
  ('21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Allowed', 'expense'),
  ('21000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', 'Forbidden', 'expense');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);

do $$
declare visible_count integer;
begin
  select count(*) into visible_count from public.financial_categories;
  if visible_count <> 1 then raise exception 'finance registry RLS failed: expected 1 visible category, got %', visible_count; end if;
  if not exists (select 1 from public.financial_categories where company_id = '31000000-0000-0000-0000-000000000001') then raise exception 'authorized company is not visible'; end if;
  if exists (select 1 from public.financial_categories where company_id = '31000000-0000-0000-0000-000000000002') then raise exception 'foreign tenant/company leaked'; end if;
end $$;

rollback;
