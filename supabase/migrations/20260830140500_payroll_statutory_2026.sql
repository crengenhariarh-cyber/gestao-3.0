begin;

create table public.payroll_statutory_calculations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  payroll_closing_id uuid not null,
  competence_month date not null check (competence_month = date_trunc('month', competence_month)::date),
  inss_base numeric(14,2) not null check (inss_base >= 0),
  inss_amount numeric(14,2) not null check (inss_amount >= 0),
  irrf_taxable_income numeric(14,2) not null check (irrf_taxable_income >= 0),
  irrf_deduction_method text not null check (irrf_deduction_method in ('legal','simplified')),
  irrf_deduction_amount numeric(14,2) not null check (irrf_deduction_amount >= 0),
  irrf_base numeric(14,2) not null check (irrf_base >= 0),
  irrf_before_reduction numeric(14,2) not null check (irrf_before_reduction >= 0),
  irrf_reduction numeric(14,2) not null check (irrf_reduction >= 0),
  irrf_amount numeric(14,2) not null check (irrf_amount >= 0),
  fgts_base numeric(14,2) not null check (fgts_base >= 0),
  fgts_rate numeric(7,6) not null check (fgts_rate >= 0),
  fgts_amount numeric(14,2) not null check (fgts_amount >= 0),
  ruleset text not null,
  calculated_at timestamptz not null default now(),
  calculated_by uuid not null references auth.users(id) on delete restrict,
  constraint payroll_statutory_closing_fk foreign key (tenant_id,company_id,payroll_closing_id)
    references public.payroll_closings(tenant_id,company_id,id) on delete restrict,
  unique (tenant_id,company_id,payroll_closing_id)
);

create index payroll_statutory_company_competence_idx
  on public.payroll_statutory_calculations(tenant_id,company_id,competence_month);

alter table public.payroll_statutory_calculations enable row level security;
create policy payroll_statutory_select_authorized on public.payroll_statutory_calculations
  for select to authenticated using (app_private.can_access_company(tenant_id,company_id));
revoke all on public.payroll_statutory_calculations from anon, authenticated;
grant select on public.payroll_statutory_calculations to authenticated;

create or replace function app_private.calculate_employee_inss_2026(p_base numeric)
returns numeric language plpgsql immutable set search_path='' as $$
declare b numeric := greatest(0,least(coalesce(p_base,0),8475.55)); v numeric := 0;
begin
  v := least(b,1621.00) * 0.075;
  if b > 1621.00 then v := v + (least(b,2902.84)-1621.00) * 0.09; end if;
  if b > 2902.84 then v := v + (least(b,4354.27)-2902.84) * 0.12; end if;
  if b > 4354.27 then v := v + (b-4354.27) * 0.14; end if;
  return round(greatest(v,0),2);
end; $$;

create or replace function app_private.calculate_irrf_table_2026(p_base numeric)
returns numeric language plpgsql immutable set search_path='' as $$
declare b numeric := greatest(0,coalesce(p_base,0)); v numeric;
begin
  v := case
    when b <= 2428.80 then 0
    when b <= 2826.65 then b*0.075-182.16
    when b <= 3751.05 then b*0.15-394.16
    when b <= 4664.68 then b*0.225-675.49
    else b*0.275-908.73 end;
  return round(greatest(v,0),2);
end; $$;

create or replace function app_private.calculate_irrf_reduction_2026(p_taxable_income numeric,p_tax numeric)
returns numeric language plpgsql immutable set search_path='' as $$
declare r numeric := 0; income numeric := greatest(0,coalesce(p_taxable_income,0)); tax numeric := greatest(0,coalesce(p_tax,0));
begin
  if income <= 5000 then r := least(tax,312.89);
  elsif income <= 7350 then r := greatest(0,978.62-(0.133145*income));
  end if;
  return round(least(tax,greatest(r,0)),2);
end; $$;

