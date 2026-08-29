begin;

create table public.financial_account_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  account_id uuid not null,
  movement_on date not null,
  direction text not null check (direction in ('inflow', 'outflow')),
  amount numeric(14,2) not null check (amount > 0),
  source_type text not null check (source_type in ('settlement', 'transfer')),
  source_id uuid not null,
  description text,
  created_at timestamptz not null default now(),
  constraint financial_account_movements_account_fk
    foreign key (tenant_id, company_id, account_id)
    references public.financial_accounts (tenant_id, company_id, id)
    on delete restrict,
  unique (tenant_id, company_id, source_type, source_id, account_id, direction),
  unique (tenant_id, company_id, id)
);

create table public.financial_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  from_account_id uuid not null,
  to_account_id uuid not null,
  transfer_on date not null,
  amount numeric(14,2) not null check (amount > 0),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 200),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint financial_transfers_from_account_fk
    foreign key (tenant_id, company_id, from_account_id)
    references public.financial_accounts (tenant_id, company_id, id)
    on delete restrict,
  constraint financial_transfers_to_account_fk
    foreign key (tenant_id, company_id, to_account_id)
    references public.financial_accounts (tenant_id, company_id, id)
    on delete restrict,
  constraint financial_transfers_distinct_accounts_check
    check (from_account_id <> to_account_id),
  unique (tenant_id, company_id, idempotency_key),
  unique (tenant_id, company_id, id)
);

create index financial_account_movements_account_date_idx
  on public.financial_account_movements (tenant_id, company_id, account_id, movement_on);

create index financial_transfers_company_date_idx
  on public.financial_transfers (tenant_id, company_id, transfer_on);

alter table public.financial_account_movements enable row level security;
alter table public.financial_transfers enable row level security;

create policy financial_account_movements_select_authorized
on public.financial_account_movements
for select
to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create policy financial_transfers_select_authorized
on public.financial_transfers
for select
to authenticated
using (app_private.can_access_company(tenant_id, company_id));

revoke insert, update, delete on public.financial_account_movements from anon, authenticated;
revoke insert, update, delete on public.financial_transfers from anon, authenticated;
grant select on public.financial_account_movements to authenticated;
grant select on public.financial_transfers to authenticated;

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
)
select
  fs.tenant_id,
  fs.company_id,
  fs.account_id,
  fs.settled_on,
  case when fe.entry_type = 'income' then 'inflow' else 'outflow' end,
  fs.amount,
  'settlement',
  fs.id,
  fe.description
from public.financial_settlements fs
join public.financial_installments fi
  on fi.tenant_id = fs.tenant_id
  and fi.company_id = fs.company_id
  and fi.id = fs.installment_id
join public.financial_entries fe
  on fe.tenant_id = fi.tenant_id
  and fe.company_id = fi.company_id
  and fe.id = fi.entry_id
on conflict do nothing;

create function app_private.record_settlement_account_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_type text;
  v_description text;
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
    new.company_id,
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

revoke all on function app_private.record_settlement_account_movement() from public, anon, authenticated;

create trigger financial_settlements_record_account_movement
after insert on public.financial_settlements
for each row execute function app_private.record_settlement_account_movement();

create view public.financial_account_balances
with (security_invoker = true)
as
select
  fa.id as account_id,
  fa.tenant_id,
  fa.company_id,
  fa.name,
  fa.account_type,
  fa.status,
  fa.opening_balance,
  coalesce(sum(
    case
      when fam.direction = 'inflow' then fam.amount
      when fam.direction = 'outflow' then -fam.amount
      else 0
    end
  ), 0)::numeric(14,2) as movement_total,
  (fa.opening_balance + coalesce(sum(
    case
      when fam.direction = 'inflow' then fam.amount
      when fam.direction = 'outflow' then -fam.amount
      else 0
    end
  ), 0))::numeric(14,2) as current_balance
from public.financial_accounts fa
left join public.financial_account_movements fam
  on fam.tenant_id = fa.tenant_id
  and fam.company_id = fa.company_id
  and fam.account_id = fa.id
group by
  fa.id,
  fa.tenant_id,
  fa.company_id,
  fa.name,
  fa.account_type,
  fa.status,
  fa.opening_balance;

revoke all on public.financial_account_balances from public, anon;
grant select on public.financial_account_balances to authenticated;

comment on table public.financial_account_movements is 'Immutable account ledger movements generated by settlements and transfers.';
comment on table public.financial_transfers is 'Company-internal transfers. One transfer produces two linked account movements and never affects operating result.';
comment on view public.financial_account_balances is 'Derived account balance = opening balance + immutable account movements.';

commit;
