begin;

create table public.payroll_closings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  employment_contract_id uuid not null,
  competence_month date not null check (competence_month = date_trunc('month', competence_month)::date),
  base_salary_snapshot numeric(14,2) not null check (base_salary_snapshot >= 0),
  events_credit_snapshot numeric(14,2) not null default 0 check (events_credit_snapshot >= 0),
  events_debit_snapshot numeric(14,2) not null default 0 check (events_debit_snapshot >= 0),
  gross_snapshot numeric(14,2) not null,
  net_before_statutory_snapshot numeric(14,2) not null,
  status text not null default 'closed' check (status in ('closed','reopened')),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 200),
  closed_at timestamptz not null default now(),
  closed_by uuid not null references auth.users(id) on delete restrict,
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint payroll_closings_contract_fk foreign key (tenant_id, company_id, employment_contract_id)
    references public.employment_contracts(tenant_id, company_id, id) on delete restrict,
  unique (tenant_id, company_id, employment_contract_id, competence_month),
  unique (tenant_id, company_id, idempotency_key),
  unique (tenant_id, company_id, id)
);

create table public.payroll_closing_event_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  payroll_closing_id uuid not null,
  payroll_event_id uuid not null references public.payroll_events(id) on delete restrict,
  event_type text not null,
  amount numeric(14,2) not null,
  quantity numeric(12,4),
  description text,
  cost_center_id uuid,
  created_at timestamptz not null default now(),
  constraint payroll_closing_event_closing_fk foreign key (tenant_id, company_id, payroll_closing_id)
    references public.payroll_closings(tenant_id, company_id, id) on delete restrict,
  constraint payroll_closing_event_cost_center_fk foreign key (tenant_id, company_id, cost_center_id)
    references public.cost_centers(tenant_id, company_id, id) on delete restrict,
  unique (payroll_closing_id, payroll_event_id)
);

create index payroll_closings_company_competence_idx on public.payroll_closings(tenant_id, company_id, competence_month);
create index payroll_closing_event_snapshots_closing_idx on public.payroll_closing_event_snapshots(tenant_id, company_id, payroll_closing_id);

alter table public.payroll_closings enable row level security;
alter table public.payroll_closing_event_snapshots enable row level security;
create policy payroll_closings_select_authorized on public.payroll_closings for select to authenticated using (app_private.can_access_company(tenant_id, company_id));
create policy payroll_closing_events_select_authorized on public.payroll_closing_event_snapshots for select to authenticated using (app_private.can_access_company(tenant_id, company_id));
revoke all on public.payroll_closings from anon, authenticated;
revoke all on public.payroll_closing_event_snapshots from anon, authenticated;
grant select on public.payroll_closings to authenticated;
grant select on public.payroll_closing_event_snapshots to authenticated;

create or replace function app_private.close_payroll_impl(p_tenant_id uuid,p_company_id uuid,p_employment_contract_id uuid,p_competence_month date,p_idempotency_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_existing public.payroll_closings%rowtype; v_salary numeric(14,2); v_credit numeric(14,2); v_debit numeric(14,2); v_closing_id uuid;
begin
  if v_user_id is null or not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized'; end if;
  if p_competence_month <> date_trunc('month',p_competence_month)::date then raise exception 'competence must be first day of month'; end if;
  if nullif(btrim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;
  select * into v_existing from public.payroll_closings where tenant_id=p_tenant_id and company_id=p_company_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.employment_contract_id<>p_employment_contract_id or v_existing.competence_month<>p_competence_month then raise exception 'idempotency key conflict'; end if;
    return v_existing.id;
  end if;
  perform 1 from public.employment_contracts where tenant_id=p_tenant_id and company_id=p_company_id and id=p_employment_contract_id and hired_on <= (p_competence_month + interval '1 month - 1 day')::date and (terminated_on is null or terminated_on >= p_competence_month);
  if not found then raise exception 'employment contract not active in competence'; end if;
  select base_salary into v_salary from public.compensation_terms where tenant_id=p_tenant_id and company_id=p_company_id and employment_contract_id=p_employment_contract_id and valid_from <= (p_competence_month + interval '1 month - 1 day')::date and (valid_to is null or valid_to >= p_competence_month) order by valid_from desc limit 1;
  if v_salary is null then raise exception 'compensation term not found'; end if;
  select coalesce(sum(case when event_type in ('benefit','overtime','positive_adjustment') then amount else 0 end),0),coalesce(sum(case when event_type in ('advance','absence','dsr','negative_adjustment') then amount else 0 end),0) into v_credit,v_debit from public.payroll_events where tenant_id=p_tenant_id and company_id=p_company_id and employment_contract_id=p_employment_contract_id and competence_month=p_competence_month;
  insert into public.payroll_closings(tenant_id,company_id,employment_contract_id,competence_month,base_salary_snapshot,events_credit_snapshot,events_debit_snapshot,gross_snapshot,net_before_statutory_snapshot,idempotency_key,closed_by) values(p_tenant_id,p_company_id,p_employment_contract_id,p_competence_month,v_salary,v_credit,v_debit,v_salary+v_credit,v_salary+v_credit-v_debit,p_idempotency_key,v_user_id) returning id into v_closing_id;
  insert into public.payroll_closing_event_snapshots(tenant_id,company_id,payroll_closing_id,payroll_event_id,event_type,amount,quantity,description,cost_center_id) select tenant_id,company_id,v_closing_id,id,event_type,amount,quantity,description,cost_center_id from public.payroll_events where tenant_id=p_tenant_id and company_id=p_company_id and employment_contract_id=p_employment_contract_id and competence_month=p_competence_month;
  insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_tenant_id,p_company_id,v_user_id,'payroll.closed','payroll_closing',v_closing_id,jsonb_build_object('competence_month',p_competence_month,'employment_contract_id',p_employment_contract_id,'base_salary',v_salary,'event_credits',v_credit,'event_debits',v_debit));
  return v_closing_id;
end; $$;
revoke all on function app_private.close_payroll_impl(uuid,uuid,uuid,date,text) from public, anon;
grant execute on function app_private.close_payroll_impl(uuid,uuid,uuid,date,text) to authenticated;
create or replace function public.close_payroll(p_tenant_id uuid,p_company_id uuid,p_employment_contract_id uuid,p_competence_month date,p_idempotency_key text) returns uuid language sql security invoker set search_path='' as $$ select app_private.close_payroll_impl(p_tenant_id,p_company_id,p_employment_contract_id,p_competence_month,p_idempotency_key); $$;
revoke all on function public.close_payroll(uuid,uuid,uuid,date,text) from public, anon;
grant execute on function public.close_payroll(uuid,uuid,uuid,date,text) to authenticated;
commit;
