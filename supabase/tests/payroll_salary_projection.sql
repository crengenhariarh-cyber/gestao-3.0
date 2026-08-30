begin;

insert into auth.users(id,email) values('1a000000-0000-0000-0000-000000000001','hr58@example.invalid');
insert into public.tenants(id,name,slug) values('2a000000-0000-0000-0000-000000000001','HR58 Tenant','hr58');
insert into public.companies(id,tenant_id,legal_name) values('3a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','Empresa 5.8');
insert into public.tenant_memberships(tenant_id,user_id,role) values('2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000001','operator');
insert into public.company_memberships(tenant_id,company_id,user_id,role) values('2a000000-0000-0000-0000-000000000001','3a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000001','manager');
insert into public.cost_centers(id,tenant_id,company_id,name) values
('4a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','3a000000-0000-0000-0000-000000000001','Obra A'),
('4a000000-0000-0000-0000-000000000002','2a000000-0000-0000-0000-000000000001','3a000000-0000-0000-0000-000000000001','Obra B');
insert into public.employees(id,tenant_id,full_name) values('5a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','Colaborador Projeção');
insert into public.employment_contracts(id,tenant_id,company_id,employee_id,hired_on,job_title) values('6a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','3a000000-0000-0000-0000-000000000001','5a000000-0000-0000-0000-000000000001','2026-01-01','Ajudante');
insert into public.compensation_terms(tenant_id,company_id,employment_contract_id,valid_from,base_salary) values('2a000000-0000-0000-0000-000000000001','3a000000-0000-0000-0000-000000000001','6a000000-0000-0000-0000-000000000001','2026-01-01',3000.00);
insert into public.employee_allocations(tenant_id,company_id,employment_contract_id,cost_center_id,valid_from,allocation_percent) values
('2a000000-0000-0000-0000-000000000001','3a000000-0000-0000-0000-000000000001','6a000000-0000-0000-0000-000000000001','4a000000-0000-0000-0000-000000000001','2026-01-01',60.00),
('2a000000-0000-0000-0000-000000000001','3a000000-0000-0000-0000-000000000001','6a000000-0000-0000-0000-000000000001','4a000000-0000-0000-0000-000000000002','2026-01-01',40.00);
insert into public.payroll_closings(id,tenant_id,company_id,employment_contract_id,competence_month,base_salary_snapshot,events_credit_snapshot,events_debit_snapshot,gross_snapshot,net_before_statutory_snapshot,idempotency_key,closed_by)
values('7a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','3a000000-0000-0000-0000-000000000001','6a000000-0000-0000-0000-000000000001','2026-09-01',3000,300,0,3300,3300,'hr58-close','1a000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','1a000000-0000-0000-0000-000000000001',true);

do $$
declare
  sep_plan numeric; sep_real numeric; oct_plan numeric; oct_real numeric; rows_count integer;
begin
  select sum(planned_salary),sum(realized_salary) into sep_plan,sep_real
  from public.payroll_salary_projection('2a000000-0000-0000-0000-000000000001','3a000000-0000-0000-0000-000000000001','2026-09-01','2026-10-01')
  where competence_month='2026-09-01';
  select sum(planned_salary),sum(realized_salary) into oct_plan,oct_real
  from public.payroll_salary_projection('2a000000-0000-0000-0000-000000000001','3a000000-0000-0000-0000-000000000001','2026-09-01','2026-10-01')
  where competence_month='2026-10-01';
  select count(*) into rows_count
  from public.payroll_salary_projection('2a000000-0000-0000-0000-000000000001','3a000000-0000-0000-0000-000000000001','2026-09-01','2026-10-01');

  if sep_plan<>3000.00 or sep_real<>3300.00 then raise exception 'September projection mismatch planned %, realized %',sep_plan,sep_real; end if;
  if oct_plan<>3000.00 or oct_real<>0.00 then raise exception 'October projection mismatch planned %, realized %',oct_plan,oct_real; end if;
  if rows_count<>4 then raise exception 'expected four allocation/month rows, got %',rows_count; end if;
end $$;

rollback;
