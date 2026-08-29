begin;

create or replace function public.create_single_financial_entry(
  p_tenant_id uuid,
  p_company_id uuid,
  p_entry_type text,
  p_description text,
  p_counterparty_name text,
  p_category_id uuid,
  p_cost_center_id uuid,
  p_competence_month date,
  p_due_date date,
  p_amount numeric,
  p_notes text
)
returns table(entry_id uuid, installment_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry_id uuid;
  v_installment_id uuid;
  v_category_kind text;
begin
  if p_entry_type not in ('income', 'expense') then
    raise exception 'invalid financial entry type';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be greater than zero';
  end if;

  select fc.kind
  into v_category_kind
  from public.financial_categories fc
  where fc.tenant_id = p_tenant_id
    and fc.company_id = p_company_id
    and fc.id = p_category_id
    and fc.status = 'active';

  if v_category_kind is null then
    raise exception 'financial category is not available in this company';
  end if;

  if v_category_kind <> 'both' and v_category_kind <> p_entry_type then
    raise exception 'financial category is incompatible with entry type';
  end if;

  insert into public.financial_entries (
    tenant_id, company_id, entry_type, description, counterparty_name,
    category_id, cost_center_id, competence_month, notes
  ) values (
    p_tenant_id, p_company_id, p_entry_type, btrim(p_description), nullif(btrim(p_counterparty_name), ''),
    p_category_id, p_cost_center_id, p_competence_month, nullif(btrim(p_notes), '')
  )
  returning id into v_entry_id;

  insert into public.financial_installments (
    tenant_id, company_id, entry_id, installment_number, installment_count, due_date, amount
  ) values (
    p_tenant_id, p_company_id, v_entry_id, 1, 1, p_due_date, p_amount
  )
  returning id into v_installment_id;

  return query select v_entry_id, v_installment_id;
end;
$$;

revoke all on function public.create_single_financial_entry(uuid, uuid, text, text, text, uuid, uuid, date, date, numeric, text) from public, anon;
grant execute on function public.create_single_financial_entry(uuid, uuid, text, text, text, uuid, uuid, date, date, numeric, text) to authenticated;

comment on function public.create_single_financial_entry(uuid, uuid, text, text, text, uuid, uuid, date, date, numeric, text)
is 'Atomically creates a financial entry and its mandatory 1/1 installment using invoker RLS.';

commit;
