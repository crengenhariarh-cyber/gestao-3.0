begin;

create table public.payroll_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  employment_contract_id uuid not null,
  cost_center_id uuid,
  competence_month date not null check (extract(day from competence_month) = 1),
  occurred_on date,
  event_kind text not null check (event_kind in (
    'benefit',
    'advance',
    'overtime',
    'absence',
    'dsr',
    'adjustment_earning',
    'adjustment_deduction'
  )),
  quantity numeric(12,4),
  unit_value numeric(14,4),
  amount numeric(14,2) not null check (amount >= 0),
  description text,
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'voided')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  constraint payroll_events_contract_fk foreign key (tenant_id, company_id, employment_contract_id)
    references public.employment_contracts(tenant_id, company_id, id) on delete restrict,
  constraint payroll_events_cost_center_fk foreign key (tenant_id, company_id, cost_center_id)
    references public.cost_centers(tenant_id, company_id, id) on delete restrict,
  unique (tenant_id, company_id, idempotency_key),
  constraint payroll_events_void_state_ck check (
    (status = 'active' and voided_at is null and voided_by is null)
    or (status = 'voided' and voided_at is not null)
  )
);

create index payroll_events_contract_competence_idx
  on public.payroll_events (tenant_id, company_id, employment_contract_id, competence_month);
create index payroll_events_cost_center_competence_idx
  on public.payroll_events (tenant_id, company_id, cost_center_id, competence_month);
create index payroll_events_kind_competence_idx
  on public.payroll_events (tenant_id, company_id, event_kind, competence_month);

alter table public.payroll_events enable row level security;

create policy payroll_events_select_authorized
on public.payroll_events for select to authenticated
using (app_private.can_access_company(tenant_id, company_id));

revoke all on table public.payroll_events from public, anon, authenticated;
grant select on table public.payroll_events to authenticated;

create function app_private.record_payroll_event_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_employment_contract_id uuid,
  p_cost_center_id uuid,
  p_competence_month date,
  p_occurred_on date,
  p_event_kind text,
  p_quantity numeric,
  p_unit_value numeric,
  p_amount numeric,
  p_description text,
  p_idempotency_key text
)
returns table(event_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.payroll_events%rowtype;
  v_key text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id, p_company_id) then
    raise exception 'company management permission required';
  end if;
  if p_competence_month is null or extract(day from p_competence_month) <> 1 then
    raise exception 'competence month must be first day of month';
  end if;
  if p_event_kind not in ('benefit','advance','overtime','absence','dsr','adjustment_earning','adjustment_deduction') then
    raise exception 'invalid payroll event kind';
  end if;
  if p_amount is null or p_amount < 0 or round(p_amount, 2) <> p_amount then
    raise exception 'payroll event amount must be non-negative with at most two decimals';
  end if;
  v_key := btrim(coalesce(p_idempotency_key, ''));
  if length(v_key) < 1 or length(v_key) > 200 then raise exception 'invalid idempotency key'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':' || p_company_id::text || ':' || v_key, 0)
  );

  select * into v_existing
  from public.payroll_events pe
  where pe.tenant_id = p_tenant_id
    and pe.company_id = p_company_id
    and pe.idempotency_key = v_key;

  if found then
    if v_existing.employment_contract_id <> p_employment_contract_id
      or v_existing.cost_center_id is distinct from p_cost_center_id
      or v_existing.competence_month <> p_competence_month
      or v_existing.occurred_on is distinct from p_occurred_on
      or v_existing.event_kind <> p_event_kind
      or v_existing.quantity is distinct from p_quantity
      or v_existing.unit_value is distinct from p_unit_value
      or v_existing.amount <> p_amount::numeric(14,2) then
      raise exception 'idempotency key already used with different payroll event data';
    end if;
    return query select v_existing.id;
    return;
  end if;

  if not exists (
    select 1 from public.employment_contracts ec
    where ec.tenant_id = p_tenant_id
      and ec.company_id = p_company_id
      and ec.id = p_employment_contract_id
  ) then raise exception 'employment contract not found in company'; end if;

  if p_cost_center_id is not null and not exists (
    select 1 from public.cost_centers cc
    where cc.tenant_id = p_tenant_id
      and cc.company_id = p_company_id
      and cc.id = p_cost_center_id
      and cc.status = 'active'
  ) then raise exception 'active cost center not found in company'; end if;

  insert into public.payroll_events (
    tenant_id, company_id, employment_contract_id, cost_center_id,
    competence_month, occurred_on, event_kind, quantity, unit_value,
    amount, description, idempotency_key, created_by
  ) values (
    p_tenant_id, p_company_id, p_employment_contract_id, p_cost_center_id,
    p_competence_month, p_occurred_on, p_event_kind, p_quantity, p_unit_value,
    p_amount::numeric(14,2), nullif(btrim(p_description), ''), v_key, auth.uid()
  ) returning id into event_id;

  insert into public.audit_log (
    tenant_id, company_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_tenant_id, p_company_id, auth.uid(), 'payroll_event.recorded', 'payroll_event', event_id,
    pg_catalog.jsonb_build_object(
      'employment_contract_id', p_employment_contract_id,
      'cost_center_id', p_cost_center_id,
      'competence_month', p_competence_month,
      'event_kind', p_event_kind,
      'amount', p_amount,
      'idempotency_key', v_key
    )
  );

  return next;
end;
$$;

revoke all on function app_private.record_payroll_event_impl(uuid,uuid,uuid,uuid,date,date,text,numeric,numeric,numeric,text,text) from public, anon;
grant execute on function app_private.record_payroll_event_impl(uuid,uuid,uuid,uuid,date,date,text,numeric,numeric,numeric,text,text) to authenticated;

create function public.record_payroll_event(
  p_tenant_id uuid,
  p_company_id uuid,
  p_employment_contract_id uuid,
  p_cost_center_id uuid,
  p_competence_month date,
  p_occurred_on date,
  p_event_kind text,
  p_quantity numeric,
  p_unit_value numeric,
  p_amount numeric,
  p_description text,
  p_idempotency_key text
)
returns table(event_id uuid)
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.record_payroll_event_impl(
    p_tenant_id,p_company_id,p_employment_contract_id,p_cost_center_id,
    p_competence_month,p_occurred_on,p_event_kind,p_quantity,p_unit_value,
    p_amount,p_description,p_idempotency_key
  );
$$;

revoke all on function public.record_payroll_event(uuid,uuid,uuid,uuid,date,date,text,numeric,numeric,numeric,text,text) from public, anon;
grant execute on function public.record_payroll_event(uuid,uuid,uuid,uuid,date,date,text,numeric,numeric,numeric,text,text) to authenticated;

commit;
