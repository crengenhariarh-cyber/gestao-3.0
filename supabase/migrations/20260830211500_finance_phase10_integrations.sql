create or replace function public.materialize_due_financial_recurrences(
  p_tenant_id uuid,
  p_company_id uuid,
  p_through_date date default current_date,
  p_max_occurrences integer default 120
)
returns table(rule_id uuid, entry_id uuid, occurrence_date date, next_occurrence_date date)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rule record;
  v_result record;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not app_private.can_manage_company(p_tenant_id, p_company_id) then
    raise exception 'not authorized for company';
  end if;
  if p_through_date is null then
    raise exception 'through date is required';
  end if;
  if p_max_occurrences is null or p_max_occurrences < 1 or p_max_occurrences > 1000 then
    raise exception 'max occurrences must be between 1 and 1000';
  end if;

  for v_rule in
    select r.id
    from public.financial_recurrence_rules r
    where r.tenant_id = p_tenant_id
      and r.company_id = p_company_id
      and r.status = 'active'
      and r.next_occurrence_date <= p_through_date
    order by r.next_occurrence_date, r.id
  loop
    loop
      exit when v_count >= p_max_occurrences;
      exit when not exists (
        select 1 from public.financial_recurrence_rules r
        where r.id = v_rule.id
          and r.tenant_id = p_tenant_id
          and r.company_id = p_company_id
          and r.status = 'active'
          and r.next_occurrence_date <= p_through_date
      );
      select * into v_result
      from public.materialize_next_financial_recurrence(v_rule.id);
      v_count := v_count + 1;
      rule_id := v_rule.id;
      entry_id := v_result.entry_id;
      occurrence_date := v_result.occurrence_date;
      next_occurrence_date := v_result.next_occurrence_date;
      return next;
    end loop;
    exit when v_count >= p_max_occurrences;
  end loop;
end;
$$;

revoke all on function public.materialize_due_financial_recurrences(uuid,uuid,date,integer) from public, anon;
grant execute on function public.materialize_due_financial_recurrences(uuid,uuid,date,integer) to authenticated;

create or replace view public.financial_recurrence_operational
with (security_invoker = true)
as
select
  r.id as rule_id,
  r.tenant_id,
  r.company_id,
  r.entry_type,
  r.description,
  r.counterparty_name,
  r.category_id,
  r.cost_center_id,
  r.amount,
  r.frequency,
  r.interval_count,
  r.day_of_month,
  r.start_date,
  r.end_date,
  r.next_occurrence_date,
  r.status,
  count(o.id)::integer as materialized_occurrences,
  max(o.occurrence_date) as last_materialized_date,
  case
    when r.status <> 'active' then 'inactive'
    when r.end_date is not null and r.next_occurrence_date > r.end_date then 'ended'
    when r.next_occurrence_date < current_date then 'overdue'
    when r.next_occurrence_date = current_date then 'due_today'
    else 'scheduled'
  end as operational_status
from public.financial_recurrence_rules r
left join public.financial_recurrence_occurrences o
  on o.tenant_id = r.tenant_id
 and o.company_id = r.company_id
 and o.recurrence_rule_id = r.id
group by r.id;

grant select on public.financial_recurrence_operational to authenticated;

create index if not exists financial_recurrence_rules_due_idx
  on public.financial_recurrence_rules (tenant_id, company_id, next_occurrence_date)
  where status = 'active';

create index if not exists financial_recurrence_occurrences_rule_date_idx
  on public.financial_recurrence_occurrences (tenant_id, company_id, recurrence_rule_id, occurrence_date);