create or replace function app_private.calculate_payroll_statutory_impl(
  p_tenant_id uuid,p_company_id uuid,p_payroll_closing_id uuid,
  p_dependents integer default 0,p_other_legal_deductions numeric default 0
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid(); v_pc public.payroll_closings%rowtype; v_bases record;
  v_inss numeric(14,2); v_taxable numeric(14,2); v_legal numeric(14,2); v_simplified numeric(14,2):=607.20;
  v_deduction numeric(14,2); v_method text; v_irrf_base numeric(14,2); v_irrf_before numeric(14,2); v_reduction numeric(14,2); v_irrf numeric(14,2);
  v_fgts numeric(14,2); v_id uuid;
begin
  if v_user is null or not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized'; end if;
  if coalesce(p_dependents,0)<0 then raise exception 'dependents must be non-negative'; end if;
  if coalesce(p_other_legal_deductions,0)<0 then raise exception 'legal deductions must be non-negative'; end if;

  select * into v_pc from public.payroll_closings
   where tenant_id=p_tenant_id and company_id=p_company_id and id=p_payroll_closing_id and status='closed';
  if not found then raise exception 'closed payroll not found'; end if;
  if v_pc.competence_month < date '2026-01-01' or v_pc.competence_month >= date '2027-01-01' then raise exception '2026 ruleset only'; end if;

  select * into v_bases from public.payroll_closing_pre_statutory_bases
   where tenant_id=p_tenant_id and company_id=p_company_id and payroll_closing_id=p_payroll_closing_id;
  if v_bases.has_incidence_review_required then raise exception 'incidence review required before statutory calculation'; end if;

  v_inss := app_private.calculate_employee_inss_2026(v_bases.inss_base_pre_rule);
  v_taxable := v_bases.irrf_base_pre_rule;
  v_legal := round(v_inss + (coalesce(p_dependents,0)*189.59) + coalesce(p_other_legal_deductions,0),2);
  if v_simplified > v_legal then v_method:='simplified'; v_deduction:=v_simplified; else v_method:='legal'; v_deduction:=v_legal; end if;
  v_irrf_base := round(greatest(0,v_taxable-v_deduction),2);
  v_irrf_before := app_private.calculate_irrf_table_2026(v_irrf_base);
  v_reduction := app_private.calculate_irrf_reduction_2026(v_taxable,v_irrf_before);
  v_irrf := round(greatest(0,v_irrf_before-v_reduction),2);
  v_fgts := round(v_bases.fgts_base_pre_rule*0.08,2);

  insert into public.payroll_statutory_calculations(
    tenant_id,company_id,payroll_closing_id,competence_month,inss_base,inss_amount,
    irrf_taxable_income,irrf_deduction_method,irrf_deduction_amount,irrf_base,
    irrf_before_reduction,irrf_reduction,irrf_amount,fgts_base,fgts_rate,fgts_amount,ruleset,calculated_by
  ) values(
    p_tenant_id,p_company_id,p_payroll_closing_id,v_pc.competence_month,v_bases.inss_base_pre_rule,v_inss,
    v_taxable,v_method,v_deduction,v_irrf_base,v_irrf_before,v_reduction,v_irrf,
    v_bases.fgts_base_pre_rule,0.08,v_fgts,'BR-2026',v_user
  ) on conflict (tenant_id,company_id,payroll_closing_id) do update set
    inss_base=excluded.inss_base,inss_amount=excluded.inss_amount,
    irrf_taxable_income=excluded.irrf_taxable_income,irrf_deduction_method=excluded.irrf_deduction_method,
    irrf_deduction_amount=excluded.irrf_deduction_amount,irrf_base=excluded.irrf_base,
    irrf_before_reduction=excluded.irrf_before_reduction,irrf_reduction=excluded.irrf_reduction,irrf_amount=excluded.irrf_amount,
    fgts_base=excluded.fgts_base,fgts_rate=excluded.fgts_rate,fgts_amount=excluded.fgts_amount,
    ruleset=excluded.ruleset,calculated_at=now(),calculated_by=excluded.calculated_by
  returning id into v_id;

  insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(p_tenant_id,p_company_id,v_user,'payroll.statutory_calculated','payroll_closing',p_payroll_closing_id,
    jsonb_build_object('calculation_id',v_id,'ruleset','BR-2026','inss',v_inss,'irrf',v_irrf,'fgts',v_fgts));
  return v_id;
end; $$;

revoke all on function app_private.calculate_payroll_statutory_impl(uuid,uuid,uuid,integer,numeric) from public,anon;
grant execute on function app_private.calculate_payroll_statutory_impl(uuid,uuid,uuid,integer,numeric) to authenticated;
create or replace function public.calculate_payroll_statutory(
 p_tenant_id uuid,p_company_id uuid,p_payroll_closing_id uuid,p_dependents integer default 0,p_other_legal_deductions numeric default 0
) returns uuid language sql security invoker set search_path='' as $$
 select app_private.calculate_payroll_statutory_impl(p_tenant_id,p_company_id,p_payroll_closing_id,p_dependents,p_other_legal_deductions);
$$;
revoke all on function public.calculate_payroll_statutory(uuid,uuid,uuid,integer,numeric) from public,anon;
grant execute on function public.calculate_payroll_statutory(uuid,uuid,uuid,integer,numeric) to authenticated;

commit;
