begin;

insert into auth.users (id, email)
values ('14000000-0000-0000-0000-000000000001', 'transfer-test@example.invalid');

insert into public.tenants (id, name, slug)
values ('24000000-0000-0000-0000-000000000001', 'Transfer Tenant', 'transfer-tenant');

insert into public.companies (id, tenant_id, legal_name)
values ('34000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', 'Transfer Company');

insert into public.tenant_memberships (tenant_id, user_id, role)
values ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'operator');

insert into public.company_memberships (tenant_id, company_id, user_id, role)
values ('24000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'manager');

insert into public.financial_accounts (id, tenant_id, company_id, name, account_type, opening_balance)
values
  ('54000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001', 'Origem', 'bank', 1000.00),
  ('54000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001', 'Destino', 'bank', 200.00);

set local role authenticated;
select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000001', true);

select * from public.record_financial_transfer(
  '24000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001',
  '54000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000002',
  '2026-09-15', 150.00, 'transfer-test-1', 'transfer regression'
);

-- Same idempotency key and same financial data must not duplicate the transfer.
select * from public.record_financial_transfer(
  '24000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001',
  '54000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000002',
  '2026-09-15', 150.00, 'transfer-test-1', 'retry'
);

-- Same key with different financial payload must be rejected.
do $$
begin
  begin
    perform * from public.record_financial_transfer(
      '24000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001',
      '54000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000002',
      '2026-09-15', 151.00, 'transfer-test-1', 'conflicting retry'
    );
    raise exception 'expected conflicting idempotency payload to be rejected';
  exception
    when others then
      if position('different transfer data' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end $$;

do $$
declare
  v_transfers integer;
  v_movements integer;
  v_net numeric;
  v_from numeric;
  v_to numeric;
begin
  select count(*) into v_transfers
  from public.financial_transfers
  where tenant_id = '24000000-0000-0000-0000-000000000001';
  if v_transfers <> 1 then raise exception 'expected one idempotent transfer, got %', v_transfers; end if;

  select count(*), sum(case when direction = 'inflow' then amount else -amount end)
    into v_movements, v_net
  from public.financial_account_movements
  where tenant_id = '24000000-0000-0000-0000-000000000001'
    and source_type = 'transfer';
  if v_movements <> 2 then raise exception 'expected two linked movements, got %', v_movements; end if;
  if v_net <> 0 then raise exception 'transfer ledger net must be zero, got %', v_net; end if;

  select current_balance into v_from from public.financial_account_balances
  where account_id = '54000000-0000-0000-0000-000000000001';
  select current_balance into v_to from public.financial_account_balances
  where account_id = '54000000-0000-0000-0000-000000000002';
  if v_from <> 850.00 then raise exception 'expected source balance 850.00, got %', v_from; end if;
  if v_to <> 350.00 then raise exception 'expected destination balance 350.00, got %', v_to; end if;
end $$;

rollback;
