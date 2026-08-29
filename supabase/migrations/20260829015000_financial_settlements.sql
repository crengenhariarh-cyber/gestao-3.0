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

comment on table public.financial_settlements is 'Append-only effective settlement history. Direct client mutation is blocked.';
comment on view public.financial_installment_balances is 'Derived installment settlement totals and pending/partial/paid status.';

commit;
