begin;

alter table public.financial_accounts
  add constraint financial_accounts_scope_id_key
  unique (tenant_id, company_id, id);

create table public.financial_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  installment_id uuid not null,
  account_id uuid not null,
  settled_on date not null,
  amount numeric(14,2) not null check (amount > 0),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 200),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint financial_settlements_installment_fk
    foreign key (tenant_id, company_id, installment_id)
    references public.financial_installments (tenant_id, company_id, id)
    on delete restrict,
  constraint financial_settlements_account_fk
    foreign key (tenant_id, company_id, account_id)
    references public.financial_accounts (tenant_id, company_id, id)
    on delete restrict,
  unique (tenant_id, company_id, idempotency_key),
  unique (tenant_id, company_id, id)
);

create index financial_settlements_installment_idx
  on public.financial_settlements (tenant_id, company_id, installment_id, settled_on);

create index financial_settlements_account_idx
  on public.financial_settlements (tenant_id, company_id, account_id, settled_on);

alter table public.financial_settlements enable row level security;

create policy financial_settlements_select_authorized
on public.financial_settlements
for select
to authenticated
using (app_private.can_access_company(tenant_id, company_id));

revoke insert, update, delete on public.financial_settlements from anon, authenticated;
grant select on public.financial_settlements to authenticated;

create or replace function public.register_financial_settlement(
  p_tenant_id uuid,
  p_company_id uuid,
  p_installment_id uuid,
  p_account_id uuid,
  p_settled_on date,
  p_amount numeric,
  p_idempotency_key text,
  p_notes text default null
)
returns table(
  settlement_id uuid,
  settled_amount numeric,
  installment_amount numeric,
  settled_total numeric,
  remaining_amount numeric,
  financial_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.financial_settlements%rowtype;
  v_installment_amount numeric(14,2);
  v_settled_total numeric(14,2);
  v_remaining numeric(14,2);
  v_settlement_id uuid;
  v_status text;
  v_account_active boolean;
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not app_private.can_manage_company(p_tenant_id, p_company_id) then
    raise exception 'not authorized for company';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'settlement amount must be greater than zero';
  end if;

  if p_settled_on is null then
    raise exception 'settlement date is required';
  end if;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  if length(v_key) < 1 or length(v_key) > 200 then
    raise exception 'idempotency key must contain between 1 and 200 characters';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':' || p_company_id::text || ':' || v_key, 0)
  );

  select * into v_existing
  from public.financial_settlements fs
  where fs.tenant_id = p_tenant_id
    and fs.company_id = p_company_id
    and fs.idempotency_key = v_key;

  if found then
    if v_existing.installment_id <> p_installment_id
      or v_existing.account_id <> p_account_id
      or v_existing.settled_on <> p_settled_on
      or v_existing.amount <> p_amount::numeric(14,2) then
      raise exception 'idempotency key already used with different settlement data';
    end if;

    select fi.amount into v_installment_amount
    from public.financial_installments fi
    where fi.tenant_id = p_tenant_id
      and fi.company_id = p_company_id
      and fi.id = p_installment_id;

    select coalesce(sum(fs.amount), 0)::numeric(14,2) into v_settled_total
    from public.financial_settlements fs
    where fs.tenant_id = p_tenant_id
      and fs.company_id = p_company_id
      and fs.installment_id = p_installment_id;

    v_remaining := greatest(v_installment_amount - v_settled_total, 0);
    v_status := case
      when v_settled_total = 0 then 'pending'
      when v_settled_total < v_installment_amount then 'partial'
      else 'paid'
    end;

    return query select
      v_existing.id,
      v_existing.amount,
      v_installment_amount,
      v_settled_total,
      v_remaining,
      v_status;
    return;
  end if;

  select fi.amount into v_installment_amount
  from public.financial_installments fi
  where fi.tenant_id = p_tenant_id
    and fi.company_id = p_company_id
    and fi.id = p_installment_id
  for update;

  if not found then
    raise exception 'financial installment not found in company';
  end if;

  select exists (
    select 1
    from public.financial_accounts fa
    where fa.tenant_id = p_tenant_id
      and fa.company_id = p_company_id
      and fa.id = p_account_id
      and fa.status = 'active'
  ) into v_account_active;

  if not v_account_active then
    raise exception 'active financial account not found in company';
  end if;

  select coalesce(sum(fs.amount), 0)::numeric(14,2) into v_settled_total
  from public.financial_settlements fs
  where fs.tenant_id = p_tenant_id
    and fs.company_id = p_company_id
    and fs.installment_id = p_installment_id;

  if v_settled_total + p_amount > v_installment_amount then
    raise exception 'settlement exceeds installment remaining amount';
  end if;

  insert into public.financial_settlements (
    tenant_id,
    company_id,
    installment_id,
    account_id,
    settled_on,
    amount,
    idempotency_key,
    notes,
    created_by
  ) values (
    p_tenant_id,
    p_company_id,
    p_installment_id,
    p_account_id,
    p_settled_on,
    p_amount,
    v_key,
    nullif(btrim(p_notes), ''),
    auth.uid()
  ) returning id into v_settlement_id;

  v_settled_total := (v_settled_total + p_amount)::numeric(14,2);
  v_remaining := greatest(v_installment_amount - v_settled_total, 0);
  v_status := case
    when v_settled_total = 0 then 'pending'
    when v_settled_total < v_installment_amount then 'partial'
    else 'paid'
  end;

  insert into public.audit_log (
    tenant_id,
    company_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_tenant_id,
    p_company_id,
    auth.uid(),
    'financial_settlement.registered',
    'financial_settlement',
    v_settlement_id,
    pg_catalog.jsonb_build_object(
      'installment_id', p_installment_id,
      'account_id', p_account_id,
      'settled_on', p_settled_on,
      'amount', p_amount,
      'idempotency_key', v_key,
      'status_after', v_status
    )
  );

  return query select
    v_settlement_id,
    p_amount::numeric(14,2),
    v_installment_amount,
    v_settled_total,
    v_remaining,
    v_status;
