begin;

insert into auth.users(id,email) values('16000000-0000-0000-0000-000000000001','statement-test@example.invalid');
insert into public.tenants(id,name,slug) values('26000000-0000-0000-0000-000000000001','Statement Tenant','statement-tenant');
insert into public.companies(id,tenant_id,legal_name) values('36000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001','Statement Company');
insert into public.tenant_memberships(tenant_id,user_id,role) values('26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','operator');
insert into public.company_memberships(tenant_id,company_id,user_id,role) values('26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','manager');
insert into public.financial_categories(id,tenant_id,company_id,name,kind) values('46000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001','Cartão Fatura','expense');
insert into public.financial_accounts(id,tenant_id,company_id,name,account_type,opening_balance) values('56000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001','Banco','bank',500);
insert into public.credit_cards(id,tenant_id,company_id,name,credit_limit,closing_day,due_day,default_payment_account_id) values('66000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001','Cartão',1000,10,20,'56000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','16000000-0000-0000-0000-000000000001',true);

select * from public.create_card_purchase(
  '26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001',
  '66000000-0000-0000-0000-000000000001','2026-09-05','Compra 2x','Fornecedor',
  '46000000-0000-0000-0000-000000000001',null,100.00,2,'statement-purchase-1',null
);

create temporary table statement_ctx(statement_id uuid);
grant select,insert on statement_ctx to authenticated;
insert into statement_ctx(statement_id)
select statement_id from public.close_card_statement(
  '26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001',
  '66000000-0000-0000-0000-000000000001','2026-09-01'
);

select * from public.close_card_statement(
  '26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001',
  '66000000-0000-0000-0000-000000000001','2026-09-01'
);

select * from public.record_card_statement_payment(
  '26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001',
  (select statement_id from statement_ctx),'56000000-0000-0000-0000-000000000001',
  '2026-09-20',20.00,'statement-pay-1','parcial'
);
select * from public.record_card_statement_payment(
  '26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001',
  (select statement_id from statement_ctx),'56000000-0000-0000-0000-000000000001',
  '2026-09-20',20.00,'statement-pay-1','retry'
);

-- Same payment key with different payload must be rejected.
do $$
begin
  begin
    perform 1 from public.record_card_statement_payment(
      '26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001',
      (select statement_id from statement_ctx),'56000000-0000-0000-0000-000000000001',
      '2026-09-20',21.00,'statement-pay-1','conflicting retry'
    );
    raise exception 'expected conflicting statement payment idempotency rejection';
  exception when others then
    if position('different statement payment data' in sqlerrm)=0 then raise; end if;
  end;
end $$;

select * from public.record_card_statement_payment(
  '26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001',
  (select statement_id from statement_ctx),'56000000-0000-0000-0000-000000000001',
  '2026-09-21',30.00,'statement-pay-2','final'
);

do $$
declare
  v_statements integer;
  v_payments integer;
  v_movements integer;
  v_status text;
  v_remaining numeric;
  v_balance numeric;
  v_available numeric;
begin
  select count(*) into v_statements from public.card_statements
  where tenant_id='26000000-0000-0000-0000-000000000001';
  if v_statements<>1 then raise exception 'expected one statement, got %',v_statements; end if;

  select count(*) into v_payments from public.card_statement_payments
  where tenant_id='26000000-0000-0000-0000-000000000001';
  if v_payments<>2 then raise exception 'expected two idempotent payments, got %',v_payments; end if;

  select payment_status,remaining_amount into v_status,v_remaining
  from public.credit_card_statement_balances
  where statement_id=(select statement_id from statement_ctx);
  if v_status<>'paid' or v_remaining<>0 then raise exception 'unexpected statement status %, %',v_status,v_remaining; end if;

  select current_balance into v_balance from public.financial_account_balances
  where account_id='56000000-0000-0000-0000-000000000001';
  if v_balance<>450 then raise exception 'expected account balance 450, got %',v_balance; end if;

  select available_limit into v_available from public.credit_card_limits
  where card_id='66000000-0000-0000-0000-000000000001';
  if v_available<>950 then raise exception 'expected available limit 950, got %',v_available; end if;

  select count(*) into v_movements from public.financial_account_movements
  where source_type='card_statement_payment'
    and tenant_id='26000000-0000-0000-0000-000000000001';
  if v_movements<>2 then raise exception 'expected two account movements, got %',v_movements; end if;

  begin
    perform 1 from public.create_card_purchase(
      '26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001',
      '66000000-0000-0000-0000-000000000001','2026-09-06','Compra tardia','Fornecedor',
      '46000000-0000-0000-0000-000000000001',null,10.00,1,'statement-purchase-late',null
    );
    raise exception 'expected closed statement rejection';
  exception when others then
    if sqlerrm='expected closed statement rejection' then raise; end if;
    if position('already closed' in sqlerrm)=0 then raise; end if;
  end;
end $$;

reset role;

do $$
declare v_close_audit integer; v_payment_audit integer;
begin
  select count(*) into v_close_audit from public.audit_log
  where tenant_id='26000000-0000-0000-0000-000000000001'
    and company_id='36000000-0000-0000-0000-000000000001'
    and action='card_statement.closed';
  if v_close_audit<>1 then raise exception 'expected one statement close audit row, got %',v_close_audit; end if;

  select count(*) into v_payment_audit from public.audit_log
  where tenant_id='26000000-0000-0000-0000-000000000001'
    and company_id='36000000-0000-0000-0000-000000000001'
    and action='card_statement_payment.recorded';
  if v_payment_audit<>2 then raise exception 'expected two statement payment audit rows, got %',v_payment_audit; end if;
end $$;

rollback;
