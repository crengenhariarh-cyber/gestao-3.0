begin;

alter table public.card_transactions
  add column if not exists expense_company_id uuid;

update public.card_transactions
set expense_company_id = company_id
where expense_company_id is null;

alter table public.card_transactions
  alter column expense_company_id set not null;

alter table public.card_transactions
  drop constraint if exists card_transactions_expense_company_fk;
alter table public.card_transactions
  add constraint card_transactions_expense_company_fk
  foreign key (tenant_id, expense_company_id)
  references public.companies (tenant_id, id)
  on delete restrict;

alter table public.card_transactions
  drop constraint if exists card_transactions_category_fk;
alter table public.card_transactions
  add constraint card_transactions_category_fk
  foreign key (tenant_id, expense_company_id, category_id)
  references public.financial_categories (tenant_id, company_id, id)
  on delete restrict;

alter table public.card_transactions
  drop constraint if exists card_transactions_cost_center_fk;
alter table public.card_transactions
  add constraint card_transactions_cost_center_fk
  foreign key (tenant_id, expense_company_id, cost_center_id)
  references public.cost_centers (tenant_id, company_id, id)
  on delete restrict;

create or replace function app_private.create_card_purchase_cross_company_impl(
  p_tenant_id uuid,
  p_card_company_id uuid,
  p_expense_company_id uuid,
  p_card_id uuid,
  p_purchase_date date,
  p_description text,
  p_counterparty_name text,
  p_category_id uuid,
  p_cost_center_id uuid,
  p_total_amount numeric,
  p_installment_count integer,
  p_idempotency_key text,
  p_notes text
)
returns table(transaction_id uuid, first_statement_month date, committed_amount numeric, available_limit numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.credit_cards%rowtype;
  v_existing public.card_transactions%rowtype;
  v_transaction_id uuid;
  v_first_statement date;
  v_total_cents bigint;
  v_base_cents bigint;
  v_remainder bigint;
  v_i integer;
  v_installment_cents bigint;
  v_committed numeric(14,2);
  v_available numeric(14,2);
  v_category_ok boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id, p_card_company_id) then raise exception 'card company management permission required'; end if;
  if not app_private.can_manage_company(p_tenant_id, p_expense_company_id) then raise exception 'expense company management permission required'; end if;
  if p_purchase_date is null then raise exception 'purchase date is required'; end if;
  if length(btrim(coalesce(p_description, ''))) = 0 then raise exception 'description is required'; end if;
  if p_total_amount is null or p_total_amount <= 0 then raise exception 'total amount must be greater than zero'; end if;
  if round(p_total_amount, 2) <> p_total_amount then raise exception 'total amount supports at most two decimal places'; end if;
  if p_installment_count is null or p_installment_count < 1 or p_installment_count > 120 then raise exception 'installment count must be between 1 and 120'; end if;
  if length(btrim(coalesce(p_idempotency_key, ''))) = 0 then raise exception 'idempotency key is required'; end if;

  select * into v_existing
  from public.card_transactions ct
  where ct.tenant_id = p_tenant_id
    and ct.company_id = p_card_company_id
    and ct.idempotency_key = btrim(p_idempotency_key);

  if found then
    if v_existing.card_id <> p_card_id
      or v_existing.expense_company_id <> p_expense_company_id
      or v_existing.purchase_date <> p_purchase_date
      or v_existing.total_amount <> p_total_amount
      or v_existing.installment_count <> p_installment_count then
      raise exception 'idempotency key already used with different card purchase data';
    end if;
    select min(ci.statement_month) into v_first_statement from public.card_installments ci where ci.transaction_id = v_existing.id;
    select ccl.committed_amount, ccl.available_limit into v_committed, v_available from public.credit_card_limits ccl where ccl.card_id = p_card_id;
    return query select v_existing.id, v_first_statement, v_committed, v_available;
    return;
  end if;

  select * into v_card
  from public.credit_cards cc
  where cc.tenant_id = p_tenant_id
    and cc.company_id = p_card_company_id
    and cc.id = p_card_id
    and cc.status = 'active'
  for update;
  if not found then raise exception 'active credit card not found in card company'; end if;

  select exists (
    select 1 from public.financial_categories fc
    where fc.tenant_id = p_tenant_id
      and fc.company_id = p_expense_company_id
      and fc.id = p_category_id
      and fc.status = 'active'
      and fc.kind in ('expense', 'both')
  ) into v_category_ok;
  if not v_category_ok then raise exception 'active expense-compatible category not found in expense company'; end if;

  if p_cost_center_id is not null and not exists (
    select 1 from public.cost_centers c
    where c.tenant_id = p_tenant_id
      and c.company_id = p_expense_company_id
      and c.id = p_cost_center_id
      and c.status = 'active'
  ) then raise exception 'active cost center not found in expense company'; end if;

  v_total_cents := round(p_total_amount * 100)::bigint;
  if v_total_cents < p_installment_count then raise exception 'total amount is too small for the installment count'; end if;

  select ccl.committed_amount, ccl.available_limit into v_committed, v_available from public.credit_card_limits ccl where ccl.card_id = p_card_id;
  if p_total_amount > v_available then raise exception 'card purchase exceeds available limit'; end if;

  v_first_statement := date_trunc('month', p_purchase_date)::date;
  if extract(day from p_purchase_date)::integer > v_card.closing_day then
    v_first_statement := (v_first_statement + interval '1 month')::date;
  end if;

  insert into public.card_transactions (
    tenant_id, company_id, expense_company_id, card_id, purchase_date, description,
    counterparty_name, category_id, cost_center_id, total_amount, installment_count,
    idempotency_key, notes, created_by
  ) values (
    p_tenant_id, p_card_company_id, p_expense_company_id, p_card_id, p_purchase_date,
    btrim(p_description), nullif(btrim(p_counterparty_name), ''), p_category_id,
    p_cost_center_id, p_total_amount, p_installment_count, btrim(p_idempotency_key),
    nullif(btrim(p_notes), ''), auth.uid()
  ) returning id into v_transaction_id;

  v_base_cents := v_total_cents / p_installment_count;
  v_remainder := v_total_cents % p_installment_count;
  for v_i in 1..p_installment_count loop
    v_installment_cents := v_base_cents + case when v_i <= v_remainder then 1 else 0 end;
    insert into public.card_installments (
      tenant_id, company_id, card_id, transaction_id,
      installment_number, installment_count, statement_month, amount
    ) values (
      p_tenant_id, p_card_company_id, p_card_id, v_transaction_id,
      v_i, p_installment_count,
      (v_first_statement + make_interval(months => v_i - 1))::date,
      (v_installment_cents::numeric / 100)::numeric(14,2)
    );
  end loop;

  insert into public.audit_log (tenant_id, company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_tenant_id, p_expense_company_id, auth.uid(), 'card_purchase.created', 'card_transaction', v_transaction_id,
    jsonb_build_object('card_id',p_card_id,'card_company_id',p_card_company_id,'expense_company_id',p_expense_company_id,'purchase_date',p_purchase_date,'total_amount',p_total_amount,'installment_count',p_installment_count,'first_statement_month',v_first_statement,'idempotency_key',btrim(p_idempotency_key))
  );

  select ccl.committed_amount, ccl.available_limit into v_committed, v_available from public.credit_card_limits ccl where ccl.card_id = p_card_id;
  return query select v_transaction_id, v_first_statement, v_committed, v_available;