end;
$$;

revoke all on function public.register_financial_settlement(uuid, uuid, uuid, uuid, date, numeric, text, text) from public, anon;
grant execute on function public.register_financial_settlement(uuid, uuid, uuid, uuid, date, numeric, text, text) to authenticated;

create view public.financial_installment_balances
with (security_invoker = true)
as
select
  fi.id as installment_id,
  fi.tenant_id,
  fi.company_id,
  fi.entry_id,
  fi.installment_number,
  fi.installment_count,
  fi.due_date,
  fi.competence_month,
  fi.amount as installment_amount,
  coalesce(sum(fs.amount), 0)::numeric(14,2) as settled_amount,
  greatest(fi.amount - coalesce(sum(fs.amount), 0), 0)::numeric(14,2) as remaining_amount,
  case
    when coalesce(sum(fs.amount), 0) = 0 then 'pending'
    when coalesce(sum(fs.amount), 0) < fi.amount then 'partial'
    else 'paid'
  end as financial_status
from public.financial_installments fi
left join public.financial_settlements fs
  on fs.tenant_id = fi.tenant_id
  and fs.company_id = fi.company_id
  and fs.installment_id = fi.id
group by
  fi.id,
  fi.tenant_id,
  fi.company_id,
  fi.entry_id,
  fi.installment_number,
  fi.installment_count,
  fi.due_date,
  fi.competence_month,
  fi.amount;

revoke all on public.financial_installment_balances from public, anon;
grant select on public.financial_installment_balances to authenticated;

comment on table public.financial_settlements is 'Append-only effective payments/receipts. Critical writes only through register_financial_settlement.';
comment on view public.financial_installment_balances is 'Derived installment settlement totals and pending/partial/paid status.';

commit;
