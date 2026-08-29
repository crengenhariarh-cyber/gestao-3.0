begin;

alter table public.financial_installments
  add column competence_month date;

update public.financial_installments fi
set competence_month = fe.competence_month
from public.financial_entries fe
where fe.id = fi.entry_id
  and fe.tenant_id = fi.tenant_id
  and fe.company_id = fi.company_id;

alter table public.financial_installments
  alter column competence_month set not null,
  add constraint financial_installments_competence_month_check
    check (extract(day from competence_month) = 1);

create index financial_installments_company_competence_idx
  on public.financial_installments (tenant_id, company_id, competence_month);

create table public.financial_recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  entry_type text not null check (entry_type in ('income', 'expense')),
  description text not null check (length(btrim(description)) > 0),
  counterparty_name text,
  category_id uuid not null,
  cost_center_id uuid,
  amount numeric(14,2) not null check (amount > 0),
  frequency text not null default 'monthly' check (frequency in ('monthly')),
  interval_count integer not null default 1 check (interval_count >= 1),
  start_date date not null,
  end_date date,
  next_occurrence_date date not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_recurrence_rules_company_fk
    foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id)
    on delete restrict,
  constraint financial_recurrence_rules_category_fk
    foreign key (tenant_id, company_id, category_id)
    references public.financial_categories (tenant_id, company_id, id)
    on delete restrict,
  constraint financial_recurrence_rules_cost_center_fk
    foreign key (tenant_id, company_id, cost_center_id)
    references public.cost_centers (tenant_id, company_id, id)
    on delete restrict,
  constraint financial_recurrence_rules_dates_check
    check (end_date is null or end_date >= start_date),
  unique (tenant_id, company_id, id)
);

create index financial_recurrence_rules_due_idx
  on public.financial_recurrence_rules (tenant_id, company_id, next_occurrence_date)
  where status = 'active';

create trigger financial_recurrence_rules_set_updated_at
before update on public.financial_recurrence_rules
for each row execute function public.set_updated_at();

alter table public.financial_recurrence_rules enable row level security;

create policy financial_recurrence_rules_select_authorized
on public.financial_recurrence_rules
for select
to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create policy financial_recurrence_rules_insert_manager
on public.financial_recurrence_rules
for insert
to authenticated
with check (app_private.can_manage_company(tenant_id, company_id));

create policy financial_recurrence_rules_update_manager
on public.financial_recurrence_rules
for update
to authenticated
using (app_private.can_manage_company(tenant_id, company_id))
with check (app_private.can_manage_company(tenant_id, company_id));

create or replace function public.create_installment_financial_entry(
  p_tenant_id uuid,
  p_company_id uuid,
  p_entry_type text,
  p_description text,
  p_counterparty_name text,
  p_category_id uuid,
  p_cost_center_id uuid,
  p_initial_competence_month date,
  p_first_due_date date,
  p_total_amount numeric,
  p_installment_count integer,
  p_notes text default null
)
returns table(entry_id uuid, installment_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry_id uuid;
  v_total_cents bigint;
  v_base_cents bigint;
  v_remainder bigint;
  v_number integer;
  v_installment_cents bigint;
begin
  if not app_private.can_manage_company(p_tenant_id, p_company_id) then
    raise exception 'not authorized for company';
  end if;
  if p_installment_count < 1 then
    raise exception 'installment count must be at least 1';
  end if;
  if p_total_amount <= 0 then
    raise exception 'total amount must be greater than zero';
  end if;
  if extract(day from p_initial_competence_month) <> 1 then
    raise exception 'initial competence must be first day of month';
  end if;

  v_total_cents := round(p_total_amount * 100)::bigint;
  v_base_cents := v_total_cents / p_installment_count;
  v_remainder := v_total_cents % p_installment_count;

  insert into public.financial_entries (
    tenant_id, company_id, entry_type, description, counterparty_name,
    category_id, cost_center_id, competence_month, notes
  ) values (
    p_tenant_id, p_company_id, p_entry_type, btrim(p_description), nullif(btrim(p_counterparty_name), ''),
    p_category_id, p_cost_center_id, p_initial_competence_month, nullif(btrim(p_notes), '')
  ) returning id into v_entry_id;

  for v_number in 1..p_installment_count loop
    v_installment_cents := v_base_cents + case when v_number <= v_remainder then 1 else 0 end;

    insert into public.financial_installments (
      tenant_id, company_id, entry_id, installment_number, installment_count,
      due_date, competence_month, amount
    ) values (
      p_tenant_id,
      p_company_id,
      v_entry_id,
      v_number,
      p_installment_count,
      (p_first_due_date + make_interval(months => v_number - 1))::date,
      (p_initial_competence_month + make_interval(months => v_number - 1))::date,
      v_installment_cents::numeric / 100
    );
  end loop;

  return query select v_entry_id, p_installment_count;
end;
$$;

revoke all on function public.create_installment_financial_entry(uuid, uuid, text, text, text, uuid, uuid, date, date, numeric, integer, text) from public;
grant execute on function public.create_installment_financial_entry(uuid, uuid, text, text, text, uuid, uuid, date, date, numeric, integer, text) to authenticated;

create or replace function public.create_single_financial_entry(
  p_tenant_id uuid,
  p_company_id uuid,
  p_entry_type text,
  p_description text,
  p_counterparty_name text,
  p_category_id uuid,
  p_cost_center_id uuid,
  p_competence_month date,
  p_due_date date,
  p_amount numeric,
  p_notes text default null
)
returns table(entry_id uuid, installment_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry_id uuid;
  v_installment_id uuid;
begin
  if not app_private.can_manage_company(p_tenant_id, p_company_id) then
    raise exception 'not authorized for company';
  end if;

  insert into public.financial_entries (
    tenant_id, company_id, entry_type, description, counterparty_name,
    category_id, cost_center_id, competence_month, notes
  ) values (
    p_tenant_id, p_company_id, p_entry_type, btrim(p_description), nullif(btrim(p_counterparty_name), ''),
    p_category_id, p_cost_center_id, p_competence_month, nullif(btrim(p_notes), '')
  ) returning id into v_entry_id;

  insert into public.financial_installments (
    tenant_id, company_id, entry_id, installment_number, installment_count,
    due_date, competence_month, amount
  ) values (
    p_tenant_id, p_company_id, v_entry_id, 1, 1,
    p_due_date, p_competence_month, p_amount
  ) returning id into v_installment_id;

  return query select v_entry_id, v_installment_id;
end;
$$;

revoke all on function public.create_single_financial_entry(uuid, uuid, text, text, text, uuid, uuid, date, date, numeric, text) from public;
grant execute on function public.create_single_financial_entry(uuid, uuid, text, text, text, uuid, uuid, date, date, numeric, text) to authenticated;

comment on column public.financial_installments.competence_month is 'Monthly competence of the individual installment/occurrence.';
comment on table public.financial_recurrence_rules is 'Recurring financial templates. Occurrences are materialized as independent financial entries.';

commit;
