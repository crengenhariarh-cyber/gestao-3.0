begin;

create function app_private.record_financial_transfer_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_transfer_on date,
  p_amount numeric,
  p_idempotency_key text,
  p_notes text default null
)
returns table (
  transfer_id uuid,
  from_balance numeric,
  to_balance numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfer_id uuid;
  v_existing public.financial_transfers%rowtype;
  v_from_balance numeric;
  v_to_balance numeric;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id, p_company_id) then raise exception 'company management permission required'; end if;
  if p_from_account_id = p_to_account_id then raise exception 'transfer accounts must be different'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'transfer amount must be greater than zero'; end if;
  if p_transfer_on is null then raise exception 'transfer date is required'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 then raise exception 'idempotency key is required'; end if;

  select * into v_existing
  from public.financial_transfers
  where tenant_id = p_tenant_id
    and company_id = p_company_id
    and idempotency_key = btrim(p_idempotency_key);

  if found then
    if v_existing.from_account_id <> p_from_account_id
      or v_existing.to_account_id <> p_to_account_id
      or v_existing.transfer_on <> p_transfer_on
      or v_existing.amount <> p_amount then
      raise exception 'idempotency key already used with different transfer data';
    end if;

    select current_balance into v_from_balance
    from public.financial_account_balances
    where tenant_id = p_tenant_id and company_id = p_company_id and account_id = p_from_account_id;

    select current_balance into v_to_balance
    from public.financial_account_balances
    where tenant_id = p_tenant_id and company_id = p_company_id and account_id = p_to_account_id;

    return query select v_existing.id, v_from_balance, v_to_balance;
    return;
  end if;

  perform 1
  from public.financial_accounts
  where tenant_id = p_tenant_id
    and company_id = p_company_id
    and id in (p_from_account_id, p_to_account_id)
    and status = 'active'
  order by id
  for update;

  if (select count(*) from public.financial_accounts
      where tenant_id = p_tenant_id and company_id = p_company_id
        and id in (p_from_account_id, p_to_account_id) and status = 'active') <> 2 then
    raise exception 'both transfer accounts must be active and belong to the same company';
  end if;

  insert into public.financial_transfers (
    tenant_id, company_id, from_account_id, to_account_id,
    transfer_on, amount, idempotency_key, notes, created_by
  ) values (
    p_tenant_id, p_company_id, p_from_account_id, p_to_account_id,
    p_transfer_on, p_amount, btrim(p_idempotency_key), nullif(btrim(p_notes), ''), auth.uid()
  ) returning id into v_transfer_id;

  insert into public.financial_account_movements (
    tenant_id, company_id, account_id, movement_on, direction,
    amount, source_type, source_id, description
  ) values
  (p_tenant_id, p_company_id, p_from_account_id, p_transfer_on, 'outflow', p_amount, 'transfer', v_transfer_id, 'Transferência entre contas'),
  (p_tenant_id, p_company_id, p_to_account_id, p_transfer_on, 'inflow', p_amount, 'transfer', v_transfer_id, 'Transferência entre contas');

  insert into public.audit_log (tenant_id, company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_tenant_id, p_company_id, auth.uid(), 'financial_transfer.recorded',
    'financial_transfer', v_transfer_id,
    jsonb_build_object(
      'from_account_id', p_from_account_id,
      'to_account_id', p_to_account_id,
      'transfer_on', p_transfer_on,
      'amount', p_amount,
      'idempotency_key', btrim(p_idempotency_key)
    )
  );

  select current_balance into v_from_balance
  from public.financial_account_balances
  where tenant_id = p_tenant_id and company_id = p_company_id and account_id = p_from_account_id;

  select current_balance into v_to_balance
  from public.financial_account_balances
  where tenant_id = p_tenant_id and company_id = p_company_id and account_id = p_to_account_id;

  return query select v_transfer_id, v_from_balance, v_to_balance;
end;
$$;

revoke all on function app_private.record_financial_transfer_impl(uuid, uuid, uuid, uuid, date, numeric, text, text) from public, anon, authenticated;

create function public.record_financial_transfer(
  p_tenant_id uuid,
  p_company_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_transfer_on date,
  p_amount numeric,
  p_idempotency_key text,
  p_notes text default null
)
returns table (
  transfer_id uuid,
  from_balance numeric,
  to_balance numeric
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from app_private.record_financial_transfer_impl(
    p_tenant_id, p_company_id, p_from_account_id, p_to_account_id,
    p_transfer_on, p_amount, p_idempotency_key, p_notes
  );
$$;

revoke all on function public.record_financial_transfer(uuid, uuid, uuid, uuid, date, numeric, text, text) from public, anon;
grant execute on function public.record_financial_transfer(uuid, uuid, uuid, uuid, date, numeric, text, text) to authenticated;

comment on function public.record_financial_transfer(uuid, uuid, uuid, uuid, date, numeric, text, text)
is 'Records one company-internal transfer atomically as two linked ledger movements. Idempotent and excluded from operating income/expense.';

commit;
