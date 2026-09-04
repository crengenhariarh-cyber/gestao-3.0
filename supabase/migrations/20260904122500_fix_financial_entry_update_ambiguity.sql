create or replace function public.update_unsettled_financial_entry(
  p_tenant_id uuid,
  p_company_id uuid,
  p_entry_id uuid,
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
set search_path=''
as $$
declare
  v_kind text;
  v_total_cents bigint;
  v_base_cents bigint;
  v_remainder bigint;
  v_number integer;
  v_installment_cents bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if p_installment_count is null or p_installment_count < 1 or p_installment_count > 120 then raise exception 'installment count must be between 1 and 120'; end if;
  if p_total_amount is null or p_total_amount <= 0 or round(p_total_amount,2) <> p_total_amount then raise exception 'total amount must be positive with at most two decimal places'; end if;
  if p_initial_competence_month is null or extract(day from p_initial_competence_month) <> 1 then raise exception 'initial competence must be first day of month'; end if;
  if p_first_due_date is null then raise exception 'first due date is required'; end if;
  if length(btrim(coalesce(p_description,''))) = 0 then raise exception 'description is required'; end if;

  perform 1 from public.financial_entries e
   where e.tenant_id=p_tenant_id and e.company_id=p_company_id and e.id=p_entry_id
   for update;
  if not found then raise exception 'financial entry not found'; end if;

  if exists (
    select 1 from public.financial_installments i
    join public.financial_settlements s on s.tenant_id=i.tenant_id and s.company_id=i.company_id and s.installment_id=i.id
    where i.tenant_id=p_tenant_id and i.company_id=p_company_id and i.entry_id=p_entry_id
  ) then raise exception 'settled financial entry cannot be edited'; end if;

  if exists (select 1 from public.payroll_finance_links l where l.tenant_id=p_tenant_id and l.company_id=p_company_id and l.financial_entry_id=p_entry_id)
     or exists (select 1 from public.measurement_finance_links l where l.tenant_id=p_tenant_id and l.company_id=p_company_id and l.financial_entry_id=p_entry_id)
     or exists (select 1 from public.financial_recurrence_occurrences o where o.tenant_id=p_tenant_id and o.company_id=p_company_id and o.entry_id=p_entry_id)
  then raise exception 'linked financial entry cannot be edited manually'; end if;

  select fc.kind into v_kind
  from public.financial_categories fc
  where fc.tenant_id=p_tenant_id and fc.company_id=p_company_id and fc.id=p_category_id and fc.status='active';
  if not found or not (v_kind='both' or v_kind=p_entry_type) then raise exception 'active category is incompatible with financial entry type'; end if;

  if p_cost_center_id is not null and not exists (
    select 1 from public.cost_centers cc
    where cc.tenant_id=p_tenant_id and cc.company_id=p_company_id and cc.id=p_cost_center_id and cc.status='active'
  ) then raise exception 'active cost center not found in company'; end if;

  v_total_cents := round(p_total_amount*100)::bigint;
  if v_total_cents < p_installment_count then raise exception 'total amount is too small for installment count'; end if;
  v_base_cents := v_total_cents / p_installment_count;
  v_remainder := v_total_cents % p_installment_count;

  update public.financial_entries e
     set entry_type=p_entry_type,
         description=btrim(p_description),
         counterparty_name=nullif(btrim(p_counterparty_name),''),
         category_id=p_category_id,
         cost_center_id=p_cost_center_id,
         competence_month=p_initial_competence_month,
         notes=nullif(btrim(p_notes),''),
         updated_at=now()
   where e.tenant_id=p_tenant_id and e.company_id=p_company_id and e.id=p_entry_id;

  delete from public.financial_installments i
   where i.tenant_id=p_tenant_id and i.company_id=p_company_id and i.entry_id=p_entry_id;

  for v_number in 1..p_installment_count loop
    v_installment_cents := v_base_cents + case when v_number <= v_remainder then 1 else 0 end;
    insert into public.financial_installments(
      tenant_id,company_id,entry_id,installment_number,installment_count,due_date,competence_month,amount
    ) values (
      p_tenant_id,p_company_id,p_entry_id,v_number,p_installment_count,
      (p_first_due_date + make_interval(months=>v_number-1))::date,
      (p_initial_competence_month + make_interval(months=>v_number-1))::date,
      (v_installment_cents::numeric/100)::numeric(14,2)
    );
  end loop;

  return query select p_entry_id,p_installment_count;
end;
$$;

revoke all on function public.update_unsettled_financial_entry(uuid,uuid,uuid,text,text,text,uuid,uuid,date,date,numeric,integer,text) from public, anon;
grant execute on function public.update_unsettled_financial_entry(uuid,uuid,uuid,text,text,text,uuid,uuid,date,date,numeric,integer,text) to authenticated;
