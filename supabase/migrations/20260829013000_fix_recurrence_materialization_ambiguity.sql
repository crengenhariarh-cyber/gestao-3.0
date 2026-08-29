begin;

create or replace function public.materialize_next_financial_recurrence(
  p_rule_id uuid
)
returns table(entry_id uuid, occurrence_date date, next_occurrence_date date)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rule public.financial_recurrence_rules%rowtype;
  v_entry_id uuid;
  v_installment_id uuid;
  v_occurrence_date date;
  v_competence date;
  v_next date;
begin
  select * into v_rule
  from public.financial_recurrence_rules
  where id = p_rule_id
  for update;

  if not found then raise exception 'recurrence rule not found'; end if;
  if not app_private.can_manage_company(v_rule.tenant_id, v_rule.company_id) then raise exception 'not authorized for company'; end if;
  if v_rule.status <> 'active' then raise exception 'recurrence rule is inactive'; end if;

  v_occurrence_date := v_rule.next_occurrence_date;
  if v_rule.end_date is not null and v_occurrence_date > v_rule.end_date then
    raise exception 'recurrence rule has ended';
  end if;

  if exists (
    select 1
    from public.financial_recurrence_occurrences fro
    where fro.recurrence_rule_id = v_rule.id
      and fro.occurrence_date = v_occurrence_date
  ) then
    raise exception 'recurrence occurrence already materialized';
  end if;

  v_competence := date_trunc('month', v_occurrence_date)::date;

  select r.entry_id, r.installment_id
  into v_entry_id, v_installment_id
  from public.create_single_financial_entry(
    v_rule.tenant_id,
    v_rule.company_id,
    v_rule.entry_type,
    v_rule.description,
    v_rule.counterparty_name,
    v_rule.category_id,
    v_rule.cost_center_id,
    v_competence,
    v_occurrence_date,
    v_rule.amount,
    v_rule.notes
  ) r;

  insert into public.financial_recurrence_occurrences (
    tenant_id, company_id, recurrence_rule_id, occurrence_date, entry_id
  ) values (
    v_rule.tenant_id, v_rule.company_id, v_rule.id, v_occurrence_date, v_entry_id
  );

  v_next := app_private.month_date_clamped(v_occurrence_date, v_rule.interval_count, v_rule.day_of_month);

  update public.financial_recurrence_rules
  set
    next_occurrence_date = v_next,
    status = case when end_date is not null and v_next > end_date then 'inactive' else status end
  where id = v_rule.id;

  return query select v_entry_id, v_occurrence_date, v_next;
end;
$$;

commit;
