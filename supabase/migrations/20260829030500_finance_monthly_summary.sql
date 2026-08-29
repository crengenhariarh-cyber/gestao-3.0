begin;

create function public.get_finance_monthly_summary(
  p_tenant_id uuid,
  p_company_id uuid,
  p_competence_from date,
  p_competence_to date,
  p_category_id uuid default null,
  p_cost_center_id uuid default null,
  p_counterparty text default null,
  p_entry_type text default null,
  p_payment_status text default null,
  p_source_kind text default null
)
returns table (
  competence_month date,
  entry_type text,
  planned_amount numeric,
  realized_amount numeric,
  pending_amount numeric,
  item_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    fmi.competence_month,
    fmi.entry_type,
    coalesce(sum(fmi.planned_amount), 0)::numeric(14,2) as planned_amount,
    coalesce(sum(fmi.realized_amount), 0)::numeric(14,2) as realized_amount,
    coalesce(sum(fmi.pending_amount), 0)::numeric(14,2) as pending_amount,
    count(*) as item_count
  from public.finance_monthly_items fmi
  where fmi.tenant_id = p_tenant_id
    and fmi.company_id = p_company_id
    and fmi.competence_month between p_competence_from and p_competence_to
    and (p_category_id is null or fmi.category_id = p_category_id)
    and (p_cost_center_id is null or fmi.cost_center_id = p_cost_center_id)
    and (nullif(btrim(p_counterparty), '') is null or fmi.counterparty_name ilike '%' || btrim(p_counterparty) || '%')
    and (p_entry_type is null or fmi.entry_type = p_entry_type)
    and (p_payment_status is null or fmi.payment_status = p_payment_status)
    and (p_source_kind is null or fmi.source_kind = p_source_kind)
  group by fmi.competence_month, fmi.entry_type
  order by fmi.competence_month, fmi.entry_type;
$$;

revoke all on function public.get_finance_monthly_summary(uuid, uuid, date, date, uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.get_finance_monthly_summary(uuid, uuid, date, date, uuid, uuid, text, text, text, text) to authenticated;

comment on function public.get_finance_monthly_summary(uuid, uuid, date, date, uuid, uuid, text, text, text, text)
is 'Server-side monetary aggregation for the filtered monthly finance view. Keeps critical sums in PostgreSQL numeric arithmetic.';

commit;
