begin;

insert into auth.users(id,email) values('19000000-0000-0000-0000-000000000001','hr57@example.invalid');
insert into public.tenants(id,name,slug) values('29000000-0000-0000-0000-000000000001','HR57 Tenant','hr57');
insert into public.companies(id,tenant_id,legal_name) values('39000000-0000-0000-0000-000000000001','29000000-0000-0000-0000-000000000001','Empresa 5.7');
insert into public.tenant_memberships(tenant_id,user_id,role) values('29000000-0000-0000-0000-000000000001','19000000-0000-0000-0000-000000000001','operator');
insert into public.company_memberships(tenant_id,company_id,user_id,role) values('29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','19000000-0000-0000-0000-000000000001','manager');

insert into public.financial_categories(id,tenant_id,company_id,name,kind) values
('49000000-0000-0000-0000-000000000001','29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','Salários','expense'),
('49000000-0000-0000-0000-000000000002','29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','FGTS','expense'),
('49000000-0000-0000-0000-000000000003','29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','INSS Retido','expense'),
('49000000-0000-0000-0000-000000000004','29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','IRRF','expense');

insert into public.employees(id,tenant_id,full_name) values
('59000000-0000-0000-0000-000000000001','29000000-0000-0000-0000-000000000001','Colaborador A'),
('59000000-0000-0000-0000-000000000002','29000000-0000-0000-0000-000000000001','Colaborador B');
insert into public.employment_contracts(id,tenant_id,company_id,employee_id,hired_on,job_title) values
('69000000-0000-0000-0000-000000000001','29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','59000000-0000-0000-0000-000000000001','2026-01-01','Ajudante'),
('69000000-0000-0000-0000-000000000002','29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','59000000-0000-0000-0000-000000000002','2026-01-01','Ajudante');

insert into public.payroll_closings(
  id,tenant_id,company_id,employment_contract_id,competence_month,base_salary_snapshot,
  events_credit_snapshot,events_debit_snapshot,gross_snapshot,net_before_statutory_snapshot,idempotency_key,closed_by
) values
('79000000-0000-0000-0000-000000000001','29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','69000000-0000-0000-0000-000000000001','2026-09-01',2300,0,300,2300,2000,'hr57-close-a','19000000-0000-0000-0000-000000000001'),
('79000000-0000-0000-0000-000000000002','29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','69000000-0000-0000-0000-000000000002','2026-09-01',2100,0,300,2100,1800,'hr57-close-b','19000000-0000-0000-0000-000000000001');

insert into public.payroll_statutory_calculations(
  id,tenant_id,company_id,payroll_closing_id,competence_month,inss_base,inss_amount,
  irrf_taxable_income,irrf_deduction_method,irrf_deduction_amount,irrf_base,irrf_before_reduction,irrf_reduction,irrf_amount,
  fgts_base,fgts_rate,fgts_amount,ruleset,calculated_by
) values(
'89000000-0000-0000-0000-000000000001','29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000001','2026-09-01',2300,100,2300,'legal',100,2200,50,0,50,2000,0.08,160,'BR-2026','19000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',true);
select public.configure_payroll_finance(
  '29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001',
  '49000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000002',
  '49000000-0000-0000-0000-000000000003','49000000-0000-0000-0000-000000000004'
);

do $$
begin
  begin
    perform 1 from public.sync_payroll_accounts_payable(
      '29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','2026-09-01',
      '2026-10-05','2026-10-20','2026-10-20','2026-10-20'
    );
    raise exception 'expected incomplete statutory rejection';
  exception when others then
    if sqlerrm='expected incomplete statutory rejection' then raise; end if;
    if position('all closed payrolls must have statutory calculation' in sqlerrm)=0 then raise; end if;
  end;
end $$;

reset role;
insert into public.payroll_statutory_calculations(
  id,tenant_id,company_id,payroll_closing_id,competence_month,inss_base,inss_amount,
  irrf_taxable_income,irrf_deduction_method,irrf_deduction_amount,irrf_base,irrf_before_reduction,irrf_reduction,irrf_amount,
  fgts_base,fgts_rate,fgts_amount,ruleset,calculated_by
) values(
'89000000-0000-0000-0000-000000000002','29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000002','2026-09-01',2100,90,2100,'legal',90,2010,10,0,10,1900,0.08,152,'BR-2026','19000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',true);
select * from public.sync_payroll_accounts_payable(
  '29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','2026-09-01',
  '2026-10-05','2026-10-20','2026-10-20','2026-10-20'
);
select * from public.sync_payroll_accounts_payable(
  '29000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','2026-09-01',
  '2026-10-05','2026-10-20','2026-10-20','2026-10-20'
);
reset role;

do $$
declare e integer; l integer; s numeric; f numeric; i numeric; r numeric;
begin
  select count(*) into e from public.financial_entries where tenant_id='29000000-0000-0000-0000-000000000001' and company_id='39000000-0000-0000-0000-000000000001';
  select count(*) into l from public.payroll_finance_links where tenant_id='29000000-0000-0000-0000-000000000001' and company_id='39000000-0000-0000-0000-000000000001';
  if e<>5 or l<>5 then raise exception 'expected 5 idempotent payables/links, entries %, links %',e,l; end if;
  select sum(generated_amount) filter(where source_kind='net_salary'),sum(generated_amount) filter(where source_kind='fgts'),sum(generated_amount) filter(where source_kind='inss_employee'),sum(generated_amount) filter(where source_kind='irrf') into s,f,i,r
  from public.payroll_finance_links where tenant_id='29000000-0000-0000-0000-000000000001' and company_id='39000000-0000-0000-0000-000000000001';
  if s<>3550.00 then raise exception 'salary total expected 3550, got %',s; end if;
  if f<>312.00 then raise exception 'FGTS consolidated expected 312, got %',f; end if;
  if i<>190.00 then raise exception 'INSS employee consolidated expected 190, got %',i; end if;
  if r<>60.00 then raise exception 'IRRF consolidated expected 60, got %',r; end if;
  if (select count(*) from public.payroll_finance_links where source_kind='fgts')<>1 then raise exception 'FGTS must be one company/competence payable'; end if;
  if exists(select 1 from public.financial_installments where tenant_id='29000000-0000-0000-0000-000000000001' and competence_month<>'2026-09-01') then raise exception 'payroll installment competence mismatch'; end if;
end $$;

rollback;
