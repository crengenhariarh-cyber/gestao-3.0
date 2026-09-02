alter table public.financial_accounts add constraint financial_accounts_tenant_id_id_key unique (tenant_id, id);
alter table public.credit_cards add constraint credit_cards_tenant_id_id_key unique (tenant_id, id);

alter table public.financial_entries drop constraint if exists financial_entries_planned_account_fk;
alter table public.financial_entries add constraint financial_entries_planned_account_fk foreign key (tenant_id, planned_account_id) references public.financial_accounts(tenant_id, id) on delete restrict;

alter table public.financial_settlements drop constraint if exists financial_settlements_account_fk;
alter table public.financial_settlements add constraint financial_settlements_account_fk foreign key (tenant_id, account_id) references public.financial_accounts(tenant_id, id) on delete restrict;

alter table public.financial_account_movements drop constraint if exists financial_account_movements_account_fk;
alter table public.financial_account_movements add constraint financial_account_movements_account_fk foreign key (tenant_id, account_id) references public.financial_accounts(tenant_id, id) on delete restrict;

alter table public.financial_transfers drop constraint if exists financial_transfers_from_account_fk;
alter table public.financial_transfers add constraint financial_transfers_from_account_fk foreign key (tenant_id, from_account_id) references public.financial_accounts(tenant_id, id) on delete restrict;
alter table public.financial_transfers drop constraint if exists financial_transfers_to_account_fk;
alter table public.financial_transfers add constraint financial_transfers_to_account_fk foreign key (tenant_id, to_account_id) references public.financial_accounts(tenant_id, id) on delete restrict;

alter table public.card_statement_payments drop constraint if exists card_statement_payments_account_fk;
alter table public.card_statement_payments add constraint card_statement_payments_account_fk foreign key (tenant_id, account_id) references public.financial_accounts(tenant_id, id) on delete restrict;

alter table public.card_transactions drop constraint if exists card_transactions_card_fk;
alter table public.card_transactions add constraint card_transactions_card_fk foreign key (tenant_id, card_id) references public.credit_cards(tenant_id, id) on delete restrict;
alter table public.card_installments drop constraint if exists card_installments_card_fk;
alter table public.card_installments add constraint card_installments_card_fk foreign key (tenant_id, card_id) references public.credit_cards(tenant_id, id) on delete restrict;
alter table public.card_statements drop constraint if exists card_statements_card_fk;
alter table public.card_statements add constraint card_statements_card_fk foreign key (tenant_id, card_id) references public.credit_cards(tenant_id, id) on delete restrict;
alter table public.card_statement_payments drop constraint if exists card_statement_payments_card_fk;
alter table public.card_statement_payments add constraint card_statement_payments_card_fk foreign key (tenant_id, card_id) references public.credit_cards(tenant_id, id) on delete restrict;

create or replace view public.credit_card_limits as
with installment_totals as (
  select tenant_id, card_id, coalesce(sum(amount),0)::numeric(14,2) as total
  from public.card_installments
  group by tenant_id, card_id
), statement_payment_applied as (
  select cs.tenant_id, cs.card_id, cs.id as statement_id,
         least(coalesce(sum(csp.amount),0), cs.statement_amount)::numeric(14,2) as applied_total
  from public.card_statements cs
  left join public.card_statement_payments csp
    on csp.tenant_id = cs.tenant_id and csp.company_id = cs.company_id and csp.statement_id = cs.id
  group by cs.tenant_id, cs.card_id, cs.id, cs.statement_amount
), payment_totals as (
  select tenant_id, card_id, coalesce(sum(applied_total),0)::numeric(14,2) as total
  from statement_payment_applied
  group by tenant_id, card_id
)
select cc.id as card_id, cc.tenant_id, cc.company_id, cc.name, cc.credit_limit,
       greatest(coalesce(it.total,0)-coalesce(pt.total,0),0)::numeric(14,2) as committed_amount,
       greatest(cc.credit_limit-greatest(coalesce(it.total,0)-coalesce(pt.total,0),0),0)::numeric(14,2) as available_limit,
       cc.sort_order
from public.credit_cards cc
left join installment_totals it on it.tenant_id = cc.tenant_id and it.card_id = cc.id
left join payment_totals pt on pt.tenant_id = cc.tenant_id and pt.card_id = cc.id;

create or replace function public.reassign_financial_account_company(
  p_tenant_id uuid,
  p_account_id uuid,
  p_source_company_id uuid,
  p_target_company_id uuid,
  p_name text,
  p_account_type text,
  p_bank_institution text,
  p_status text
) returns setof public.financial_accounts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_balance numeric(14,2);
begin
  select current_balance into v_balance
  from public.financial_account_balances
  where tenant_id = p_tenant_id and company_id = p_source_company_id and account_id = p_account_id;
  if not found then raise exception 'financial account not found in source company'; end if;

  update public.credit_cards
     set default_payment_account_id = null
   where tenant_id = p_tenant_id
     and company_id = p_source_company_id
     and default_payment_account_id = p_account_id;

  return query
  update public.financial_accounts
     set company_id = p_target_company_id,
         name = trim(p_name),
         account_type = p_account_type,
         bank_institution = nullif(p_bank_institution,''),
         status = p_status,
         opening_balance = v_balance
   where tenant_id = p_tenant_id
     and company_id = p_source_company_id
     and id = p_account_id
  returning *;
end;
$$;

create or replace function public.reassign_credit_card_company(
  p_tenant_id uuid,
  p_card_id uuid,
  p_source_company_id uuid,
  p_target_company_id uuid,
  p_name text,
  p_bank_institution text,
  p_last_four text,
  p_credit_limit numeric,
  p_closing_day integer,
  p_due_day integer,
  p_status text
) returns setof public.credit_cards
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  update public.credit_cards
     set company_id = p_target_company_id,
         name = trim(p_name),
         bank_institution = nullif(p_bank_institution,''),
         last_four = nullif(p_last_four,''),
         credit_limit = p_credit_limit,
         closing_day = p_closing_day,
         due_day = p_due_day,
         default_payment_account_id = null,
         status = p_status
   where tenant_id = p_tenant_id
     and company_id = p_source_company_id
     and id = p_card_id
  returning *;
end;
$$;
