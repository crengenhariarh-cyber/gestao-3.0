begin;

create function app_private.close_card_statement_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_card_id uuid,
  p_statement_month date
)
returns table(
  statement_id uuid,
  statement_amount numeric,
  due_date date,
  payment_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.credit_cards%rowtype;
  v_existing public.card_statements%rowtype;
  v_amount numeric(14,2);
  v_due_date date;
  v_statement_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id, p_company_id) then raise exception 'company management permission required'; end if;
  if p_statement_month is null or extract(day from p_statement_month) <> 1 then raise exception 'statement month must be the first day of a month'; end if;

  select * into v_existing
  from public.card_statements cs
  where cs.tenant_id = p_tenant_id
    and cs.company_id = p_company_id
    and cs.card_id = p_card_id
    and cs.statement_month = p_statement_month;

  if found then
    return query select v_existing.id, v_existing.statement_amount, v_existing.due_date,
      (select ccsb.payment_status from public.credit_card_statement_balances ccsb where ccsb.statement_id = v_existing.id);
    return;
  end if;

  select * into v_card
  from public.credit_cards cc
  where cc.tenant_id = p_tenant_id
    and cc.company_id = p_company_id
    and cc.id = p_card_id
    and cc.status = 'active'
  for update;

  if not found then raise exception 'active credit card not found in company'; end if;

  select coalesce(sum(ci.amount), 0)::numeric(14,2) into v_amount
  from public.card_installments ci
  where ci.tenant_id = p_tenant_id
    and ci.company_id = p_company_id
    and ci.card_id = p_card_id
    and ci.statement_month = p_statement_month;

  if v_amount <= 0 then raise exception 'statement has no installments to close'; end if;

  v_due_date := p_statement_month + (v_card.due_day - 1);

  insert into public.card_statements (
    tenant_id, company_id, card_id, statement_month, due_date,
    statement_amount, closed_at, created_by
  ) values (
    p_tenant_id, p_company_id, p_card_id, p_statement_month, v_due_date,
    v_amount, now(), auth.uid()
  ) returning id into v_statement_id;

  insert into public.audit_log (
    tenant_id, company_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_tenant_id, p_company_id, auth.uid(), 'card_statement.closed',
    'card_statement', v_statement_id,
    jsonb_build_object(
      'card_id', p_card_id,
      'statement_month', p_statement_month,
      'due_date', v_due_date,
      'statement_amount', v_amount
    )
  );

  return query select v_statement_id, v_amount, v_due_date, 'pending'::text;
end;
$$;

revoke all on function app_private.close_card_statement_impl(uuid, uuid, uuid, date) from public, anon;
grant execute on function app_private.close_card_statement_impl(uuid, uuid, uuid, date) to authenticated;

create function public.close_card_statement(
  p_tenant_id uuid,
  p_company_id uuid,
  p_card_id uuid,
  p_statement_month date
)
returns table(
  statement_id uuid,
  statement_amount numeric,
  due_date date,
  payment_status text
)
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.close_card_statement_impl(
    p_tenant_id, p_company_id, p_card_id, p_statement_month
  );
$$;

revoke all on function public.close_card_statement(uuid, uuid, uuid, date) from public, anon;
grant execute on function public.close_card_statement(uuid, uuid, uuid, date) to authenticated;

