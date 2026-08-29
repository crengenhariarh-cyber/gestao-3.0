begin;

insert into auth.users(id,email) values('15000000-0000-0000-0000-000000000001','card-test@example.invalid');
insert into public.tenants(id,name,slug) values('25000000-0000-0000-0000-000000000001','Card Tenant','card-tenant');
insert into public.companies(id,tenant_id,legal_name) values('35000000-0000-0000-0000-000000000001','25000000-0000-0000-0000-000000000001','Card Company');
insert into public.tenant_memberships(tenant_id,user_id,role) values('25000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','operator');
insert into public.company_memberships(tenant_id,company_id,user_id,role) values('25000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','manager');
insert into public.financial_categories(id,tenant_id,company_id,name,kind) values('45000000-0000-0000-0000-000000000001','25000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001','Cartão Teste','expense');
insert into public.credit_cards(id,tenant_id,company_id,name,credit_limit,closing_day,due_day) values('55000000-0000-0000-0000-000000000001','25000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001','Cartão Teste',1000,10,20);

set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-0000-0000-000000000001',true);

select * from public.create_card_purchase(
  '25000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001',
  '55000000-0000-0000-0000-000000000001','2026-09-11','Compra teste','Fornecedor',
  '45000000-0000-0000-0000-000000000001',null,100.00,3,'card-purchase-1',null
);

select * from public.create_card_purchase(
  '25000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001',
  '55000000-0000-0000-0000-000000000001','2026-09-11','Compra teste','Fornecedor',
  '45000000-0000-0000-0000-000000000001',null,100.00,3,'card-purchase-1','retry'
);

do $$
declare
  v_count integer;
  v_sum numeric;
  v_amounts numeric[];
  v_months date[];
  v_transactions integer;
  v_committed numeric;
  v_available numeric;
begin
  select count(*),sum(amount),array_agg(amount order by installment_number),array_agg(statement_month order by installment_number)
  into v_count,v_sum,v_amounts,v_months
  from public.card_installments
  where tenant_id='25000000-0000-0000-0000-000000000001';

  if v_count<>3 then raise exception 'expected 3 installments, got %',v_count; end if;
  if v_sum<>100.00 then raise exception 'expected exact 100.00, got %',v_sum; end if;
  if v_amounts<>array[33.34,33.33,33.33]::numeric[] then raise exception 'unexpected split %',v_amounts; end if;
  if v_months<>array['2026-10-01'::date,'2026-11-01'::date,'2026-12-01'::date] then raise exception 'unexpected months %',v_months; end if;

  select count(*) into v_transactions from public.card_transactions
  where tenant_id='25000000-0000-0000-0000-000000000001';
  if v_transactions<>1 then raise exception 'expected one idempotent transaction, got %',v_transactions; end if;

  select ccl.committed_amount,ccl.available_limit into v_committed,v_available
  from public.credit_card_limits ccl
  where ccl.card_id='55000000-0000-0000-0000-000000000001';
  if v_committed<>100 or v_available<>900 then raise exception 'unexpected limits %, %',v_committed,v_available; end if;

  begin
    perform 1 from public.create_card_purchase(
      '25000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001',
      '55000000-0000-0000-0000-000000000001','2026-09-12','Acima limite','Fornecedor',
      '45000000-0000-0000-0000-000000000001',null,901.00,1,'card-purchase-over',null
    );
    raise exception 'expected limit rejection';
  exception when others then
    if sqlerrm='expected limit rejection' then raise; end if;
    if position('exceeds available limit' in sqlerrm)=0 then raise; end if;
  end;
end $$;

rollback;
