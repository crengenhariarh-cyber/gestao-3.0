alter table public.employee_attendance_daily drop constraint if exists employee_attendance_daily_status_check;
alter table public.employee_attendance_daily add constraint employee_attendance_daily_status_check check (status in ('present','absence','medical_certificate','vacation','day_off','other'));

create or replace function public.transfer_hr_employee_company(
  p_tenant_id uuid,
  p_source_company_id uuid,
  p_target_company_id uuid,
  p_employment_contract_id uuid,
  p_effective_on date,
  p_target_cost_center_id uuid default null,
  p_allocation_percent numeric default 100
) returns table(old_contract_id uuid, new_contract_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_contract public.employment_contracts%rowtype;
  v_new_contract_id uuid;
  v_salary numeric;
  v_old_end date;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.is_tenant_admin(p_tenant_id) then raise exception 'tenant admin required'; end if;
  if p_source_company_id = p_target_company_id then raise exception 'target company must be different'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_source_company_id) then raise exception 'not authorized for source company'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_target_company_id) then raise exception 'not authorized for target company'; end if;
  if p_effective_on is null then raise exception 'effective date is required'; end if;
  if p_allocation_percent <= 0 or p_allocation_percent > 100 then raise exception 'allocation percent must be between 0 and 100'; end if;

  select * into v_contract
  from public.employment_contracts
  where tenant_id=p_tenant_id and company_id=p_source_company_id and id=p_employment_contract_id and status='active'
  for update;
  if not found then raise exception 'active employment contract not found'; end if;
  if p_effective_on <= v_contract.hired_on then raise exception 'effective date must be after current hire date'; end if;

  if p_target_cost_center_id is not null and not exists (
    select 1 from public.cost_centers c
    where c.tenant_id=p_tenant_id and c.company_id=p_target_company_id and c.id=p_target_cost_center_id and c.status='active'
  ) then raise exception 'active target cost center not found'; end if;

  select ct.base_salary into v_salary
  from public.compensation_terms ct
  where ct.tenant_id=p_tenant_id and ct.company_id=p_source_company_id and ct.employment_contract_id=p_employment_contract_id
    and ct.valid_from <= p_effective_on
    and (ct.valid_to is null or ct.valid_to >= p_effective_on)
  order by ct.valid_from desc limit 1;
  v_salary := coalesce(v_salary,0);
  v_old_end := p_effective_on - 1;

  update public.employment_contracts set status='terminated',terminated_on=v_old_end,updated_at=now()
  where tenant_id=p_tenant_id and company_id=p_source_company_id and id=p_employment_contract_id;
  update public.compensation_terms set valid_to=v_old_end
  where tenant_id=p_tenant_id and company_id=p_source_company_id and employment_contract_id=p_employment_contract_id
    and valid_from<=v_old_end and (valid_to is null or valid_to>v_old_end);
  update public.employee_allocations set valid_to=v_old_end
  where tenant_id=p_tenant_id and company_id=p_source_company_id and employment_contract_id=p_employment_contract_id
    and valid_from<=v_old_end and (valid_to is null or valid_to>v_old_end);

  insert into public.employment_contracts(tenant_id,company_id,employee_id,hired_on,job_title,status,employment_type,sector,supervisor,weekly_hours,bank_hours_enabled)
  values(p_tenant_id,p_target_company_id,v_contract.employee_id,p_effective_on,v_contract.job_title,'active',v_contract.employment_type,v_contract.sector,v_contract.supervisor,v_contract.weekly_hours,v_contract.bank_hours_enabled)
  returning id into v_new_contract_id;
  insert into public.compensation_terms(tenant_id,company_id,employment_contract_id,valid_from,base_salary)
  values(p_tenant_id,p_target_company_id,v_new_contract_id,p_effective_on,v_salary);
  if p_target_cost_center_id is not null then
    insert into public.employee_allocations(tenant_id,company_id,employment_contract_id,cost_center_id,valid_from,allocation_percent)
    values(p_tenant_id,p_target_company_id,v_new_contract_id,p_target_cost_center_id,p_effective_on,p_allocation_percent);
  end if;
  return query select p_employment_contract_id,v_new_contract_id;
end;
$function$;

grant execute on function public.transfer_hr_employee_company(uuid,uuid,uuid,uuid,date,uuid,numeric) to authenticated;
