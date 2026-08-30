begin;

create table public.payroll_finance_settings (
  tenant_id uuid not null,
  company_id uuid not null,
  salary_category_id uuid not null,
  fgts_category_id uuid not null,
  inss_category_id uuid not null,
  irrf_category_id uuid not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, company_id),
  constraint payroll_finance_settings_company_fk foreign key (tenant_id, company_id)
    references public.companies(tenant_id, id) on delete restrict,
  constraint payroll_finance_salary_category_fk foreign key (tenant_id, company_id, salary_category_id)
    references public.financial_categories(tenant_id, company_id, id) on delete restrict,
  constraint payroll_finance_fgts_category_fk foreign key (tenant_id, company_id, fgts_category_id)
    references public.financial_categories(tenant_id, company_id, id) on delete restrict,
  constraint payroll_finance_inss_category_fk foreign key (tenant_id, company_id, inss_category_id)
    references public.financial_categories(tenant_id, company_id, id) on delete restrict,
  constraint payroll_finance_irrf_category_fk foreign key (tenant_id, company_id, irrf_category_id)
    references public.financial_categories(tenant_id, company_id, id) on delete restrict
);

create table public.payroll_finance_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  competence_month date not null check (competence_month = date_trunc('month', competence_month)::date),
  source_kind text not null check (source_kind in ('net_salary','fgts','inss_employee','irrf')),
  source_key text not null check (length(btrim(source_key)) between 1 and 240),
  payroll_closing_id uuid,
  financial_entry_id uuid not null,
  financial_installment_id uuid not null,
  generated_amount numeric(14,2) not null check (generated_amount > 0),
  synced_at timestamptz not null default now(),
  synced_by uuid references auth.users(id) on delete set null,
  constraint payroll_finance_links_company_fk foreign key (tenant_id, company_id)
    references public.companies(tenant_id, id) on delete restrict,
  constraint payroll_finance_links_closing_fk foreign key (tenant_id, company_id, payroll_closing_id)
    references public.payroll_closings(tenant_id, company_id, id) on delete restrict,
  constraint payroll_finance_links_entry_fk foreign key (tenant_id, company_id, financial_entry_id)
    references public.financial_entries(tenant_id, company_id, id) on delete restrict,
  constraint payroll_finance_links_installment_fk foreign key (tenant_id, company_id, financial_installment_id)
    references public.financial_installments(tenant_id, company_id, id) on delete restrict,
  unique (tenant_id, company_id, source_key)
);

create index payroll_finance_links_competence_idx
  on public.payroll_finance_links(tenant_id, company_id, competence_month, source_kind);

alter table public.payroll_finance_settings enable row level security;
alter table public.payroll_finance_links enable row level security;

create policy payroll_finance_settings_select_authorized
on public.payroll_finance_settings for select to authenticated
using (app_private.can_access_company(tenant_id, company_id));

create policy payroll_finance_links_select_authorized
on public.payroll_finance_links for select to authenticated
using (app_private.can_access_company(tenant_id, company_id));

revoke all on public.payroll_finance_settings from public, anon, authenticated;
revoke all on public.payroll_finance_links from public, anon, authenticated;
grant select on public.payroll_finance_settings to authenticated;
grant select on public.payroll_finance_links to authenticated;

create or replace function app_private.configure_payroll_finance_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_salary_category_id uuid,
  p_fgts_category_id uuid,
  p_inss_category_id uuid,
  p_irrf_category_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null or not app_private.can_manage_company(p_tenant_id, p_company_id) then
    raise exception 'not authorized';
  end if;

  select count(*) into v_count
  from public.financial_categories fc
  where fc.tenant_id = p_tenant_id
    and fc.company_id = p_company_id
    and fc.id in (p_salary_category_id, p_fgts_category_id, p_inss_category_id, p_irrf_category_id)
    and fc.status = 'active'
    and fc.kind in ('expense','both');

  if v_count <> 4 then
    raise exception 'all payroll finance categories must be active expense-compatible categories in the company';
  end if;

  insert into public.payroll_finance_settings(
    tenant_id, company_id, salary_category_id, fgts_category_id, inss_category_id, irrf_category_id, updated_by
  ) values (
    p_tenant_id, p_company_id, p_salary_category_id, p_fgts_category_id, p_inss_category_id, p_irrf_category_id, v_user
  )
  on conflict (tenant_id, company_id) do update set
    salary_category_id = excluded.salary_category_id,
    fgts_category_id = excluded.fgts_category_id,
    inss_category_id = excluded.inss_category_id,
    irrf_category_id = excluded.irrf_category_id,
    updated_by = excluded.updated_by,
    updated_at = now();

  insert into public.audit_log(tenant_id, company_id, actor_user_id, action, entity_type, metadata)
  values(
    p_tenant_id, p_company_id, v_user, 'payroll.finance_configured', 'payroll_finance_settings',
    pg_catalog.jsonb_build_object(
      'salary_category_id', p_salary_category_id,
      'fgts_category_id', p_fgts_category_id,
      'inss_category_id', p_inss_category_id,
      'irrf_category_id', p_irrf_category_id
    )
  );
