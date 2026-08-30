begin;

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
  if v_user_id is null or not app_private.can_manage_company(p_tenant_id, p_company_id) then
    raise exception 'not authorized';
  end if;
  if p_competence_month <> date_trunc('month', p_competence_month)::date then
    raise exception 'competence must be first day of month';
  end if;
  if nullif(btrim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;

  select * into v_existing
  from public.payroll_closings
  where tenant_id = p_tenant_id
    and company_id = p_company_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.employment_contract_id <> p_employment_contract_id
       or v_existing.competence_month <> p_competence_month then
      raise exception 'idempotency key conflict';
    end if;
    return v_existing.id;
  end if;

  perform 1
  from public.employment_contracts
  where tenant_id = p_tenant_id
    and company_id = p_company_id
    and id = p_employment_contract_id
    and hired_on <= (p_competence_month + interval '1 month - 1 day')::date
    and (terminated_on is null or terminated_on >= p_competence_month);
  if not found then raise exception 'employment contract not active in competence'; end if;

  select base_salary into v_salary
  from public.compensation_terms
  where tenant_id = p_tenant_id
    and company_id = p_company_id
    and employment_contract_id = p_employment_contract_id
    and valid_from <= (p_competence_month + interval '1 month - 1 day')::date
    and (valid_to is null or valid_to >= p_competence_month)
  order by valid_from desc
  limit 1;
  if v_salary is null then raise exception 'compensation term not found'; end if;

  select
    coalesce(sum(case when event_kind in ('benefit','overtime','adjustment_earning') then amount else 0 end),0),
    coalesce(sum(case when event_kind in ('advance','absence','dsr','adjustment_deduction') then amount else 0 end),0)
  into v_credit, v_debit
  from public.payroll_events
  where tenant_id = p_tenant_id
    and company_id = p_company_id
    and employment_contract_id = p_employment_contract_id
    and competence_month = p_competence_month
    and status = 'active';

  insert into public.payroll_closings(
    tenant_id, company_id, employment_contract_id, competence_month,
    base_salary_snapshot, events_credit_snapshot, events_debit_snapshot,
    gross_snapshot, net_before_statutory_snapshot, idempotency_key, closed_by
  ) values (
    p_tenant_id, p_company_id, p_employment_contract_id, p_competence_month,
    v_salary, v_credit, v_debit, v_salary + v_credit, v_salary + v_credit - v_debit,
    btrim(p_idempotency_key), v_user_id
  ) returning id into v_closing_id;

  insert into public.payroll_closing_event_snapshots(
    tenant_id, company_id, payroll_closing_id, payroll_event_id,
    event_type, amount, quantity, description, cost_center_id
  )
  select
    tenant_id, company_id, v_closing_id, id,
    event_kind, amount, quantity, description, cost_center_id
  from public.payroll_events
  where tenant_id = p_tenant_id
    and company_id = p_company_id
    and employment_contract_id = p_employment_contract_id
    and competence_month = p_competence_month
    and status = 'active';

  insert into public.audit_log(
    tenant_id, company_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_tenant_id, p_company_id, v_user_id, 'payroll.closed', 'payroll_closing', v_closing_id,
    jsonb_build_object(
      'competence_month', p_competence_month,
      'employment_contract_id', p_employment_contract_id,
      'base_salary', v_salary,
      'event_credits', v_credit,
      'event_debits', v_debit,
      'idempotency_key', btrim(p_idempotency_key)
    )
  );

  return v_closing_id;
end;
$$;

revoke all on function app_private.close_payroll_impl(uuid,uuid,uuid,date,text) from public, anon;
grant execute on function app_private.close_payroll_impl(uuid,uuid,uuid,date,text) to authenticated;

commit;