end;
$$;

revoke all on function app_private.create_card_purchase_cross_company_impl(uuid,uuid,uuid,uuid,date,text,text,uuid,uuid,numeric,integer,text,text) from public, anon;
grant execute on function app_private.create_card_purchase_cross_company_impl(uuid,uuid,uuid,uuid,date,text,text,uuid,uuid,numeric,integer,text,text) to authenticated;

create or replace function public.create_card_purchase_cross_company(
  p_tenant_id uuid,
  p_card_company_id uuid,
  p_expense_company_id uuid,
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
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.create_card_purchase_cross_company_impl(
    p_tenant_id,p_card_company_id,p_expense_company_id,p_card_id,p_purchase_date,
    p_description,p_counterparty_name,p_category_id,p_cost_center_id,
    p_total_amount,p_installment_count,p_idempotency_key,p_notes
  );
$$;

revoke all on function public.create_card_purchase_cross_company(uuid,uuid,uuid,uuid,date,text,text,uuid,uuid,numeric,integer,text,text) from public, anon;
grant execute on function public.create_card_purchase_cross_company(uuid,uuid,uuid,uuid,date,text,text,uuid,uuid,numeric,integer,text,text) to authenticated;

alter table public.financial_entries add column if not exists planned_account_company_id uuid;
update public.financial_entries set planned_account_company_id = company_id where planned_account_id is not null and planned_account_company_id is null;

alter table public.financial_entries drop constraint if exists financial_entries_planned_account_fk;
alter table public.financial_entries
  add constraint financial_entries_planned_account_fk
  foreign key (tenant_id, planned_account_company_id, planned_account_id)
  references public.financial_accounts (tenant_id, company_id, id)
  on delete restrict;

create or replace function public.set_financial_entry_planned_account_cross_company(
  p_tenant_id uuid,
  p_company_id uuid,
  p_entry_id uuid,
  p_account_company_id uuid,
  p_account_id uuid
)
returns void
language plpgsql
security invoker
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for entry company'; end if;
  if p_account_id is not null and not app_private.can_manage_company(p_tenant_id,p_account_company_id) then raise exception 'not authorized for account company'; end if;
  if not exists (select 1 from public.financial_entries e where e.tenant_id=p_tenant_id and e.company_id=p_company_id and e.id=p_entry_id) then raise exception 'financial entry not found'; end if;
  if p_account_id is not null and not exists (select 1 from public.financial_accounts a where a.tenant_id=p_tenant_id and a.company_id=p_account_company_id and a.id=p_account_id and a.status='active') then raise exception 'active financial account not found in account company'; end if;
  update public.financial_entries
     set planned_account_id=p_account_id,
         planned_account_company_id=case when p_account_id is null then null else p_account_company_id end,
         updated_at=now()
   where tenant_id=p_tenant_id and company_id=p_company_id and id=p_entry_id;
end;
$$;

revoke all on function public.set_financial_entry_planned_account_cross_company(uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.set_financial_entry_planned_account_cross_company(uuid,uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.set_financial_entry_planned_account(p_tenant_id uuid,p_company_id uuid,p_entry_id uuid,p_account_id uuid)
returns void
language sql
security invoker
set search_path=''
as $$
  select public.set_financial_entry_planned_account_cross_company(p_tenant_id,p_company_id,p_entry_id,p_company_id,p_account_id);
$$;

create or replace view public.finance_monthly_items
with (security_invoker = true)
as
select
  fib.tenant_id,
  fib.company_id,
  'financial_installment'::text as source_kind,
  fib.installment_id as item_id,
  fib.entry_id as parent_id,
  fib.competence_month,
  fib.due_date,
  fe.entry_type,
  fe.description,
  fe.counterparty_name,
  fe.category_id,
  fe.cost_center_id,
  fib.installment_number,
  fib.installment_count,
  fib.installment_amount::numeric(14,2) as planned_amount,
  fib.settled_amount::numeric(14,2) as realized_amount,
  fib.remaining_amount::numeric(14,2) as pending_amount,
  fib.financial_status as payment_status
from public.financial_installment_balances fib
join public.financial_entries fe
  on fe.tenant_id = fib.tenant_id and fe.company_id = fib.company_id and fe.id = fib.entry_id
union all
select
  ci.tenant_id,
  ct.expense_company_id as company_id,
  'card_installment'::text as source_kind,
  ci.id as item_id,
  ci.transaction_id as parent_id,
  ci.statement_month as competence_month,
  coalesce(cs.due_date,(ci.statement_month + ((cc.due_day - 1)::text || ' days')::interval)::date) as due_date,
  'expense'::text as entry_type,
  ct.description,
  ct.counterparty_name,
  ct.category_id,
  ct.cost_center_id,
  ci.installment_number,
  ci.installment_count,
  ci.amount::numeric(14,2) as planned_amount,
  ci.amount::numeric(14,2) as realized_amount,
  0::numeric(14,2) as pending_amount,
  case when cs.id is null then 'open' when coalesce(csp.paid_total,0)=0 then 'pending' when coalesce(csp.paid_total,0)<cs.statement_amount then 'partial' else 'paid' end as payment_status
from public.card_installments ci
join public.card_transactions ct on ct.tenant_id=ci.tenant_id and ct.company_id=ci.company_id and ct.id=ci.transaction_id
join public.credit_cards cc on cc.tenant_id=ci.tenant_id and cc.company_id=ci.company_id and cc.id=ci.card_id
left join public.card_statements cs on cs.tenant_id=ci.tenant_id and cs.company_id=ci.company_id and cs.card_id=ci.card_id and cs.statement_month=ci.statement_month
left join lateral (
  select coalesce(sum(csp0.amount),0)::numeric(14,2) as paid_total
  from public.card_statement_payments csp0
  where csp0.tenant_id=cs.tenant_id and csp0.company_id=cs.company_id and csp0.statement_id=cs.id
) csp on true;

commit;
