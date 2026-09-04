begin;

create or replace function app_private.record_settlement_account_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_type text;
  v_description text;
  v_account_company_id uuid;
begin
  select fe.entry_type, fe.description
  into v_entry_type, v_description
  from public.financial_installments fi
  join public.financial_entries fe
    on fe.tenant_id = fi.tenant_id
    and fe.company_id = fi.company_id
    and fe.id = fi.entry_id
  where fi.tenant_id = new.tenant_id
    and fi.company_id = new.company_id
    and fi.id = new.installment_id;

  if v_entry_type is null then
    raise exception 'financial entry not found for settlement movement';
  end if;

  select fa.company_id into v_account_company_id
  from public.financial_accounts fa
  where fa.tenant_id = new.tenant_id
    and fa.id = new.account_id;

  if v_account_company_id is null then
    raise exception 'financial account not found for settlement movement';
  end if;

  insert into public.financial_account_movements (
    tenant_id,
    company_id,
    account_id,
    movement_on,
    direction,
    amount,
    source_type,
    source_id,
    description
  ) values (
    new.tenant_id,
    v_account_company_id,
    new.account_id,
    new.settled_on,
    case when v_entry_type = 'income' then 'inflow' else 'outflow' end,
    new.amount,
    'settlement',
    new.id,
    v_description
  );

  return new;
end;
$$;

create or replace function app_private.record_financial_settlement_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_installment_id uuid,
  p_account_id uuid,
  p_settled_on date,
  p_amount numeric,
  p_idempotency_key text,
  p_notes text default null
)
returns table(settlement_id uuid, settled_amount numeric, installment_amount numeric, settled_total numeric, remaining_amount numeric, financial_status text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_existing public.financial_settlements%rowtype;
  v_installment_amount numeric(14,2);
  v_settled_total numeric(14,2);
  v_remaining numeric(14,2);
  v_settlement_id uuid;
  v_status text;
  v_account_company_id uuid;
  v_key text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'settlement amount must be greater than zero'; end if;
  if p_settled_on is null then raise exception 'settlement date is required'; end if;
  if round(p_amount,2)<>p_amount then raise exception 'settlement amount supports at most two decimal places'; end if;
  v_key:=btrim(coalesce(p_idempotency_key,''));
  if length(v_key)<1 or length(v_key)>200 then raise exception 'idempotency key must contain between 1 and 200 characters'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text||':'||p_company_id::text||':'||v_key,0));
  select * into v_existing from public.financial_settlements fs where fs.tenant_id=p_tenant_id and fs.company_id=p_company_id and fs.idempotency_key=v_key;
  if found then
    if v_existing.installment_id<>p_installment_id or v_existing.account_id<>p_account_id or v_existing.settled_on<>p_settled_on or v_existing.amount<>p_amount::numeric(14,2) then raise exception 'idempotency key already used with different settlement data'; end if;
    select fi.amount into v_installment_amount from public.financial_installments fi where fi.tenant_id=p_tenant_id and fi.company_id=p_company_id and fi.id=p_installment_id;
    select coalesce(sum(fs.amount),0)::numeric(14,2) into v_settled_total from public.financial_settlements fs where fs.tenant_id=p_tenant_id and fs.company_id=p_company_id and fs.installment_id=p_installment_id;
    v_remaining:=greatest(v_installment_amount-v_settled_total,0);
    v_status:=case when v_settled_total=0 then 'pending' when v_settled_total<v_installment_amount then 'partial' else 'paid' end;
    return query select v_existing.id,v_existing.amount,v_installment_amount,v_settled_total,v_remaining,v_status;
    return;
  end if;

  select fi.amount into v_installment_amount from public.financial_installments fi where fi.tenant_id=p_tenant_id and fi.company_id=p_company_id and fi.id=p_installment_id for update;
  if not found then raise exception 'financial installment not found in company'; end if;

  select fa.company_id into v_account_company_id
  from public.financial_accounts fa
  where fa.tenant_id=p_tenant_id and fa.id=p_account_id and fa.status='active';
  if v_account_company_id is null then raise exception 'active financial account not found in tenant'; end if;
  if not app_private.can_manage_company(p_tenant_id,v_account_company_id) then raise exception 'not authorized for payment account company'; end if;

  select coalesce(sum(fs.amount),0)::numeric(14,2) into v_settled_total from public.financial_settlements fs where fs.tenant_id=p_tenant_id and fs.company_id=p_company_id and fs.installment_id=p_installment_id;

  insert into public.financial_settlements(tenant_id,company_id,installment_id,account_id,settled_on,amount,idempotency_key,notes,created_by)
  values(p_tenant_id,p_company_id,p_installment_id,p_account_id,p_settled_on,p_amount,v_key,nullif(btrim(p_notes),''),auth.uid()) returning id into v_settlement_id;

  v_settled_total:=(v_settled_total+p_amount)::numeric(14,2);
  v_remaining:=greatest(v_installment_amount-v_settled_total,0);
  v_status:=case when v_settled_total=0 then 'pending' when v_settled_total<v_installment_amount then 'partial' else 'paid' end;

  insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(p_tenant_id,p_company_id,auth.uid(),'financial_settlement.recorded','financial_settlement',v_settlement_id,
    pg_catalog.jsonb_build_object('installment_id',p_installment_id,'account_id',p_account_id,'payment_account_company_id',v_account_company_id,'settled_on',p_settled_on,'amount',p_amount,'idempotency_key',v_key,'status_after',v_status,'overpayment',greatest(v_settled_total-v_installment_amount,0)));

  return query select v_settlement_id,p_amount::numeric(14,2),v_installment_amount,v_settled_total,v_remaining,v_status;
