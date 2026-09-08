alter table public.financial_transfers
  add column if not exists from_company_id uuid,
  add column if not exists to_company_id uuid;

update public.financial_transfers
set from_company_id = coalesce(from_company_id, company_id),
    to_company_id = coalesce(to_company_id, company_id)
where from_company_id is null or to_company_id is null;

alter table public.financial_transfers
  alter column from_company_id set not null,
  alter column to_company_id set not null;

alter table public.financial_transfers
  drop constraint if exists financial_transfers_from_account_fk,
  drop constraint if exists financial_transfers_to_account_fk;

alter table public.financial_transfers
  add constraint financial_transfers_from_account_fk
    foreign key (tenant_id, from_company_id, from_account_id)
    references public.financial_accounts (tenant_id, company_id, id)
    on delete restrict,
  add constraint financial_transfers_to_account_fk
    foreign key (tenant_id, to_company_id, to_account_id)
    references public.financial_accounts (tenant_id, company_id, id)
    on delete restrict;

create or replace function app_private.record_financial_transfer_impl(
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
  v_from_company_id uuid;
  v_to_company_id uuid;
  v_from_balance numeric;
  v_to_balance numeric;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_from_account_id = p_to_account_id then raise exception 'transfer accounts must be different'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'transfer amount must be greater than zero'; end if;
  if p_transfer_on is null then raise exception 'transfer date is required'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 then raise exception 'idempotency key is required'; end if;

  select company_id into v_from_company_id
  from public.financial_accounts
  where tenant_id = p_tenant_id and id = p_from_account_id and status = 'active';

  select company_id into v_to_company_id
  from public.financial_accounts
  where tenant_id = p_tenant_id and id = p_to_account_id and status = 'active';

  if v_from_company_id is null or v_to_company_id is null then
    raise exception 'both transfer accounts must be active and belong to the tenant';
  end if;

  if not app_private.can_manage_company(p_tenant_id, v_from_company_id) then
    raise exception 'source company management permission required';
  end if;
  if not app_private.can_manage_company(p_tenant_id, v_to_company_id) then
    raise exception 'destination company management permission required';
  end if;

  select * into v_existing
  from public.financial_transfers
  where tenant_id = p_tenant_id
    and company_id = v_from_company_id
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
    where tenant_id = p_tenant_id and company_id = v_existing.from_company_id and account_id = p_from_account_id;

    select current_balance into v_to_balance
    from public.financial_account_balances
    where tenant_id = p_tenant_id and company_id = v_existing.to_company_id and account_id = p_to_account_id;

    return query select v_existing.id, v_from_balance, v_to_balance;
    return;
  end if;

  perform 1 from public.financial_accounts
  where tenant_id = p_tenant_id and id in (p_from_account_id, p_to_account_id) and status = 'active'
  order by id for update;

  insert into public.financial_transfers (
    tenant_id, company_id, from_company_id, to_company_id,
    from_account_id, to_account_id, transfer_on, amount,
    idempotency_key, notes, created_by
  ) values (
    p_tenant_id, v_from_company_id, v_from_company_id, v_to_company_id,
    p_from_account_id, p_to_account_id, p_transfer_on, p_amount,
    btrim(p_idempotency_key), nullif(btrim(p_notes), ''), auth.uid()
  ) returning id into v_transfer_id;

  insert into public.financial_account_movements (
    tenant_id, company_id, account_id, movement_on, direction,
    amount, source_type, source_id, description
  ) values
  (p_tenant_id, v_from_company_id, p_from_account_id, p_transfer_on, 'outflow', p_amount, 'transfer', v_transfer_id, 'Transferência entre contas'),
  (p_tenant_id, v_to_company_id, p_to_account_id, p_transfer_on, 'inflow', p_amount, 'transfer', v_transfer_id, 'Transferência entre contas');

  insert into public.audit_log (tenant_id, company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_tenant_id, v_from_company_id, auth.uid(), 'financial_transfer.recorded',
    'financial_transfer', v_transfer_id,
    jsonb_build_object(
      'from_company_id', v_from_company_id,
      'to_company_id', v_to_company_id,
      'from_account_id', p_from_account_id,
      'to_account_id', p_to_account_id,
      'transfer_on', p_transfer_on,
      'amount', p_amount,
      'idempotency_key', btrim(p_idempotency_key)
    )
  );

  select current_balance into v_from_balance
  from public.financial_account_balances
  where tenant_id = p_tenant_id and company_id = v_from_company_id and account_id = p_from_account_id;

  select current_balance into v_to_balance
  from public.financial_account_balances
  where tenant_id = p_tenant_id and company_id = v_to_company_id and account_id = p_to_account_id;

  return query select v_transfer_id, v_from_balance, v_to_balance;
end;
$$;

comment on function public.record_financial_transfer(uuid, uuid, uuid, uuid, date, numeric, text, text)
is 'Records an internal or cross-company tenant transfer atomically as two linked ledger movements without affecting operating income/expense.';
