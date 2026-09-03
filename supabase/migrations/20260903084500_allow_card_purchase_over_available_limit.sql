begin;

-- The available limit remains an informational/audit value.
-- Real card authorization happens outside Gestão, so an imported or stale
-- calculated balance must not block a purchase that was actually authorized.
create or replace function app_private.create_card_purchase_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_card_id uuid,
  p_purchase_date date,
  p_description text,
  p_counterparty_name text,
  p_category_id uuid,
  p_cost_center_id uuid,
  p_total_amount numeric,
  p_installment_count integer,
  p_idempotency_key text,
  p_notes text default null
)
returns table(transaction_id uuid, first_statement_month date, committed_amount numeric, available_limit numeric)
language plpgsql security definer set search_path=''
as $$
declare
  v_card public.credit_cards%rowtype; v_existing public.card_transactions%rowtype;
  v_transaction_id uuid; v_first_statement date; v_total_cents bigint; v_base_cents bigint;
  v_remainder bigint; v_i integer; v_installment_cents bigint; v_committed numeric(14,2);
  v_available numeric(14,2); v_category_ok boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'company management permission required'; end if;
  if p_purchase_date is null then raise exception 'purchase date is required'; end if;
  if length(btrim(coalesce(p_description,'')))=0 then raise exception 'description is required'; end if;
  if p_total_amount is null or p_total_amount<=0 then raise exception 'total amount must be greater than zero'; end if;
  if round(p_total_amount,2)<>p_total_amount then raise exception 'total amount supports at most two decimal places'; end if;
  if p_installment_count is null or p_installment_count<1 or p_installment_count>120 then raise exception 'installment count must be between 1 and 120'; end if;
  if length(btrim(coalesce(p_idempotency_key,'')))=0 then raise exception 'idempotency key is required'; end if;
  select * into v_existing from public.card_transactions ct where ct.tenant_id=p_tenant_id and ct.company_id=p_company_id and ct.idempotency_key=btrim(p_idempotency_key);
  if found then
    if v_existing.card_id<>p_card_id or v_existing.purchase_date<>p_purchase_date or v_existing.total_amount<>p_total_amount or v_existing.installment_count<>p_installment_count then raise exception 'idempotency key already used with different card purchase data'; end if;
    select min(ci.statement_month) into v_first_statement from public.card_installments ci where ci.transaction_id=v_existing.id;
    select ccl.committed_amount,ccl.available_limit into v_committed,v_available from public.credit_card_limits ccl where ccl.card_id=p_card_id;
    return query select v_existing.id,v_first_statement,v_committed,v_available; return;
  end if;
  select * into v_card from public.credit_cards cc where cc.tenant_id=p_tenant_id and cc.company_id=p_company_id and cc.id=p_card_id and cc.status='active' for update;
  if not found then raise exception 'active credit card not found in company'; end if;
  select exists(select 1 from public.financial_categories fc where fc.tenant_id=p_tenant_id and fc.company_id=p_company_id and fc.id=p_category_id and fc.status='active' and fc.kind in ('expense','both')) into v_category_ok;
  if not v_category_ok then raise exception 'active expense-compatible category not found in company'; end if;
  if p_cost_center_id is not null and not exists(select 1 from public.cost_centers c where c.tenant_id=p_tenant_id and c.company_id=p_company_id and c.id=p_cost_center_id and c.status='active') then raise exception 'active cost center not found in company'; end if;
  v_total_cents:=round(p_total_amount*100)::bigint;
  if v_total_cents<p_installment_count then raise exception 'total amount is too small for the installment count'; end if;
  select ccl.committed_amount,ccl.available_limit into v_committed,v_available from public.credit_card_limits ccl where ccl.card_id=p_card_id;
  v_first_statement:=date_trunc('month',p_purchase_date)::date;
  if extract(day from p_purchase_date)::integer>v_card.closing_day then v_first_statement:=(v_first_statement+interval '1 month')::date; end if;
  insert into public.card_transactions(tenant_id,company_id,card_id,purchase_date,description,counterparty_name,category_id,cost_center_id,total_amount,installment_count,idempotency_key,notes,created_by)
  values(p_tenant_id,p_company_id,p_card_id,p_purchase_date,btrim(p_description),nullif(btrim(p_counterparty_name),''),p_category_id,p_cost_center_id,p_total_amount,p_installment_count,btrim(p_idempotency_key),nullif(btrim(p_notes),''),auth.uid()) returning id into v_transaction_id;
  v_base_cents:=v_total_cents/p_installment_count; v_remainder:=v_total_cents%p_installment_count;
  for v_i in 1..p_installment_count loop
    v_installment_cents:=v_base_cents+case when v_i<=v_remainder then 1 else 0 end;
    insert into public.card_installments(tenant_id,company_id,card_id,transaction_id,installment_number,installment_count,statement_month,amount)
    values(p_tenant_id,p_company_id,p_card_id,v_transaction_id,v_i,p_installment_count,(v_first_statement+make_interval(months=>v_i-1))::date,(v_installment_cents::numeric/100)::numeric(14,2));
  end loop;
  insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(p_tenant_id,p_company_id,auth.uid(),'card_purchase.created','card_transaction',v_transaction_id,jsonb_build_object('card_id',p_card_id,'purchase_date',p_purchase_date,'total_amount',p_total_amount,'installment_count',p_installment_count,'first_statement_month',v_first_statement,'idempotency_key',btrim(p_idempotency_key),'available_limit_before',v_available,'over_calculated_limit',p_total_amount>coalesce(v_available,0)));
  select ccl.committed_amount,ccl.available_limit into v_committed,v_available from public.credit_card_limits ccl where ccl.card_id=p_card_id;
  return query select v_transaction_id,v_first_statement,v_committed,v_available;
end; $$;

-- Cross-company card purchases follow the same rule.
-- Remove only the calculated-limit rejection from the current implementation.
-- Recreate from the existing function definition through pg_get_functiondef so
-- all current validation, permissions and installment behavior remain intact.
do $$
declare v_def text;
begin
  select pg_get_functiondef('app_private.create_card_purchase_cross_company_impl(uuid,uuid,uuid,uuid,date,text,text,uuid,uuid,numeric,integer,text,text)'::regprocedure) into v_def;
  v_def:=replace(v_def, 'if p_total_amount > v_available then raise exception ''card purchase exceeds available limit''; end if;', '-- calculated available limit is informational; do not block an externally authorized purchase');
  execute v_def;
end $$;

commit;