create function app_private.record_card_statement_payment_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_statement_id uuid,
  p_account_id uuid,
  p_paid_on date,
  p_amount numeric,
  p_idempotency_key text,
  p_notes text default null
)
returns table(
  payment_id uuid,
  paid_total numeric,
  remaining_amount numeric,
  payment_status text,
  available_limit numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_statement public.card_statements%rowtype;
  v_existing public.card_statement_payments%rowtype;
  v_paid_total numeric(14,2);
  v_remaining numeric(14,2);
  v_status text;
  v_payment_id uuid;
  v_available numeric(14,2);
  v_account_ok boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id, p_company_id) then raise exception 'company management permission required'; end if;
  if p_paid_on is null then raise exception 'payment date is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'payment amount must be greater than zero'; end if;
  if round(p_amount, 2) <> p_amount then raise exception 'payment amount supports at most two decimal places'; end if;
  if length(btrim(coalesce(p_idempotency_key, ''))) = 0 then raise exception 'idempotency key is required'; end if;

  select * into v_existing
  from public.card_statement_payments csp
  where csp.tenant_id = p_tenant_id
    and csp.company_id = p_company_id
    and csp.idempotency_key = btrim(p_idempotency_key);

  if found then
    if v_existing.statement_id <> p_statement_id
      or v_existing.account_id <> p_account_id
      or v_existing.paid_on <> p_paid_on
      or v_existing.amount <> p_amount then
      raise exception 'idempotency key already used with different statement payment data';
    end if;

    select ccsb.paid_amount, ccsb.remaining_amount, ccsb.payment_status
      into v_paid_total, v_remaining, v_status
    from public.credit_card_statement_balances ccsb
    where ccsb.statement_id = p_statement_id;

    select ccl.available_limit into v_available
    from public.credit_card_limits ccl
    where ccl.card_id = v_existing.card_id;

    return query select v_existing.id, v_paid_total, v_remaining, v_status, v_available;
    return;
  end if;

  select * into v_statement
  from public.card_statements cs
  where cs.tenant_id = p_tenant_id
    and cs.company_id = p_company_id
    and cs.id = p_statement_id
  for update;

  if not found then raise exception 'closed card statement not found in company'; end if;

  select exists (
    select 1 from public.financial_accounts fa
    where fa.tenant_id = p_tenant_id
      and fa.company_id = p_company_id
      and fa.id = p_account_id
      and fa.status = 'active'
  ) into v_account_ok;
  if not v_account_ok then raise exception 'active payment account not found in company'; end if;

  select coalesce(sum(csp.amount), 0)::numeric(14,2) into v_paid_total
  from public.card_statement_payments csp
  where csp.tenant_id = p_tenant_id
    and csp.company_id = p_company_id
    and csp.statement_id = p_statement_id;

  if v_paid_total + p_amount > v_statement.statement_amount then
    raise exception 'statement payment exceeds remaining amount';
  end if;

  insert into public.card_statement_payments (
    tenant_id, company_id, statement_id, card_id, account_id,
    paid_on, amount, idempotency_key, notes, created_by
  ) values (
    p_tenant_id, p_company_id, p_statement_id, v_statement.card_id, p_account_id,
    p_paid_on, p_amount, btrim(p_idempotency_key), nullif(btrim(p_notes), ''), auth.uid()
  ) returning id into v_payment_id;

  insert into public.financial_account_movements (
    tenant_id, company_id, account_id, movement_on, direction,
    amount, source_type, source_id, description
  ) values (
    p_tenant_id, p_company_id, p_account_id, p_paid_on, 'outflow',
    p_amount, 'card_statement_payment', v_payment_id, 'Pagamento de fatura de cartão'
  );

  v_paid_total := (v_paid_total + p_amount)::numeric(14,2);
  v_remaining := greatest(v_statement.statement_amount - v_paid_total, 0)::numeric(14,2);
  v_status := case when v_remaining = 0 then 'paid' else 'partial' end;

  insert into public.audit_log (
    tenant_id, company_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_tenant_id, p_company_id, auth.uid(), 'card_statement_payment.recorded',
    'card_statement_payment', v_payment_id,
    jsonb_build_object(
      'statement_id', p_statement_id,
      'card_id', v_statement.card_id,
      'account_id', p_account_id,
      'paid_on', p_paid_on,
      'amount', p_amount,
      'idempotency_key', btrim(p_idempotency_key),
      'status_after', v_status
    )
  );

  select ccl.available_limit into v_available
  from public.credit_card_limits ccl
  where ccl.card_id = v_statement.card_id;

  return query select v_payment_id, v_paid_total, v_remaining, v_status, v_available;
end;
$$;

revoke all on function app_private.record_card_statement_payment_impl(uuid, uuid, uuid, uuid, date, numeric, text, text) from public, anon;
grant execute on function app_private.record_card_statement_payment_impl(uuid, uuid, uuid, uuid, date, numeric, text, text) to authenticated;

create function public.record_card_statement_payment(
  p_tenant_id uuid,
  p_company_id uuid,
  p_statement_id uuid,
  p_account_id uuid,
  p_paid_on date,
  p_amount numeric,
  p_idempotency_key text,
  p_notes text default null
)
returns table(
  payment_id uuid,
  paid_total numeric,
  remaining_amount numeric,
  payment_status text,
  available_limit numeric
)
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.record_card_statement_payment_impl(
    p_tenant_id, p_company_id, p_statement_id, p_account_id,
    p_paid_on, p_amount, p_idempotency_key, p_notes
  );
$$;

revoke all on function public.record_card_statement_payment(uuid, uuid, uuid, uuid, date, numeric, text, text) from public, anon;
grant execute on function public.record_card_statement_payment(uuid, uuid, uuid, uuid, date, numeric, text, text) to authenticated;

comment on function public.close_card_statement(uuid, uuid, uuid, date)
is 'Closes a card statement as an immutable amount snapshot for one statement competence.';
comment on function public.record_card_statement_payment(uuid, uuid, uuid, uuid, date, numeric, text, text)
is 'Records partial or full card statement payment, moves the chosen financial account and restores card limit without creating a second expense.';

commit;