end;
$$;

revoke all on function app_private.configure_payroll_finance_impl(uuid,uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function app_private.configure_payroll_finance_impl(uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.configure_payroll_finance(
  p_tenant_id uuid,
  p_company_id uuid,
  p_salary_category_id uuid,
  p_fgts_category_id uuid,
  p_inss_category_id uuid,
  p_irrf_category_id uuid
) returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.configure_payroll_finance_impl(
    p_tenant_id,p_company_id,p_salary_category_id,p_fgts_category_id,p_inss_category_id,p_irrf_category_id
  );
$$;

revoke all on function public.configure_payroll_finance(uuid,uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.configure_payroll_finance(uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;

create or replace function app_private.upsert_payroll_payable(
  p_tenant_id uuid,
  p_company_id uuid,
  p_competence_month date,
  p_source_kind text,
  p_source_key text,
  p_payroll_closing_id uuid,
  p_category_id uuid,
  p_description text,
  p_counterparty text,
  p_due_date date,
  p_amount numeric,
  p_user uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.payroll_finance_links%rowtype;
  v_entry uuid;
  v_installment uuid;
  v_settled numeric(14,2);
begin
  if p_amount is null or p_amount <= 0 then return null; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':' || p_company_id::text || ':' || p_source_key, 0)
  );

  select * into v_link
  from public.payroll_finance_links
  where tenant_id=p_tenant_id and company_id=p_company_id and source_key=p_source_key;

  if found then
    select coalesce(sum(fs.amount),0)::numeric(14,2) into v_settled
    from public.financial_settlements fs
    where fs.tenant_id=p_tenant_id and fs.company_id=p_company_id
      and fs.installment_id=v_link.financial_installment_id;

    if v_settled > 0 and (
      v_link.generated_amount <> round(p_amount,2)
      or exists(select 1 from public.financial_installments fi
        where fi.id=v_link.financial_installment_id and (fi.due_date<>p_due_date or fi.amount<>round(p_amount,2)))
    ) then
      raise exception 'payroll payable already settled/partially settled and cannot be recalculated';
    end if;

    update public.financial_entries set
      description=btrim(p_description),
      counterparty_name=nullif(btrim(p_counterparty),''),
      category_id=p_category_id,
      competence_month=p_competence_month,
      notes='Gerado automaticamente pelo RH do Gestão 3.0.'
    where tenant_id=p_tenant_id and company_id=p_company_id and id=v_link.financial_entry_id;

    update public.financial_installments set
      due_date=p_due_date,
      amount=round(p_amount,2)
    where tenant_id=p_tenant_id and company_id=p_company_id and id=v_link.financial_installment_id;

    update public.payroll_finance_links set
      generated_amount=round(p_amount,2), synced_at=now(), synced_by=p_user,
      payroll_closing_id=p_payroll_closing_id
    where id=v_link.id;

    return v_link.financial_entry_id;
  end if;

  insert into public.financial_entries(
    tenant_id,company_id,entry_type,description,counterparty_name,category_id,cost_center_id,
    competence_month,notes,created_by
  ) values(
    p_tenant_id,p_company_id,'expense',btrim(p_description),nullif(btrim(p_counterparty),''),p_category_id,null,
    p_competence_month,'Gerado automaticamente pelo RH do Gestão 3.0.',p_user
  ) returning id into v_entry;

  insert into public.financial_installments(
    tenant_id,company_id,entry_id,installment_number,installment_count,due_date,amount
  ) values(
    p_tenant_id,p_company_id,v_entry,1,1,p_due_date,round(p_amount,2)
  ) returning id into v_installment;

  insert into public.payroll_finance_links(
    tenant_id,company_id,competence_month,source_kind,source_key,payroll_closing_id,
    financial_entry_id,financial_installment_id,generated_amount,synced_by
  ) values(
    p_tenant_id,p_company_id,p_competence_month,p_source_kind,p_source_key,p_payroll_closing_id,
    v_entry,v_installment,round(p_amount,2),p_user
  );

  return v_entry;
end;
$$;

revoke all on function app_private.upsert_payroll_payable(uuid,uuid,date,text,text,uuid,uuid,text,text,date,numeric,uuid) from public, anon, authenticated;

create or replace function app_private.sync_payroll_accounts_payable_impl(
  p_tenant_id uuid,
  p_company_id uuid,
  p_competence_month date,
  p_salary_due_date date,
  p_fgts_due_date date,
  p_inss_due_date date,
  p_irrf_due_date date
) returns table(created_or_synced integer, salary_total numeric, fgts_total numeric, inss_employee_total numeric, irrf_total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_settings public.payroll_finance_settings%rowtype;
  v_closed integer;
  v_calculated integer;
  v_count integer := 0;
  v_salary_total numeric(14,2) := 0;
  v_fgts_total numeric(14,2) := 0;
  v_inss_total numeric(14,2) := 0;
  v_irrf_total numeric(14,2) := 0;
  r record;
begin
  if v_user is null or not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized'; end if;
  if p_competence_month is null or p_competence_month<>date_trunc('month',p_competence_month)::date then raise exception 'invalid competence'; end if;
  if p_salary_due_date is null or p_fgts_due_date is null or p_inss_due_date is null or p_irrf_due_date is null then raise exception 'all due dates are required'; end if;

  select * into v_settings from public.payroll_finance_settings
  where tenant_id=p_tenant_id and company_id=p_company_id;
  if not found then raise exception 'payroll finance settings not configured'; end if;

  select count(*) into v_closed from public.payroll_closings pc
  where pc.tenant_id=p_tenant_id and pc.company_id=p_company_id
    and pc.competence_month=p_competence_month and pc.status='closed';

  select count(*) into v_calculated
  from public.payroll_statutory_calculations psc
  join public.payroll_closings pc
    on pc.tenant_id=psc.tenant_id and pc.company_id=psc.company_id and pc.id=psc.payroll_closing_id
  where psc.tenant_id=p_tenant_id and psc.company_id=p_company_id
    and psc.competence_month=p_competence_month and pc.status='closed';

  if v_closed=0 then raise exception 'no closed payrolls in competence'; end if;
  if v_closed<>v_calculated then raise exception 'all closed payrolls must have statutory calculation before accounts payable sync'; end if;

  for r in
    select pc.id as closing_id, e.full_name,
      greatest(0,pc.net_before_statutory_snapshot-psc.inss_amount-psc.irrf_amount)::numeric(14,2) as net_salary
    from public.payroll_closings pc
    join public.payroll_statutory_calculations psc
      on psc.tenant_id=pc.tenant_id and psc.company_id=pc.company_id and psc.payroll_closing_id=pc.id
    join public.employment_contracts ec
      on ec.tenant_id=pc.tenant_id and ec.company_id=pc.company_id and ec.id=pc.employment_contract_id
    join public.employees e on e.tenant_id=ec.tenant_id and e.id=ec.employee_id
    where pc.tenant_id=p_tenant_id and pc.company_id=p_company_id
      and pc.competence_month=p_competence_month and pc.status='closed'
    order by e.full_name,pc.id
  loop
    v_salary_total := v_salary_total + r.net_salary;
    if r.net_salary>0 then
      perform app_private.upsert_payroll_payable(
        p_tenant_id,p_company_id,p_competence_month,'net_salary','net_salary:'||r.closing_id::text,r.closing_id,
        v_settings.salary_category_id,
        'Salário líquido - '||r.full_name||' - '||to_char(p_competence_month,'MM/YYYY'),
        r.full_name,p_salary_due_date,r.net_salary,v_user
      );
      v_count:=v_count+1;
    end if;
  end loop;

  select coalesce(sum(psc.fgts_amount),0)::numeric(14,2),
         coalesce(sum(psc.inss_amount),0)::numeric(14,2),
         coalesce(sum(psc.irrf_amount),0)::numeric(14,2)
    into v_fgts_total,v_inss_total,v_irrf_total
  from public.payroll_statutory_calculations psc
  join public.payroll_closings pc
    on pc.tenant_id=psc.tenant_id and pc.company_id=psc.company_id and pc.id=psc.payroll_closing_id
  where psc.tenant_id=p_tenant_id and psc.company_id=p_company_id
    and psc.competence_month=p_competence_month and pc.status='closed';

  if v_fgts_total>0 then
    perform app_private.upsert_payroll_payable(
      p_tenant_id,p_company_id,p_competence_month,'fgts','fgts:'||p_competence_month::text,null,
      v_settings.fgts_category_id,'FGTS consolidado - '||to_char(p_competence_month,'MM/YYYY'),
      'FGTS',p_fgts_due_date,v_fgts_total,v_user
    ); v_count:=v_count+1;
  end if;

  if v_inss_total>0 then
    perform app_private.upsert_payroll_payable(
      p_tenant_id,p_company_id,p_competence_month,'inss_employee','inss_employee:'||p_competence_month::text,null,
      v_settings.inss_category_id,'INSS retido dos colaboradores - '||to_char(p_competence_month,'MM/YYYY'),
      'INSS - parcela do empregado',p_inss_due_date,v_inss_total,v_user
    ); v_count:=v_count+1;
  end if;

  if v_irrf_total>0 then
    perform app_private.upsert_payroll_payable(
      p_tenant_id,p_company_id,p_competence_month,'irrf','irrf:'||p_competence_month::text,null,
      v_settings.irrf_category_id,'IRRF retido dos colaboradores - '||to_char(p_competence_month,'MM/YYYY'),
      'Receita Federal',p_irrf_due_date,v_irrf_total,v_user
    ); v_count:=v_count+1;
  end if;

  insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,metadata)
  values(p_tenant_id,p_company_id,v_user,'payroll.accounts_payable_synced','payroll_competence',
    pg_catalog.jsonb_build_object(
      'competence_month',p_competence_month,
      'items',v_count,
      'salary_total',v_salary_total,
      'fgts_total',v_fgts_total,
      'inss_employee_total',v_inss_total,
      'irrf_total',v_irrf_total
    ));

  return query select v_count,v_salary_total,v_fgts_total,v_inss_total,v_irrf_total;
end;
$$;

revoke all on function app_private.sync_payroll_accounts_payable_impl(uuid,uuid,date,date,date,date,date) from public, anon;
grant execute on function app_private.sync_payroll_accounts_payable_impl(uuid,uuid,date,date,date,date,date) to authenticated;

create or replace function public.sync_payroll_accounts_payable(
  p_tenant_id uuid,
  p_company_id uuid,
  p_competence_month date,
  p_salary_due_date date,
  p_fgts_due_date date,
  p_inss_due_date date,
  p_irrf_due_date date
) returns table(created_or_synced integer, salary_total numeric, fgts_total numeric, inss_employee_total numeric, irrf_total numeric)
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.sync_payroll_accounts_payable_impl(
    p_tenant_id,p_company_id,p_competence_month,p_salary_due_date,p_fgts_due_date,p_inss_due_date,p_irrf_due_date
  );
$$;

revoke all on function public.sync_payroll_accounts_payable(uuid,uuid,date,date,date,date,date) from public, anon;
grant execute on function public.sync_payroll_accounts_payable(uuid,uuid,date,date,date,date,date) to authenticated;

comment on table public.payroll_finance_links is 'Idempotent bridge from payroll obligations to Finance accounts payable. FGTS/INSS/IRRF are company+competence consolidated; net salary remains per closing.';
comment on function public.sync_payroll_accounts_payable(uuid,uuid,date,date,date,date,date) is 'Synchronizes a complete payroll competence into Finance. Refuses incomplete statutory months and refuses silent mutation of already-settled generated payables.';

commit;
