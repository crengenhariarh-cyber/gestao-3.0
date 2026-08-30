begin;

insert into auth.users(id,email) values('18000000-0000-0000-0000-000000000001','hr55@example.invalid');
insert into public.tenants(id,name,slug) values('28000000-0000-0000-0000-000000000001','HR55 Tenant','hr55');
insert into public.companies(id,tenant_id,legal_name) values('38000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','Empresa A');
insert into public.tenant_memberships(tenant_id,user_id,role) values('28000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','operator');
insert into public.company_memberships(tenant_id,company_id,user_id,role) values('28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','manager');
insert into public.cost_centers(id,tenant_id,company_id,name) values('48000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','Obra A');
insert into public.employees(id,tenant_id,full_name) values('58000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','Colaborador 5.5');
insert into public.employment_contracts(id,tenant_id,company_id,employee_id,hired_on,job_title) values('68000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','58000000-0000-0000-0000-000000000001','2026-01-01','Ajudante');
insert into public.compensation_terms(tenant_id,company_id,employment_contract_id,valid_from,base_salary) values('28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','68000000-0000-0000-0000-000000000001','2026-01-01',2300.00);

set local role authenticated;
select set_config('request.jwt.claim.sub','18000000-0000-0000-0000-000000000001',true);

select * from public.record_payroll_event('28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','68000000-0000-0000-0000-000000000001','48000000-0000-0000-0000-000000000001','2026-09-01','2026-09-08','absence',1,null,100.00,'Falta','hr55-absence');
select * from public.record_payroll_event('28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','68000000-0000-0000-0000-000000000001','48000000-0000-0000-0000-000000000001','2026-09-01','2026-09-13','dsr',1,null,100.00,'DSR','hr55-dsr');
select * from public.record_payroll_event('28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','68000000-0000-0000-0000-000000000001','48000000-0000-0000-0000-000000000001','2026-09-01','2026-09-20','overtime',5,null,200.00,'Hora extra','hr55-overtime');

select public.close_payroll('28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','68000000-0000-0000-0000-000000000001','2026-09-01','hr55-close');

do $$
declare
  v_inss numeric; v_irrf numeric; v_fgts numeric; v_review boolean; v_absence int; v_dsr int;
begin
  select inss_base_pre_rule,irrf_base_pre_rule,fgts_base_pre_rule,has_incidence_review_required
    into v_inss,v_irrf,v_fgts,v_review
  from public.payroll_closing_pre_statutory_bases
  where tenant_id='28000000-0000-0000-0000-000000000001';

  if v_inss<>2300.00 or v_irrf<>2300.00 or v_fgts<>2300.00 then
    raise exception 'expected pre-rule bases 2300.00 after +200 overtime -100 absence -100 dsr, got %, %, %',v_inss,v_irrf,v_fgts;
  end if;
  if coalesce(v_review,false) then raise exception 'unexpected incidence review'; end if;

  select count(*) into v_absence from public.payroll_closing_event_snapshots where event_type='absence' and salary_effect='deduction' and affects_inss_base and affects_irrf_base and affects_fgts_base;
  select count(*) into v_dsr from public.payroll_closing_event_snapshots where event_type='dsr' and salary_effect='deduction' and affects_inss_base and affects_irrf_base and affects_fgts_base;
  if v_absence<>1 or v_dsr<>1 then raise exception 'absence/dsr incidence snapshot missing'; end if;

  begin
    perform 1 from public.record_payroll_event('28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','68000000-0000-0000-0000-000000000001','48000000-0000-0000-0000-000000000001','2026-09-01','2026-10-01','absence',1,null,100.00,'Fora da competência','hr55-invalid-date');
    raise exception 'expected competence date rejection';
  exception when others then
    if sqlerrm='expected competence date rejection' then raise; end if;
    if position('event date must belong to competence month' in sqlerrm)=0 then raise; end if;
  end;
end $$;

rollback;
