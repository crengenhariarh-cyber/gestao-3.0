create or replace function public.record_financial_settlement(
  p_tenant_id uuid,
  p_company_id uuid,
  p_installment_id uuid,
  p_account_id uuid,
  p_settled_on date,
  p_amount numeric,
  p_idempotency_key text,
  p_notes text default null,
  p_settles_in_full boolean default false
)
returns table(settlement_id uuid, settled_amount numeric, installment_amount numeric, settled_total numeric, remaining_amount numeric, financial_status text)
language plpgsql
set search_path to ''
as $$
declare
  v_existing public.financial_settlements%rowtype;
  v_installment_amount numeric(14,2);
  v_settled_total numeric(14,2);
  v_force_paid boolean;
begin
  if p_idempotency_key like 'quick-pix-settlement:%' then
    select fs.* into v_existing
    from public.financial_settlements fs
    where fs.tenant_id = p_tenant_id
      and fs.company_id = p_company_id
      and fs.installment_id = p_installment_id
      and fs.account_id = p_account_id
      and fs.settled_on = p_settled_on
      and fs.amount = p_amount::numeric(14,2)
    order by fs.created_at desc
    limit 1;

    if found then
      select fi.amount,
             coalesce(sum(fs.amount),0)::numeric(14,2),
             coalesce(bool_or(fs.settles_in_full),false)
        into v_installment_amount, v_settled_total, v_force_paid
      from public.financial_installments fi
      left join public.financial_settlements fs
        on fs.tenant_id = fi.tenant_id
       and fs.company_id = fi.company_id
       and fs.installment_id = fi.id
      where fi.tenant_id = p_tenant_id
        and fi.company_id = p_company_id
        and fi.id = p_installment_id
      group by fi.amount;

      if v_force_paid or v_settled_total >= v_installment_amount then
        return query
        select v_existing.id,
               v_existing.amount,
               v_installment_amount,
               v_settled_total,
               0::numeric(14,2),
               'paid'::text;
        return;
      end if;
    end if;
  end if;

  return query
  select * from app_private.record_financial_settlement_impl(
    p_tenant_id,
    p_company_id,
    p_installment_id,
    p_account_id,
    p_settled_on,
    p_amount,
    p_idempotency_key,
    p_notes,
    p_settles_in_full
  );
end;
$$;

revoke all on function public.record_financial_settlement(uuid,uuid,uuid,uuid,date,numeric,text,text,boolean) from public, anon;
grant execute on function public.record_financial_settlement(uuid,uuid,uuid,uuid,date,numeric,text,text,boolean) to authenticated;

comment on function public.record_financial_settlement(uuid,uuid,uuid,uuid,date,numeric,text,text,boolean)
is 'Records a financial settlement. Quick-entry Pix retries that exactly match an already completed settlement are treated idempotently to avoid false launch failures.';
