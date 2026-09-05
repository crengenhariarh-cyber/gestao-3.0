drop function if exists public.update_card_purchase(uuid,uuid,uuid,date,text,numeric);

create or replace function public.update_card_purchase(
  p_tenant_id uuid,
  p_company_id uuid,
  p_transaction_id uuid,
  p_card_id uuid,
  p_expense_company_id uuid,
  p_purchase_date date,
  p_description text,
  p_counterparty_name text,
  p_category_id uuid,
  p_cost_center_id uuid,
  p_total_amount numeric,
  p_installment_count integer,
  p_notes text
) returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tx public.card_transactions%rowtype;
  v_card public.credit_cards%rowtype;
  v_first date;
  v_total_cents bigint;
  v_base bigint;
  v_rem bigint;
  v_i integer;
  v_cents bigint;
  v_month date;
  v_old_months date[];
  v_old_card_id uuid;
  v_statement public.card_statements%rowtype;
  v_statement_total numeric(14,2);
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'company management permission required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_expense_company_id) then raise exception 'expense company management permission required'; end if;
  if p_purchase_date is null or length(btrim(coalesce(p_description,'')))=0 then raise exception 'date and description are required'; end if;
  if p_total_amount is null or p_total_amount<=0 or round(p_total_amount,2)<>p_total_amount then raise exception 'invalid amount'; end if;
  if p_installment_count is null or p_installment_count<1 or p_installment_count>120 then raise exception 'invalid installment count'; end if;

  select * into v_tx from public.card_transactions where id=p_transaction_id and tenant_id=p_tenant_id and company_id=p_company_id for update;
  if not found then raise exception 'card transaction not found'; end if;
  v_old_card_id:=v_tx.card_id;

  select * into v_card from public.credit_cards where id=p_card_id and tenant_id=p_tenant_id and company_id=p_company_id and status='active';
  if not found then raise exception 'target card not found or inactive'; end if;

  if not exists(select 1 from public.financial_categories where tenant_id=p_tenant_id and company_id=p_expense_company_id and id=p_category_id and status='active') then raise exception 'category not found for expense company'; end if;
  if p_cost_center_id is not null and not exists(select 1 from public.cost_centers where tenant_id=p_tenant_id and company_id=p_expense_company_id and id=p_cost_center_id and status='active') then raise exception 'cost center not found for expense company'; end if;

  select array_agg(distinct statement_month) into v_old_months from public.card_installments where transaction_id=v_tx.id;
  delete from public.card_installments where transaction_id=v_tx.id;

  update public.card_transactions set
    card_id=p_card_id,
    expense_company_id=p_expense_company_id,
    purchase_date=p_purchase_date,
    description=btrim(p_description),
    counterparty_name=nullif(btrim(coalesce(p_counterparty_name,'')),''),
    category_id=p_category_id,
    cost_center_id=p_cost_center_id,
    total_amount=p_total_amount,
    installment_count=p_installment_count,
    notes=nullif(btrim(coalesce(p_notes,'')),'')
  where id=v_tx.id;

  v_first:=date_trunc('month',p_purchase_date)::date;
  if extract(day from p_purchase_date)::integer>v_card.closing_day then v_first:=(v_first+interval '1 month')::date; end if;
  v_total_cents:=round(p_total_amount*100)::bigint;
  v_base:=v_total_cents/p_installment_count;
  v_rem:=v_total_cents%p_installment_count;

  for v_i in 1..p_installment_count loop
    v_cents:=v_base+case when v_i<=v_rem then 1 else 0 end;
    v_month:=(v_first+make_interval(months=>v_i-1))::date;
    insert into public.card_installments(tenant_id,company_id,card_id,transaction_id,installment_number,installment_count,statement_month,amount)
    values(p_tenant_id,p_company_id,p_card_id,v_tx.id,v_i,p_installment_count,v_month,(v_cents::numeric/100)::numeric(14,2));
  end loop;

  for v_statement in
    select * from public.card_statements cs
    where cs.tenant_id=p_tenant_id and cs.company_id=p_company_id
      and ((cs.card_id=v_old_card_id and cs.statement_month=any(coalesce(v_old_months,'{}'::date[])))
        or (cs.card_id=p_card_id and cs.statement_month between v_first and (v_first+make_interval(months=>p_installment_count-1))::date))
    for update
  loop
    select coalesce(sum(ci.amount),0) into v_statement_total from public.card_installments ci
    where ci.tenant_id=p_tenant_id and ci.company_id=p_company_id and ci.card_id=v_statement.card_id and ci.statement_month=v_statement.statement_month;
    if v_statement_total>0 then
      update public.card_statements set statement_amount=v_statement_total where id=v_statement.id;
    elsif exists(select 1 from public.card_statement_payments p where p.statement_id=v_statement.id) then
      raise exception 'cannot remove the last purchase from a statement that already has payments';
    else
      delete from public.card_statements where id=v_statement.id;
    end if;
  end loop;
end
$function$;
