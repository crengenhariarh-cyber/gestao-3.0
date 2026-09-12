begin;

create or replace function public.sync_salary_budget_from_hr(
  p_tenant_id uuid,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category_id uuid;
  v_rows integer;
  r record;
begin
  select fc.id
    into v_category_id
  from public.financial_categories fc
  where fc.tenant_id = p_tenant_id
    and fc.company_id = p_company_id
    and fc.status = 'active'
    and upper(btrim(fc.name)) = 'PAGAMENTO DE SALÁRIO'
  order by fc.created_at
  limit 1;

  if v_category_id is null then
    return;
  end if;

  -- Zera o planejamento salarial futuro antes de recalcular com base no RH.
  update public.budget_plans bp
     set planned_amount = 0,
         notes = 'Sincronizado automaticamente com os salários vigentes no RH.',
         updated_at = now()
   where bp.tenant_id = p_tenant_id
     and bp.company_id = p_company_id
     and bp.category_id = v_category_id
     and bp.flow_type = 'expense'
     and bp.source_kind = 'manual'
     and bp.competence_month >= date_trunc('month', current_date)::date;

  update public.budget_limits bl
     set limit_amount = 0,
         notes = 'Sincronizado automaticamente com os salários vigentes no RH.',
         updated_at = now()
   where bl.tenant_id = p_tenant_id
     and bl.company_id = p_company_id
     and bl.category_id = v_category_id
     and bl.status = 'active'
     and bl.competence_month >= date_trunc('month', current_date)::date;

  for r in
    select bsp.cost_center_id,
           bsp.competence_month,
           bsp.projected_salary
    from public.budget_salary_projection bsp
    where bsp.tenant_id = p_tenant_id
      and bsp.company_id = p_company_id
  loop
    update public.budget_plans bp
       set planned_amount = r.projected_salary,
           notes = 'Sincronizado automaticamente com os salários vigentes no RH.',
           updated_at = now()
     where bp.tenant_id = p_tenant_id
       and bp.company_id = p_company_id
       and bp.category_id = v_category_id
       and bp.cost_center_id is not distinct from r.cost_center_id
       and bp.competence_month = r.competence_month
       and bp.flow_type = 'expense'
       and bp.source_kind = 'manual';

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      insert into public.budget_plans(
        tenant_id, company_id, cost_center_id, category_id, competence_month,
        planned_amount, source_kind, notes, flow_type
      ) values (
        p_tenant_id, p_company_id, r.cost_center_id, v_category_id, r.competence_month,
        r.projected_salary, 'manual', 'Sincronizado automaticamente com os salários vigentes no RH.', 'expense'
      );
    end if;

    update public.budget_limits bl
       set limit_amount = r.projected_salary,
           notes = 'Sincronizado automaticamente com os salários vigentes no RH.',
           updated_at = now()
     where bl.tenant_id = p_tenant_id
       and bl.company_id = p_company_id
       and bl.category_id = v_category_id
       and bl.cost_center_id is not distinct from r.cost_center_id
       and bl.competence_month = r.competence_month
       and bl.status = 'active';

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      insert into public.budget_limits(
        tenant_id, company_id, cost_center_id, category_id, competence_month,
        limit_amount, warning_percent, notes, status
      ) values (
        p_tenant_id, p_company_id, r.cost_center_id, v_category_id, r.competence_month,
        r.projected_salary, 80, 'Sincronizado automaticamente com os salários vigentes no RH.', 'active'
      );
    end if;
  end loop;
end;
$$;

create or replace function public.trg_sync_salary_budget_from_hr()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_tenant uuid;
  v_new_company uuid;
  v_old_tenant uuid;
  v_old_company uuid;
begin
  if tg_op <> 'DELETE' then
    v_new_tenant := new.tenant_id;
    v_new_company := new.company_id;
    perform public.sync_salary_budget_from_hr(v_new_tenant, v_new_company);
  end if;

  if tg_op <> 'INSERT' then
    v_old_tenant := old.tenant_id;
    v_old_company := old.company_id;
    if tg_op = 'DELETE'
       or v_old_tenant is distinct from v_new_tenant
       or v_old_company is distinct from v_new_company then
      perform public.sync_salary_budget_from_hr(v_old_tenant, v_old_company);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_salary_budget_from_hr(uuid, uuid) from public, anon, authenticated;
revoke all on function public.trg_sync_salary_budget_from_hr() from public, anon, authenticated;

drop trigger if exists sync_salary_budget_compensation_terms on public.compensation_terms;
create trigger sync_salary_budget_compensation_terms
after insert or update or delete on public.compensation_terms
for each row execute function public.trg_sync_salary_budget_from_hr();

drop trigger if exists sync_salary_budget_employment_contracts on public.employment_contracts;
create trigger sync_salary_budget_employment_contracts
after insert or update or delete on public.employment_contracts
for each row execute function public.trg_sync_salary_budget_from_hr();

drop trigger if exists sync_salary_budget_employee_allocations on public.employee_allocations;
create trigger sync_salary_budget_employee_allocations
after insert or update or delete on public.employee_allocations
for each row execute function public.trg_sync_salary_budget_from_hr();

-- Sincroniza imediatamente as empresas já existentes.
do $$
declare
  c record;
begin
  for c in
    select distinct ec.tenant_id, ec.company_id
    from public.employment_contracts ec
  loop
    perform public.sync_salary_budget_from_hr(c.tenant_id, c.company_id);
  end loop;
end;
$$;

commit;
