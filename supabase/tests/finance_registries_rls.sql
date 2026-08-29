begin;

-- Regression contract for finance registries.
-- Run against a disposable/test database or inside this rollback transaction.
-- The test assumes the platform RLS helpers and finance base migration exist.

do $$
declare
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  company_a uuid := gen_random_uuid();
  company_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  visible_count integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'finance-test@example.invalid', '', now(), now());

  insert into public.tenants (id, name) values (tenant_a, 'Tenant A'), (tenant_b, 'Tenant B');
  insert into public.companies (id, tenant_id, name) values (company_a, tenant_a, 'Company A'), (company_b, tenant_b, 'Company B');
  insert into public.tenant_memberships (tenant_id, user_id, role, status) values (tenant_a, user_a, 'member', 'active');
  insert into public.company_memberships (tenant_id, company_id, user_id, role, status) values (tenant_a, company_a, user_a, 'manager', 'active');

  insert into public.financial_categories (tenant_id, company_id, name, kind) values
    (tenant_a, company_a, 'Allowed', 'expense'),
    (tenant_b, company_b, 'Forbidden', 'expense');

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into visible_count from public.financial_categories;
  if visible_count <> 1 then
    raise exception 'finance registry RLS failed: expected 1 visible category, got %', visible_count;
  end if;

  if not exists (select 1 from public.financial_categories where company_id = company_a) then
    raise exception 'finance registry RLS failed: authorized company is not visible';
  end if;

  if exists (select 1 from public.financial_categories where company_id = company_b) then
    raise exception 'finance registry RLS failed: foreign tenant/company leaked';
  end if;
end $$;

rollback;
