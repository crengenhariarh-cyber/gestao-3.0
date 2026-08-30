begin;

create or replace function public.payroll_salary_projection(
  p_tenant_id uuid,
  p_company_id uuid,
  p_from_competence date,
  p_to_competence date
)
returns table(
  competence_month date,
  employment_contract_id uuid,
  employee_id uuid,
  employee_name text,
  cost_center_id uuid,
  allocation_percent numeric,
  planned_salary numeric,
  realized_salary numeric,
  variance_amount numeric,
  projection_status text
)
language sql
security invoker
set search_path = ''
as $$
  with months as (
    select gs::date as competence_month
    from pg_catalog.generate_series(
      date_trunc('month', p_from_competence)::date,
      date_trunc('month', p_to_competence)::date,
      interval '1 month'
    ) gs
    where p_from_competence is not null
      and p_to_competence is not null
      and p_from_competence <= p_to_competence
  ), eligible_contracts as (
    select
      m.competence_month,
      ec.id as employment_contract_id,
      ec.employee_id,
      e.full_name as employee_name
    from months m
    join public.employment_contracts ec
      on ec.tenant_id = p_tenant_id
     and ec.company_id = p_company_id
     and ec.hired_on <= (m.competence_month + interval '1 month - 1 day')::date
     and (ec.terminated_on is null or ec.terminated_on >= m.competence_month)
    join public.employees e
      on e.tenant_id = ec.tenant_id
     and e.id = ec.employee_id
  )
  select
    x.competence_month,
    x.employment_contract_id,
    x.employee_id,
    x.employee_name,
    a.cost_center_id,
    coalesce(a.allocation_percent,100.00)::numeric(5,2) as allocation_percent,
    round(ct.base_salary * coalesce(a.allocation_percent,100.00) / 100.00,2)::numeric(14,2) as planned_salary,
    case when pc.id is null then 0::numeric(14,2)
      else round(pc.gross_snapshot * coalesce(a.allocation_percent,100.00) / 100.00,2)::numeric(14,2)
    end as realized_salary,
    case when pc.id is null then round(ct.base_salary * coalesce(a.allocation_percent,100.00) / 100.00,2)::numeric(14,2)
      else round((ct.base_salary - pc.gross_snapshot) * coalesce(a.allocation_percent,100.00) / 100.00,2)::numeric(14,2)
    end as variance_amount,
    case when pc.id is null then 'planned' else 'closed' end::text as projection_status
  from eligible_contracts x
  join lateral (
    select c.base_salary
    from public.compensation_terms c
    where c.tenant_id = p_tenant_id
      and c.company_id = p_company_id
      and c.employment_contract_id = x.employment_contract_id
      and c.valid_from <= (x.competence_month + interval '1 month - 1 day')::date
      and (c.valid_to is null or c.valid_to >= x.competence_month)
    order by c.valid_from desc
    limit 1
  ) ct on true
  left join lateral (
    select ea.cost_center_id, ea.allocation_percent
    from public.employee_allocations ea
    where ea.tenant_id = p_tenant_id
      and ea.company_id = p_company_id
      and ea.employment_contract_id = x.employment_contract_id
      and ea.valid_from <= (x.competence_month + interval '1 month - 1 day')::date
      and (ea.valid_to is null or ea.valid_to >= x.competence_month)
  ) a on true
  left join public.payroll_closings pc
    on pc.tenant_id = p_tenant_id
   and pc.company_id = p_company_id
   and pc.employment_contract_id = x.employment_contract_id
   and pc.competence_month = x.competence_month
   and pc.status = 'closed'
  order by x.competence_month, x.employee_name, a.cost_center_id;
$$;

revoke all on function public.payroll_salary_projection(uuid,uuid,date,date) from public, anon;
grant execute on function public.payroll_salary_projection(uuid,uuid,date,date) to authenticated;

comment on function public.payroll_salary_projection(uuid,uuid,date,date)
is 'Returns salary planned versus realized by competence, employee and cost center. Planned comes from compensation terms and allocation; realized comes from closed payroll gross snapshot. This is budget projection, not cash flow.';

commit;
