begin;

alter table public.payroll_closing_event_snapshots
  add column salary_effect text not null default 'neutral'
    check (salary_effect in ('earning','deduction','neutral')),
  add column affects_inss_base boolean not null default false,
  add column affects_irrf_base boolean not null default false,
  add column affects_fgts_base boolean not null default false,
  add column incidence_review_required boolean not null default false;

create or replace function app_private.record_payroll_event_impl(
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
  if p_occurred_on is not null and date_trunc('month', p_occurred_on)::date <> p_competence_month then
    raise exception 'event date must belong to competence month';
  end if;
  if p_event_kind in ('absence','dsr') then
    if p_occurred_on is null then raise exception 'absence/dsr event date required'; end if;
    if p_quantity is null or p_quantity <= 0 then raise exception 'absence/dsr quantity must be positive'; end if;
    if p_amount <= 0 then raise exception 'absence/dsr amount must be positive'; end if;
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

create or replace function app_private.close_payroll_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_employment_contract_id uuid,
  p_competence_month date,
  p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.payroll_closings%rowtype;
  v_salary numeric(14,2);
  v_credit numeric(14,2);
  v_debit numeric(14,2);
  v_closing_id uuid;
begin
  if v_user_id is null or not app_private.can_manage_company(p_tenant_id, p_company_id) then raise exception 'not authorized'; end if;
  if p_competence_month <> date_trunc('month', p_competence_month)::date then raise exception 'competence must be first day of month'; end if;
  if nullif(btrim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;

  select * into v_existing from public.payroll_closings
  where tenant_id=p_tenant_id and company_id=p_company_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.employment_contract_id<>p_employment_contract_id or v_existing.competence_month<>p_competence_month then raise exception 'idempotency key conflict'; end if;
    return v_existing.id;
  end if;

  perform 1 from public.employment_contracts
  where tenant_id=p_tenant_id and company_id=p_company_id and id=p_employment_contract_id
    and hired_on <= (p_competence_month + interval '1 month - 1 day')::date
    and (terminated_on is null or terminated_on >= p_competence_month);
  if not found then raise exception 'employment contract not active in competence'; end if;

  select base_salary into v_salary from public.compensation_terms
  where tenant_id=p_tenant_id and company_id=p_company_id and employment_contract_id=p_employment_contract_id
    and valid_from <= (p_competence_month + interval '1 month - 1 day')::date
    and (valid_to is null or valid_to >= p_competence_month)
  order by valid_from desc limit 1;
  if v_salary is null then raise exception 'compensation term not found'; end if;

  select
    coalesce(sum(case when event_kind in ('benefit','overtime','adjustment_earning') then amount else 0 end),0),
    coalesce(sum(case when event_kind in ('advance','absence','dsr','adjustment_deduction') then amount else 0 end),0)
  into v_credit,v_debit
  from public.payroll_events
  where tenant_id=p_tenant_id and company_id=p_company_id
    and employment_contract_id=p_employment_contract_id and competence_month=p_competence_month
    and status='active';

  insert into public.payroll_closings(
    tenant_id,company_id,employment_contract_id,competence_month,
    base_salary_snapshot,events_credit_snapshot,events_debit_snapshot,
    gross_snapshot,net_before_statutory_snapshot,idempotency_key,closed_by
  ) values(
    p_tenant_id,p_company_id,p_employment_contract_id,p_competence_month,
    v_salary,v_credit,v_debit,v_salary+v_credit,v_salary+v_credit-v_debit,
    btrim(p_idempotency_key),v_user_id
  ) returning id into v_closing_id;

  insert into public.payroll_closing_event_snapshots(
    tenant_id,company_id,payroll_closing_id,payroll_event_id,event_type,
    amount,quantity,description,cost_center_id,
    salary_effect,affects_inss_base,affects_irrf_base,affects_fgts_base,incidence_review_required
  )
  select tenant_id,company_id,v_closing_id,id,event_kind,amount,quantity,description,cost_center_id,
    case
      when event_kind in ('benefit','overtime','adjustment_earning') then 'earning'
      when event_kind in ('advance','absence','dsr','adjustment_deduction') then 'deduction'
      else 'neutral'
    end,
    event_kind in ('overtime','absence','dsr'),
    event_kind in ('overtime','absence','dsr'),
    event_kind in ('overtime','absence','dsr'),
    event_kind in ('benefit','adjustment_earning','adjustment_deduction')
  from public.payroll_events
  where tenant_id=p_tenant_id and company_id=p_company_id
    and employment_contract_id=p_employment_contract_id and competence_month=p_competence_month
    and status='active';

  insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(p_tenant_id,p_company_id,v_user_id,'payroll.closed','payroll_closing',v_closing_id,
    jsonb_build_object('competence_month',p_competence_month,'employment_contract_id',p_employment_contract_id,
      'base_salary',v_salary,'event_credits',v_credit,'event_debits',v_debit,
      'idempotency_key',btrim(p_idempotency_key)));
  return v_closing_id;
end;
$$;

create or replace view public.payroll_closing_pre_statutory_bases
with (security_invoker = true)
as
select
  pc.tenant_id,
  pc.company_id,
  pc.id as payroll_closing_id,
  pc.employment_contract_id,
  pc.competence_month,
  pc.base_salary_snapshot,
  greatest(0, pc.base_salary_snapshot + coalesce(sum(case
    when s.affects_inss_base and s.salary_effect='earning' then s.amount
    when s.affects_inss_base and s.salary_effect='deduction' then -s.amount
    else 0 end),0))::numeric(14,2) as inss_base_pre_rule,
  greatest(0, pc.base_salary_snapshot + coalesce(sum(case
    when s.affects_irrf_base and s.salary_effect='earning' then s.amount
    when s.affects_irrf_base and s.salary_effect='deduction' then -s.amount
    else 0 end),0))::numeric(14,2) as irrf_base_pre_rule,
  greatest(0, pc.base_salary_snapshot + coalesce(sum(case
    when s.affects_fgts_base and s.salary_effect='earning' then s.amount
    when s.affects_fgts_base and s.salary_effect='deduction' then -s.amount
    else 0 end),0))::numeric(14,2) as fgts_base_pre_rule,
  bool_or(s.incidence_review_required) as has_incidence_review_required
from public.payroll_closings pc
left join public.payroll_closing_event_snapshots s
  on s.tenant_id=pc.tenant_id and s.company_id=pc.company_id and s.payroll_closing_id=pc.id
group by pc.tenant_id,pc.company_id,pc.id,pc.employment_contract_id,pc.competence_month,pc.base_salary_snapshot;

revoke all on public.payroll_closing_pre_statutory_bases from public, anon;
grant select on public.payroll_closing_pre_statutory_bases to authenticated;

commit;
