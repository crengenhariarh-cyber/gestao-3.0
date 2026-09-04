begin;

alter table public.financial_settlements
  add column if not exists settles_in_full boolean not null default false;

comment on column public.financial_settlements.settles_in_full is
  'True when the effective amount closes the installment even if it differs from the planned remaining amount.';

create or replace view public.financial_installment_balances
with (security_invoker = true)
as
select
  fi.id as installment_id,
  fi.tenant_id,
  fi.company_id,
  fi.entry_id,
  fi.installment_number,
  fi.installment_count,
  fi.due_date,
  fi.competence_month,
  fi.amount as installment_amount,
  coalesce(sum(fs.amount), 0)::numeric(14,2) as settled_amount,
  case
    when coalesce(bool_or(fs.settles_in_full), false) then 0::numeric(14,2)
    else greatest(fi.amount - coalesce(sum(fs.amount), 0), 0)::numeric(14,2)
  end as remaining_amount,
  case
    when coalesce(bool_or(fs.settles_in_full), false) then 'paid'
    when coalesce(sum(fs.amount), 0) = 0 then 'pending'
    when coalesce(sum(fs.amount), 0) < fi.amount then 'partial'
    else 'paid'
  end as financial_status
from public.financial_installments fi
left join public.financial_settlements fs
  on fs.tenant_id = fi.tenant_id
  and fs.company_id = fi.company_id
  and fs.installment_id = fi.id
group by
  fi.id,
  fi.tenant_id,
  fi.company_id,
  fi.entry_id,
  fi.installment_number,
  fi.installment_count,
  fi.due_date,
  fi.competence_month,
  fi.amount;

revoke all on public.financial_installment_balances from public, anon;
grant select on public.financial_installment_balances to authenticated;

drop function if exists public.record_financial_settlement(uuid,uuid,uuid,uuid,date,numeric,text,text);
drop function if exists app_private.record_financial_settlement_impl(uuid,uuid,uuid,uuid,date,numeric,text,text);

