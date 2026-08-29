begin;

insert into auth.users (id, email)
values ('12000000-0000-0000-0000-000000000001', 'entry-test@example.invalid');

insert into public.tenants (id, name, slug)
values ('22000000-0000-0000-0000-000000000001', 'Entry Tenant', 'entry-tenant');

insert into public.companies (id, tenant_id, legal_name)
values ('32000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'Entry Company');

insert into public.tenant_memberships (tenant_id, user_id, role)
values ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'operator');

insert into public.company_memberships (tenant_id, company_id, user_id, role)
values ('22000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'manager');

insert into public.financial_categories (id, tenant_id, company_id, name, kind)
values ('42000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'Teste', 'expense');

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);

select * from public.create_single_financial_entry(
  '22000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000001',
  'expense',
  'Compra teste',
  'Fornecedor teste',
  '42000000-0000-0000-0000-000000000001',
  null,
  '2026-09-01',
  '2026-09-10',
  123.45,
  null
);

do $$
declare
  entry_count integer;
  installment_count integer;
  installment_number_value integer;
  installment_total_value integer;
begin
  select count(*) into entry_count from public.financial_entries;
  select count(*), min(installment_number), min(installment_count)
    into installment_count, installment_number_value, installment_total_value
    from public.financial_installments;

  if entry_count <> 1 then raise exception 'expected one financial entry, got %', entry_count; end if;
  if installment_count <> 1 then raise exception 'expected one financial installment, got %', installment_count; end if;
  if installment_number_value <> 1 or installment_total_value <> 1 then
    raise exception 'single entry must materialize explicit installment 1/1';
  end if;
end $$;

rollback;
