begin;

insert into auth.users (id, email)
values ('13000000-0000-0000-0000-000000000001', 'settlement-test@example.invalid');

insert into public.tenants (id, name, slug)
values ('23000000-0000-0000-0000-000000000001', 'Settlement Tenant', 'settlement-tenant');

insert into public.companies (id, tenant_id, legal_name)
values ('33000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', 'Settlement Company');

insert into public.tenant_memberships (tenant_id, user_id, role)
values ('23000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'operator');

insert into public.company_memberships (tenant_id, company_id, user_id, role)
values ('23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'manager');

insert into public.financial_categories (id, tenant_id, company_id, name, kind)
values ('43000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', 'Settlement Test', 'expense');

insert into public.financial_accounts (id, tenant_id, company_id, name, account_type)
values ('53000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', 'Settlement Bank', 'bank');

create temporary table settlement_test_context (installment_id uuid not null);
grant select, insert on settlement_test_context to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);

insert into settlement_test_context (installment_id)
select installment_id
from public.create_single_financial_entry(
  '23000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  'expense',
  'Settlement test entry',
  'Supplier',
  '43000000-0000-0000-0000-000000000001',
  null,
  '2026-09-01',
  '2026-09-10',
  100.00,
  null
);

select * from public.record_financial_settlement(
  '23000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  (select installment_id from settlement_test_context),
  '53000000-0000-0000-0000-000000000001',
  '2026-09-10',
  40.00,
  'settlement-test-partial',
  'partial test'
);

select * from public.record_financial_settlement(
  '23000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  (select installment_id from settlement_test_context),
  '53000000-0000-0000-0000-000000000001',
  '2026-09-10',
  40.00,
  'settlement-test-partial',
  'same idempotent request'
);

-- Same key with different financial payload must be rejected.
do $$
begin
  begin
    perform 1 from public.record_financial_settlement(
      '23000000-0000-0000-0000-000000000001',
      '33000000-0000-0000-0000-000000000001',
      (select installment_id from settlement_test_context),
      '53000000-0000-0000-0000-000000000001',
      '2026-09-10',
      41.00,
      'settlement-test-partial',
      'conflicting retry'
    );
    raise exception 'expected conflicting settlement idempotency rejection';
  exception when others then
    if position('different settlement data' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

select * from public.record_financial_settlement(
  '23000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  (select installment_id from settlement_test_context),
  '53000000-0000-0000-0000-000000000001',
  '2026-09-11',
  60.00,
  'settlement-test-final',
  'final test'
);

do $$
begin
  begin
    perform 1 from public.record_financial_settlement(
      '23000000-0000-0000-0000-000000000001',
      '33000000-0000-0000-0000-000000000001',
      (select installment_id from settlement_test_context),
      '53000000-0000-0000-0000-000000000001',
      '2026-09-12',
      0.01,
      'settlement-test-overpay',
      null
    );
    raise exception 'expected over-settlement rejection';
  exception when others then
    if sqlerrm = 'expected over-settlement rejection' then raise; end if;
    if position('settlement exceeds installment remaining amount' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

do $$
declare
  v_count integer;
  v_total numeric;
  v_remaining numeric;
  v_status text;
begin
  select count(*), sum(amount)
    into v_count, v_total
  from public.financial_settlements
  where tenant_id = '23000000-0000-0000-0000-000000000001'
    and company_id = '33000000-0000-0000-0000-000000000001'
    and installment_id = (select installment_id from settlement_test_context);

  if v_count <> 2 then raise exception 'expected 2 settlements, got %', v_count; end if;
  if v_total <> 100.00 then raise exception 'expected total 100.00, got %', v_total; end if;

  select remaining_amount, financial_status
    into v_remaining, v_status
  from public.financial_installment_balances
  where installment_id = (select installment_id from settlement_test_context);

  if v_remaining <> 0 then raise exception 'expected zero remaining, got %', v_remaining; end if;
  if v_status <> 'paid' then raise exception 'expected paid status, got %', v_status; end if;
end $$;

reset role;

do $$
declare
  v_audit_count integer;
begin
  select count(*) into v_audit_count
  from public.audit_log
  where tenant_id = '23000000-0000-0000-0000-000000000001'
    and company_id = '33000000-0000-0000-0000-000000000001'
    and action = 'financial_settlement.recorded';

  if v_audit_count <> 2 then raise exception 'expected 2 audit rows, got %', v_audit_count; end if;
end $$;

rollback;
