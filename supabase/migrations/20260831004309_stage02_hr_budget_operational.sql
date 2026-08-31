begin;

create or replace function public.create_hr_employee_bundle(
  p_tenant_id uuid,
  p_company_id uuid,
  p_full_name text,
  p_hired_on date,
  p_job_title text,
  p_base_salary numeric,
  p_cost_center_id uuid default null,
  p_allocation_percent numeric default 100
)
returns table(employee_id uuid, employment_contract_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee_id uuid;
  v_contract_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.is_tenant_admin(p_tenant_id) then raise exception 'tenant admin required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if length(btrim(coalesce(p_full_name,''))) < 2 then raise exception 'employee name is required'; end if;
  if p_hired_on is null then raise exception 'hire date is required'; end if;
  if length(btrim(coalesce(p_job_title,''))) = 0 then raise exception 'job title is required'; end if;
  if p_base_salary is null or p_base_salary < 0 or round(p_base_salary,2) <> p_base_salary then raise exception 'base salary must be non-negative with at most two decimals'; end if;
  if p_allocation_percent is null or p_allocation_percent <= 0 or p_allocation_percent > 100 then raise exception 'allocation percent must be between 0 and 100'; end if;
  if p_cost_center_id is not null and not exists (
    select 1 from public.cost_centers c where c.tenant_id=p_tenant_id and c.company_id=p_company_id and c.id=p_cost_center_id and c.status='active'
  ) then raise exception 'active cost center not found'; end if;

  insert into public.employees(tenant_id,full_name,status)
  values(p_tenant_id,btrim(p_full_name),'active') returning id into v_employee_id;

  insert into public.employment_contracts(tenant_id,company_id,employee_id,hired_on,job_title,status)
  values(p_tenant_id,p_company_id,v_employee_id,p_hired_on,btrim(p_job_title),'active') returning id into v_contract_id;

  insert into public.compensation_terms(tenant_id,company_id,employment_contract_id,valid_from,base_salary)
  values(p_tenant_id,p_company_id,v_contract_id,p_hired_on,p_base_salary);

  if p_cost_center_id is not null then
    insert into public.employee_allocations(tenant_id,company_id,employment_contract_id,cost_center_id,valid_from,allocation_percent)
    values(p_tenant_id,p_company_id,v_contract_id,p_cost_center_id,p_hired_on,p_allocation_percent);
  end if;

  return query select v_employee_id,v_contract_id;
end;
$$;

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
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if p_effective_from is null then raise exception 'effective date is required'; end if;
  if p_base_salary is null or p_base_salary < 0 or round(p_base_salary,2) <> p_base_salary then raise exception 'base salary must be non-negative with at most two decimals'; end if;
  if not exists(select 1 from public.employment_contracts c where c.tenant_id=p_tenant_id and c.company_id=p_company_id and c.id=p_employment_contract_id) then raise exception 'employment contract not found'; end if;

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

create or replace function public.terminate_employment_contract(
  p_tenant_id uuid,
  p_company_id uuid,
  p_employment_contract_id uuid,
  p_terminated_on date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if p_terminated_on is null then raise exception 'termination date is required'; end if;

  update public.employment_contracts
     set terminated_on=p_terminated_on,status='terminated',updated_at=now()
   where tenant_id=p_tenant_id and company_id=p_company_id and id=p_employment_contract_id
     and p_terminated_on >= hired_on;
  if not found then raise exception 'employment contract not found or invalid termination date'; end if;

  update public.compensation_terms set valid_to=p_terminated_on
   where tenant_id=p_tenant_id and company_id=p_company_id and employment_contract_id=p_employment_contract_id
     and (valid_to is null or valid_to > p_terminated_on);
  update public.employee_allocations set valid_to=p_terminated_on
   where tenant_id=p_tenant_id and company_id=p_company_id and employment_contract_id=p_employment_contract_id
     and (valid_to is null or valid_to > p_terminated_on);
  return p_employment_contract_id;
end;
$$;

create or replace function public.upsert_budget_limit(
  p_tenant_id uuid,
  p_company_id uuid,
  p_cost_center_id uuid,
  p_category_id uuid,
  p_competence_month date,
  p_limit_amount numeric,
  p_warning_percent numeric default 80,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if p_competence_month is null or extract(day from p_competence_month)<>1 then raise exception 'competence month must be first day'; end if;
  if p_limit_amount is null or p_limit_amount < 0 or round(p_limit_amount,2)<>p_limit_amount then raise exception 'limit amount must be non-negative with at most two decimals'; end if;
  if p_warning_percent is null or p_warning_percent<0 or p_warning_percent>100 then raise exception 'warning percent must be between 0 and 100'; end if;

  select id into v_id from public.budget_limits
   where tenant_id=p_tenant_id and company_id=p_company_id
     and cost_center_id is not distinct from p_cost_center_id
     and category_id is not distinct from p_category_id
     and competence_month=p_competence_month and status='active'
   for update;
  if v_id is null then
    insert into public.budget_limits(tenant_id,company_id,cost_center_id,category_id,competence_month,limit_amount,warning_percent,notes,status,created_by)
    values(p_tenant_id,p_company_id,p_cost_center_id,p_category_id,p_competence_month,p_limit_amount,p_warning_percent,nullif(btrim(p_notes),''),'active',auth.uid()) returning id into v_id;
  else
    update public.budget_limits set limit_amount=p_limit_amount,warning_percent=p_warning_percent,notes=nullif(btrim(p_notes),''),updated_at=now() where id=v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.create_hr_employee_bundle(uuid,uuid,text,date,text,numeric,uuid,numeric) from public, anon;
revoke all on function public.change_employee_salary(uuid,uuid,uuid,date,numeric) from public, anon;
revoke all on function public.terminate_employment_contract(uuid,uuid,uuid,date) from public, anon;
revoke all on function public.upsert_budget_limit(uuid,uuid,uuid,uuid,date,numeric,numeric,text) from public, anon;
grant execute on function public.create_hr_employee_bundle(uuid,uuid,text,date,text,numeric,uuid,numeric) to authenticated;
grant execute on function public.change_employee_salary(uuid,uuid,uuid,date,numeric) to authenticated;
grant execute on function public.terminate_employment_contract(uuid,uuid,uuid,date) to authenticated;
grant execute on function public.upsert_budget_limit(uuid,uuid,uuid,uuid,date,numeric,numeric,text) to authenticated;

commit;
