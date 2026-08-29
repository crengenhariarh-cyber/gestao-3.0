begin;

create table public.financial_recurrence_occurrences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  recurrence_rule_id uuid not null,
  occurrence_date date not null,
  entry_id uuid not null,
  created_at timestamptz not null default now(),
  constraint financial_recurrence_occurrences_rule_fk
    foreign key (tenant_id, company_id, recurrence_rule_id)
    references public.financial_recurrence_rules (tenant_id, company_id, id)
    on delete restrict,
  constraint financial_recurrence_occurrences_entry_fk
    foreign key (tenant_id, company_id, entry_id)
    references public.financial_entries (tenant_id, company_id, id)
    on delete restrict,
  unique (recurrence_rule_id, occurrence_date)
);

create index financial_recurrence_occurrences_company_date_idx
  on public.financial_recurrence_occurrences (tenant_id, company_id, occurrence_date);

alter table public.financial_recurrence_occurrences enable row level security;

create policy financial_recurrence_occurrences_select_authorized
on public.financial_recurrence_occurrences
for select
to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create function app_private.add_months_clamped(source_date date, months_to_add integer)
returns date
language sql
immutable
set search_path = ''
as $$
  with target as (
    select
      (date_trunc('month', source_date) + make_interval(months => months_to_add))::date as first_day,
      extract(day from source_date)::integer as wanted_day
  )
  select (
    first_day
    + (
        least(
          wanted_day,
          extract(day from ((first_day + interval '1 month') - interval '1 day'))::integer
        ) - 1
      )
  )::date
  from target;
$$;

revoke all on function app_private.add_months_clamped(date, integer) from public;
grant execute on function app_private.add_months_clamped(date, integer) to authenticated;

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
    select 1 from public.financial_recurrence_occurrences
    where recurrence_rule_id = v_rule.id and occurrence_date = v_occurrence_date
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

  v_next := app_private.add_months_clamped(v_occurrence_date, v_rule.interval_count);

  update public.financial_recurrence_rules
  set
    next_occurrence_date = v_next,
    status = case when end_date is not null and v_next > end_date then 'inactive' else status end
  where id = v_rule.id;

  return query select v_entry_id, v_occurrence_date, v_next;
end;
$$;

revoke all on function public.materialize_next_financial_recurrence(uuid) from public;
grant execute on function public.materialize_next_financial_recurrence(uuid) to authenticated;

comment on table public.financial_recurrence_occurrences is 'Immutable link between a recurrence rule/date and the independent financial entry generated for that occurrence.';

commit;