end;
$$;

create or replace function app_private.record_card_statement_payment_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_statement_id uuid,
  p_account_id uuid,
  p_paid_on date,
  p_amount numeric,
  p_idempotency_key text,
  p_notes text default null
)
returns table(payment_id uuid, paid_total numeric, remaining_amount numeric, payment_status text, available_limit numeric)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_statement public.card_statements%rowtype;
  v_existing public.card_statement_payments%rowtype;
  v_paid_total numeric(14,2);
  v_remaining numeric(14,2);
  v_status text;
  v_payment_id uuid;
  v_available numeric(14,2);
  v_account_company_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'company management permission required'; end if;
  if p_paid_on is null then raise exception 'payment date is required'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'payment amount must be greater than zero'; end if;
  if round(p_amount,2)<>p_amount then raise exception 'payment amount supports at most two decimal places'; end if;
  if length(btrim(coalesce(p_idempotency_key,'')))=0 then raise exception 'idempotency key is required'; end if;

  select * into v_existing from public.card_statement_payments csp where csp.tenant_id=p_tenant_id and csp.company_id=p_company_id and csp.idempotency_key=btrim(p_idempotency_key);
  if found then
    if v_existing.statement_id<>p_statement_id or v_existing.account_id<>p_account_id or v_existing.paid_on<>p_paid_on or v_existing.amount<>p_amount then raise exception 'idempotency key already used with different statement payment data'; end if;
    select ccsb.paid_amount,ccsb.remaining_amount,ccsb.payment_status into v_paid_total,v_remaining,v_status from public.credit_card_statement_balances ccsb where ccsb.statement_id=p_statement_id;
    select ccl.available_limit into v_available from public.credit_card_limits ccl where ccl.card_id=v_existing.card_id;
    return query select v_existing.id,v_paid_total,v_remaining,v_status,v_available;
    return;
  end if;

  select * into v_statement from public.card_statements cs where cs.tenant_id=p_tenant_id and cs.company_id=p_company_id and cs.id=p_statement_id for update;
  if not found then raise exception 'closed card statement not found in company'; end if;

  select fa.company_id into v_account_company_id
  from public.financial_accounts fa
  where fa.tenant_id=p_tenant_id and fa.id=p_account_id and fa.status='active';
  if v_account_company_id is null then raise exception 'active payment account not found in tenant'; end if;
  if not app_private.can_manage_company(p_tenant_id,v_account_company_id) then raise exception 'not authorized for payment account company'; end if;

  select coalesce(sum(csp.amount),0)::numeric(14,2) into v_paid_total from public.card_statement_payments csp where csp.tenant_id=p_tenant_id and csp.company_id=p_company_id and csp.statement_id=p_statement_id;

  insert into public.card_statement_payments(tenant_id,company_id,statement_id,card_id,account_id,paid_on,amount,idempotency_key,notes,created_by)
  values(p_tenant_id,p_company_id,p_statement_id,v_statement.card_id,p_account_id,p_paid_on,p_amount,btrim(p_idempotency_key),nullif(btrim(p_notes),''),auth.uid()) returning id into v_payment_id;
  insert into public.financial_account_movements(tenant_id,company_id,account_id,movement_on,direction,amount,source_type,source_id,description)
  values(p_tenant_id,v_account_company_id,p_account_id,p_paid_on,'outflow',p_amount,'card_statement_payment',v_payment_id,'Pagamento de fatura de cartão');

  v_paid_total:=(v_paid_total+p_amount)::numeric(14,2);
  v_remaining:=greatest(v_statement.statement_amount-v_paid_total,0)::numeric(14,2);
  v_status:=case when v_remaining=0 then 'paid' else 'partial' end;
  insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(p_tenant_id,p_company_id,auth.uid(),'card_statement_payment.recorded','card_statement_payment',v_payment_id,
    pg_catalog.jsonb_build_object('statement_id',p_statement_id,'card_id',v_statement.card_id,'account_id',p_account_id,'payment_account_company_id',v_account_company_id,'paid_on',p_paid_on,'amount',p_amount,'idempotency_key',btrim(p_idempotency_key),'status_after',v_status,'overpayment',greatest(v_paid_total-v_statement.statement_amount,0)));
  select ccl.available_limit into v_available from public.credit_card_limits ccl where ccl.card_id=v_statement.card_id;
  return query select v_payment_id,v_paid_total,v_remaining,v_status,v_available;
end;
$$;

comment on function app_private.record_financial_settlement_impl(uuid,uuid,uuid,uuid,date,numeric,text,text)
is 'Records a settlement for the expense/income company while allowing the cash account to belong to another company in the same tenant, provided the user can manage both companies.';

comment on function app_private.record_card_statement_payment_impl(uuid,uuid,uuid,uuid,date,numeric,text,text)
is 'Records a card statement payment while allowing the payment account to belong to another company in the same tenant, provided the user can manage both companies.';

commit;
