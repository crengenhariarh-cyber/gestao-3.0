begin;

alter table public.employees
  add column if not exists cpf text,
  add column if not exists pix text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists notes text;

alter table public.employment_contracts
  add column if not exists employment_type text not null default 'clt',
  add column if not exists sector text,
  add column if not exists supervisor text,
  add column if not exists weekly_hours numeric(5,2) not null default 44,
  add column if not exists bank_hours_enabled boolean not null default false;

alter table public.employment_contracts drop constraint if exists employment_contracts_employment_type_ck;
alter table public.employment_contracts add constraint employment_contracts_employment_type_ck
  check (employment_type in ('clt','pj','autonomo','temporario','estagio','prestador','outro'));

alter table public.employment_contracts drop constraint if exists employment_contracts_weekly_hours_ck;
alter table public.employment_contracts add constraint employment_contracts_weekly_hours_ck
  check (weekly_hours > 0 and weekly_hours <= 60);

create or replace function public.create_hr_employee_bundle(
  p_tenant_id uuid,
  p_company_id uuid,
  p_full_name text,
  p_hired_on date,
  p_job_title text,
  p_base_salary numeric,
  p_cost_center_id uuid default null,
  p_allocation_percent numeric default 100,
  p_cpf text default null,
  p_pix text default null,
  p_phone text default null,
  p_email text default null,
  p_notes text default null,
  p_employment_type text default 'clt',
  p_sector text default null,
  p_supervisor text default null,
  p_weekly_hours numeric default 44,
  p_bank_hours_enabled boolean default false
)
returns table(employee_id uuid, employment_contract_id uuid)
language plpgsql
set search_path to ''
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
  if p_employment_type not in ('clt','pj','autonomo','temporario','estagio','prestador','outro') then raise exception 'invalid employment type'; end if;
  if p_weekly_hours is null or p_weekly_hours <= 0 or p_weekly_hours > 60 then raise exception 'weekly hours must be between 0 and 60'; end if;
  if p_cost_center_id is not null and not exists (
    select 1 from public.cost_centers c where c.tenant_id=p_tenant_id and c.company_id=p_company_id and c.id=p_cost_center_id and c.status='active'
  ) then raise exception 'active cost center not found'; end if;

  insert into public.employees(tenant_id,full_name,status,cpf,pix,phone,email,notes)
  values(p_tenant_id,btrim(p_full_name),'active',nullif(btrim(coalesce(p_cpf,'')),''),nullif(btrim(coalesce(p_pix,'')),''),nullif(btrim(coalesce(p_phone,'')),''),nullif(btrim(coalesce(p_email,'')),''),nullif(btrim(coalesce(p_notes,'')),'')) returning id into v_employee_id;

  insert into public.employment_contracts(tenant_id,company_id,employee_id,hired_on,job_title,status,employment_type,sector,supervisor,weekly_hours,bank_hours_enabled)
  values(p_tenant_id,p_company_id,v_employee_id,p_hired_on,btrim(p_job_title),'active',p_employment_type,nullif(btrim(coalesce(p_sector,'')),''),nullif(btrim(coalesce(p_supervisor,'')),''),p_weekly_hours,p_bank_hours_enabled) returning id into v_contract_id;

  insert into public.compensation_terms(tenant_id,company_id,employment_contract_id,valid_from,base_salary)
  values(p_tenant_id,p_company_id,v_contract_id,p_hired_on,p_base_salary);

  if p_cost_center_id is not null then
    insert into public.employee_allocations(tenant_id,company_id,employment_contract_id,cost_center_id,valid_from,allocation_percent)
    values(p_tenant_id,p_company_id,v_contract_id,p_cost_center_id,p_hired_on,p_allocation_percent);
  end if;

  return query select v_employee_id,v_contract_id;
end;
$$;

create or replace function public.update_hr_employee_profile(
  p_tenant_id uuid,
  p_company_id uuid,
  p_employment_contract_id uuid,
  p_full_name text,
  p_job_title text,
  p_cpf text default null,
  p_pix text default null,
  p_phone text default null,
  p_email text default null,
  p_notes text default null,
  p_employment_type text default 'clt',
  p_sector text default null,
  p_supervisor text default null,
  p_weekly_hours numeric default 44,
  p_bank_hours_enabled boolean default false
)
returns uuid
language plpgsql
set search_path to ''
as $$
declare v_employee_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.is_tenant_admin(p_tenant_id) then raise exception 'tenant admin required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if length(btrim(coalesce(p_full_name,''))) < 2 then raise exception 'employee name is required'; end if;
  if length(btrim(coalesce(p_job_title,''))) = 0 then raise exception 'job title is required'; end if;
  if p_employment_type not in ('clt','pj','autonomo','temporario','estagio','prestador','outro') then raise exception 'invalid employment type'; end if;
  if p_weekly_hours is null or p_weekly_hours <= 0 or p_weekly_hours > 60 then raise exception 'weekly hours must be between 0 and 60'; end if;

  select employee_id into v_employee_id
    from public.employment_contracts
   where tenant_id=p_tenant_id and company_id=p_company_id and id=p_employment_contract_id;
  if not found then raise exception 'employment contract not found'; end if;

  update public.employees set
    full_name=btrim(p_full_name),
    cpf=nullif(btrim(coalesce(p_cpf,'')),''),
    pix=nullif(btrim(coalesce(p_pix,'')),''),
    phone=nullif(btrim(coalesce(p_phone,'')),''),
    email=nullif(btrim(coalesce(p_email,'')),''),
    notes=nullif(btrim(coalesce(p_notes,'')),''),
    updated_at=now()
   where tenant_id=p_tenant_id and id=v_employee_id;

  update public.employment_contracts set
    job_title=btrim(p_job_title),
    employment_type=p_employment_type,
    sector=nullif(btrim(coalesce(p_sector,'')),''),
    supervisor=nullif(btrim(coalesce(p_supervisor,'')),''),
    weekly_hours=p_weekly_hours,
    bank_hours_enabled=p_bank_hours_enabled,
    updated_at=now()
   where tenant_id=p_tenant_id and company_id=p_company_id and id=p_employment_contract_id;
  return p_employment_contract_id;
end;
$$;

commit;
