begin;

create or replace function public.change_employee_salary(
  p_tenant_id uuid,
  p_company_id uuid,
  p_employment_contract_id uuid,
  p_effective_from date,
  p_base_salary numeric
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_hired_on date;
  v_terminated_on date;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if p_effective_from is null then raise exception 'effective date is required'; end if;
  if p_base_salary is null or p_base_salary < 0 or round(p_base_salary,2) <> p_base_salary then raise exception 'base salary must be non-negative with at most two decimals'; end if;

  select hired_on, terminated_on into v_hired_on, v_terminated_on
    from public.employment_contracts
   where tenant_id=p_tenant_id and company_id=p_company_id and id=p_employment_contract_id;
  if not found then raise exception 'employment contract not found'; end if;
  if p_effective_from < v_hired_on then raise exception 'salary effective date cannot precede hire date'; end if;
  if v_terminated_on is not null and p_effective_from > v_terminated_on then raise exception 'salary effective date cannot exceed termination date'; end if;

  update public.compensation_terms
     set valid_to = p_effective_from - 1
   where tenant_id=p_tenant_id and company_id=p_company_id and employment_contract_id=p_employment_contract_id
     and valid_from < p_effective_from and (valid_to is null or valid_to >= p_effective_from);

  insert into public.compensation_terms(tenant_id,company_id,employment_contract_id,valid_from,base_salary)
  values(p_tenant_id,p_company_id,p_employment_contract_id,p_effective_from,p_base_salary)
  on conflict (tenant_id,company_id,employment_contract_id,valid_from)
  do update set base_salary=excluded.base_salary
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_hr_employee_profile(
  p_tenant_id uuid,
  p_company_id uuid,
  p_employment_contract_id uuid,
  p_full_name text,
  p_job_title text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_employee_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.is_tenant_admin(p_tenant_id) then raise exception 'tenant admin required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if length(btrim(coalesce(p_full_name,''))) < 2 then raise exception 'employee name is required'; end if;
  if length(btrim(coalesce(p_job_title,''))) = 0 then raise exception 'job title is required'; end if;

  select employee_id into v_employee_id
    from public.employment_contracts
   where tenant_id=p_tenant_id and company_id=p_company_id and id=p_employment_contract_id;
  if not found then raise exception 'employment contract not found'; end if;

  update public.employees set full_name=btrim(p_full_name), updated_at=now()
   where tenant_id=p_tenant_id and id=v_employee_id;
  update public.employment_contracts set job_title=btrim(p_job_title), updated_at=now()
   where tenant_id=p_tenant_id and company_id=p_company_id and id=p_employment_contract_id;
  return p_employment_contract_id;
end;
$$;

create or replace function public.change_employee_allocation(
  p_tenant_id uuid,
  p_company_id uuid,
  p_employment_contract_id uuid,
  p_effective_from date,
  p_cost_center_id uuid,
  p_allocation_percent numeric default 100
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_hired_on date;
  v_terminated_on date;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if p_effective_from is null then raise exception 'effective date is required'; end if;
  if p_cost_center_id is null then raise exception 'cost center is required'; end if;
  if p_allocation_percent is null or p_allocation_percent <= 0 or p_allocation_percent > 100 then raise exception 'allocation percent must be between 0 and 100'; end if;

  select hired_on, terminated_on into v_hired_on, v_terminated_on
    from public.employment_contracts
   where tenant_id=p_tenant_id and company_id=p_company_id and id=p_employment_contract_id;
  if not found then raise exception 'employment contract not found'; end if;
  if p_effective_from < v_hired_on then raise exception 'allocation effective date cannot precede hire date'; end if;
  if v_terminated_on is not null and p_effective_from > v_terminated_on then raise exception 'allocation effective date cannot exceed termination date'; end if;
  if not exists(select 1 from public.cost_centers c where c.tenant_id=p_tenant_id and c.company_id=p_company_id and c.id=p_cost_center_id and c.status='active') then raise exception 'active cost center not found'; end if;

  update public.employee_allocations
     set valid_to=p_effective_from-1
   where tenant_id=p_tenant_id and company_id=p_company_id and employment_contract_id=p_employment_contract_id
     and valid_from < p_effective_from and (valid_to is null or valid_to >= p_effective_from);

  select id into v_id from public.employee_allocations
   where tenant_id=p_tenant_id and company_id=p_company_id and employment_contract_id=p_employment_contract_id
     and valid_from=p_effective_from
   order by created_at desc limit 1;
  if v_id is null then
    insert into public.employee_allocations(tenant_id,company_id,employment_contract_id,cost_center_id,valid_from,allocation_percent)
    values(p_tenant_id,p_company_id,p_employment_contract_id,p_cost_center_id,p_effective_from,p_allocation_percent)
    returning id into v_id;
  else
    update public.employee_allocations set cost_center_id=p_cost_center_id, allocation_percent=p_allocation_percent, valid_to=null where id=v_id;
  end if;
  return v_id;
end;
$$;

create or replace function app_private.reopen_payroll_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_payroll_closing_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid:=auth.uid(); v public.payroll_closings%rowtype;
begin
  if v_user is null or not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'reopen reason is required'; end if;
  select * into v from public.payroll_closings
   where tenant_id=p_tenant_id and company_id=p_company_id and id=p_payroll_closing_id for update;
  if not found then raise exception 'payroll closing not found'; end if;
  if v.status<>'closed' then raise exception 'only closed payroll can be reopened'; end if;
  if exists(select 1 from public.payroll_finance_links pfl where pfl.tenant_id=p_tenant_id and pfl.company_id=p_company_id and pfl.payroll_closing_id=v.id) then
    raise exception 'payroll already linked to finance and cannot be reopened';
  end if;
  delete from public.payroll_statutory_calculations where tenant_id=p_tenant_id and company_id=p_company_id and payroll_closing_id=v.id;
  update public.payroll_closings set status='reopened',reopened_at=now(),reopened_by=v_user where id=v.id;
  insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(p_tenant_id,p_company_id,v_user,'payroll.reopened','payroll_closing',v.id,pg_catalog.jsonb_build_object('reason',btrim(p_reason)));
end;
$$;

create or replace function public.reopen_payroll(p_tenant_id uuid,p_company_id uuid,p_payroll_closing_id uuid,p_reason text)
returns void language sql security invoker set search_path=''
as $$ select app_private.reopen_payroll_impl(p_tenant_id,p_company_id,p_payroll_closing_id,p_reason); $$;

create or replace function app_private.void_payroll_event_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_payroll_event_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid(); v public.payroll_events%rowtype;
begin
  if v_user is null or not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'void reason is required'; end if;
  select * into v from public.payroll_events where tenant_id=p_tenant_id and company_id=p_company_id and id=p_payroll_event_id for update;
  if not found then raise exception 'payroll event not found'; end if;
  if v.status='voided' then return v.id; end if;
  if exists(select 1 from public.payroll_closings c where c.tenant_id=p_tenant_id and c.company_id=p_company_id and c.employment_contract_id=v.employment_contract_id and c.competence_month=v.competence_month and c.status='closed') then
    raise exception 'reopen payroll before voiding an event';
  end if;
  update public.payroll_events set status='voided',voided_at=now(),voided_by=v_user where id=v.id;
  insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(p_tenant_id,p_company_id,v_user,'payroll.event_voided','payroll_event',v.id,pg_catalog.jsonb_build_object('reason',btrim(p_reason)));
  return v.id;
end;
$$;

create or replace function public.void_payroll_event(p_tenant_id uuid,p_company_id uuid,p_payroll_event_id uuid,p_reason text)
returns uuid language sql security invoker set search_path=''
as $$ select app_private.void_payroll_event_impl(p_tenant_id,p_company_id,p_payroll_event_id,p_reason); $$;

revoke all on function public.update_hr_employee_profile(uuid,uuid,uuid,text,text) from public,anon;
revoke all on function public.change_employee_allocation(uuid,uuid,uuid,date,uuid,numeric) from public,anon;
revoke all on function public.void_payroll_event(uuid,uuid,uuid,text) from public,anon;
revoke all on function app_private.reopen_payroll_impl(uuid,uuid,uuid,text) from public,anon;
revoke all on function app_private.void_payroll_event_impl(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.update_hr_employee_profile(uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.change_employee_allocation(uuid,uuid,uuid,date,uuid,numeric) to authenticated;
grant execute on function public.void_payroll_event(uuid,uuid,uuid,text) to authenticated;
grant execute on function app_private.reopen_payroll_impl(uuid,uuid,uuid,text) to authenticated;
grant execute on function app_private.void_payroll_event_impl(uuid,uuid,uuid,text) to authenticated;

commit;