create function app_private.record_financial_settlement_impl(
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
security definer
set search_path to ''
as $$
declare
  v_existing public.financial_settlements%rowtype;
  v_installment_amount numeric(14,2);
  v_settled_total numeric(14,2);
  v_remaining_before numeric(14,2);
  v_remaining numeric(14,2);
  v_settlement_id uuid;
  v_status text;
  v_account_company_id uuid;
  v_key text;
  v_force_paid boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'settlement amount must be greater than zero'; end if;
  if p_settled_on is null then raise exception 'settlement date is required'; end if;
  if round(p_amount,2)<>p_amount then raise exception 'settlement amount supports at most two decimal places'; end if;
  v_key:=btrim(coalesce(p_idempotency_key,''));
  if length(v_key)<1 or length(v_key)>200 then raise exception 'idempotency key must contain between 1 and 200 characters'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text||':'||p_company_id::text||':'||v_key,0));
  select * into v_existing from public.financial_settlements fs where fs.tenant_id=p_tenant_id and fs.company_id=p_company_id and fs.idempotency_key=v_key;
  if found then
    if v_existing.installment_id<>p_installment_id
      or v_existing.account_id<>p_account_id
      or v_existing.settled_on<>p_settled_on
      or v_existing.amount<>p_amount::numeric(14,2)
      or v_existing.settles_in_full<>coalesce(p_settles_in_full,false)
    then raise exception 'idempotency key already used with different settlement data'; end if;
    select fi.amount into v_installment_amount from public.financial_installments fi where fi.tenant_id=p_tenant_id and fi.company_id=p_company_id and fi.id=p_installment_id;
    select coalesce(sum(fs.amount),0)::numeric(14,2), coalesce(bool_or(fs.settles_in_full),false)
      into v_settled_total, v_force_paid
    from public.financial_settlements fs
    where fs.tenant_id=p_tenant_id and fs.company_id=p_company_id and fs.installment_id=p_installment_id;
    v_remaining:=case when v_force_paid then 0 else greatest(v_installment_amount-v_settled_total,0) end;
    v_status:=case when v_force_paid then 'paid' when v_settled_total=0 then 'pending' when v_settled_total<v_installment_amount then 'partial' else 'paid' end;
    return query select v_existing.id,v_existing.amount,v_installment_amount,v_settled_total,v_remaining,v_status;
    return;
  end if;

  select fi.amount into v_installment_amount from public.financial_installments fi where fi.tenant_id=p_tenant_id and fi.company_id=p_company_id and fi.id=p_installment_id for update;
  if not found then raise exception 'financial installment not found in company'; end if;

  select fa.company_id into v_account_company_id
  from public.financial_accounts fa
  where fa.tenant_id=p_tenant_id and fa.id=p_account_id and fa.status='active';
  if v_account_company_id is null then raise exception 'active financial account not found in tenant'; end if;
  if not app_private.can_manage_company(p_tenant_id,v_account_company_id) then raise exception 'not authorized for payment account company'; end if;

  select coalesce(sum(fs.amount),0)::numeric(14,2), coalesce(bool_or(fs.settles_in_full),false)
    into v_settled_total, v_force_paid
  from public.financial_settlements fs
  where fs.tenant_id=p_tenant_id and fs.company_id=p_company_id and fs.installment_id=p_installment_id;

  if v_force_paid or v_settled_total>=v_installment_amount then
    raise exception 'financial installment is already fully settled';
  end if;

  v_remaining_before:=greatest(v_installment_amount-v_settled_total,0)::numeric(14,2);

  insert into public.financial_settlements(tenant_id,company_id,installment_id,account_id,settled_on,amount,idempotency_key,notes,settles_in_full,created_by)
  values(p_tenant_id,p_company_id,p_installment_id,p_account_id,p_settled_on,p_amount,v_key,nullif(btrim(p_notes),''),coalesce(p_settles_in_full,false),auth.uid()) returning id into v_settlement_id;

  v_settled_total:=(v_settled_total+p_amount)::numeric(14,2);
  v_force_paid:=coalesce(p_settles_in_full,false);
  v_remaining:=case when v_force_paid then 0 else greatest(v_installment_amount-v_settled_total,0) end;
  v_status:=case when v_force_paid then 'paid' when v_settled_total=0 then 'pending' when v_settled_total<v_installment_amount then 'partial' else 'paid' end;

  insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(p_tenant_id,p_company_id,auth.uid(),'financial_settlement.recorded','financial_settlement',v_settlement_id,
    pg_catalog.jsonb_build_object(
      'installment_id',p_installment_id,
      'account_id',p_account_id,
      'payment_account_company_id',v_account_company_id,
      'settled_on',p_settled_on,
      'amount',p_amount,
      'idempotency_key',v_key,
      'settles_in_full',coalesce(p_settles_in_full,false),
      'remaining_before',v_remaining_before,
      'settlement_difference',case when coalesce(p_settles_in_full,false) then p_amount-v_remaining_before else 0 end,
      'status_after',v_status,
      'overpayment',greatest(v_settled_total-v_installment_amount,0)
    ));

  return query select v_settlement_id,p_amount::numeric(14,2),v_installment_amount,v_settled_total,v_remaining,v_status;
end;
$$;

create function public.record_financial_settlement(
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
language sql
set search_path to ''
as $$
  select * from app_private.record_financial_settlement_impl(
    p_tenant_id,p_company_id,p_installment_id,p_account_id,p_settled_on,p_amount,p_idempotency_key,p_notes,p_settles_in_full
  );
$$;

revoke all on function public.record_financial_settlement(uuid,uuid,uuid,uuid,date,numeric,text,text,boolean) from public, anon;
grant execute on function public.record_financial_settlement(uuid,uuid,uuid,uuid,date,numeric,text,text,boolean) to authenticated;

comment on function public.record_financial_settlement(uuid,uuid,uuid,uuid,date,numeric,text,text,boolean)
is 'Records the effective settlement amount. When settles_in_full is true, the installment is closed even when the effective amount differs from the planned remaining amount.';

commit;
