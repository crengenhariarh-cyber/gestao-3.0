begin;

insert into auth.users(id,email) values ('11111111-1111-1111-1111-111111111111','t@x.invalid');
insert into public.tenants(id,name,slug) values ('22222222-2222-2222-2222-222222222222','T','t-close');
insert into public.companies(id,tenant_id,legal_name) values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','A');
insert into public.tenant_memberships(tenant_id,user_id,role) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','operator');
insert into public.company_memberships(tenant_id,company_id,user_id,role) values ('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','manager');
insert into public.cost_centers(id,tenant_id,company_id,name) values ('44444444-4444-4444-4444-444444444444','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','Obra');
insert into public.employees(id,tenant_id,full_name) values ('55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222','Colaborador Teste');
insert into public.employment_contracts(id,tenant_id,company_id,employee_id,hired_on,job_title) values ('66666666-6666-6666-6666-666666666666','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','2026-01-01','A');
insert into public.compensation_terms(tenant_id,company_id,employment_contract_id,valid_from,base_salary) values ('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','66666666-6666-6666-6666-666666666666','2026-01-01',2300);

insert into public.payroll_events(tenant_id,company_id,employment_contract_id,cost_center_id,competence_month,event_kind,amount,idempotency_key,status,created_by,voided_by,voided_at) values
('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','66666666-6666-6666-6666-666666666666','44444444-4444-4444-4444-444444444444','2026-08-01','benefit',100,'e1','active','11111111-1111-1111-1111-111111111111',null,null),
('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','66666666-6666-6666-6666-666666666666','44444444-4444-4444-4444-444444444444','2026-08-01','overtime',200,'e2','active','11111111-1111-1111-1111-111111111111',null,null),
('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','66666666-6666-6666-6666-666666666666','44444444-4444-4444-4444-444444444444','2026-08-01','advance',500,'e3','active','11111111-1111-1111-1111-111111111111',null,null),
('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','66666666-6666-6666-6666-666666666666','44444444-4444-4444-4444-444444444444','2026-08-01','absence',100,'e4','active','11111111-1111-1111-1111-111111111111',null,null),
('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','66666666-6666-6666-6666-666666666666','44444444-4444-4444-4444-444444444444','2026-08-01','adjustment_earning',999,'e5','voided','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',now());

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
select public.close_payroll('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','66666666-6666-6666-6666-666666666666','2026-08-01','k1');
select public.close_payroll('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','66666666-6666-6666-6666-666666666666','2026-08-01','k1');
reset role;

do $$
declare
  r public.payroll_closings%rowtype;
  n int;
begin
  select * into r from public.payroll_closings where idempotency_key='k1';
  if r.base_salary_snapshot<>2300
     or r.events_credit_snapshot<>300
     or r.events_debit_snapshot<>600
     or r.gross_snapshot<>2600
     or r.net_before_statutory_snapshot<>2000 then
    raise exception 'payroll closing math mismatch';
  end if;

  select count(*) into n from public.payroll_closing_event_snapshots where payroll_closing_id=r.id;
  if n<>4 then raise exception 'expected 4 active event snapshots, got %',n; end if;

  select count(*) into n from public.payroll_closings where idempotency_key='k1';
  if n<>1 then raise exception 'idempotent retry duplicated payroll closing'; end if;

  select count(*) into n from public.audit_log where entity_id=r.id and action='payroll.closed';
  if n<>1 then raise exception 'expected one payroll.closed audit event, got %',n; end if;
end $$;

rollback;
