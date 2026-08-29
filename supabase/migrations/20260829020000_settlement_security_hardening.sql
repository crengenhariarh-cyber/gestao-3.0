begin;

alter function public.record_financial_settlement(uuid, uuid, uuid, uuid, date, numeric, text, text)
  set schema app_private;

alter function app_private.record_financial_settlement(uuid, uuid, uuid, uuid, date, numeric, text, text)
  rename to record_financial_settlement_impl;

revoke all on function app_private.record_financial_settlement_impl(uuid, uuid, uuid, uuid, date, numeric, text, text) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.record_financial_settlement_impl(uuid, uuid, uuid, uuid, date, numeric, text, text) to authenticated;

create function public.record_financial_settlement(
  p_tenant_id uuid,
  p_company_id uuid,
  p_installment_id uuid,
  p_account_id uuid,
  p_settled_on date,
  p_amount numeric,
  p_idempotency_key text,
  p_notes text default null
)
returns table(
  settlement_id uuid,
  settled_amount numeric,
  installment_amount numeric,
  settled_total numeric,
  remaining_amount numeric,
  financial_status text
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from app_private.record_financial_settlement_impl(
    p_tenant_id,
    p_company_id,
    p_installment_id,
    p_account_id,
    p_settled_on,
    p_amount,
    p_idempotency_key,
    p_notes
  );
$$;

revoke all on function public.record_financial_settlement(uuid, uuid, uuid, uuid, date, numeric, text, text) from public, anon;
grant execute on function public.record_financial_settlement(uuid, uuid, uuid, uuid, date, numeric, text, text) to authenticated;

comment on function public.record_financial_settlement(uuid, uuid, uuid, uuid, date, numeric, text, text)
is 'Public SECURITY INVOKER wrapper for the private settlement implementation.';

commit;
