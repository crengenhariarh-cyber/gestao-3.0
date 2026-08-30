begin;

insert into auth.users(id,email) values('17000000-0000-0000-0000-000000000001','hr53@example.invalid');
insert into public.tenants(id,name,slug) values('27000000-0000-0000-0000-000000000001','HR53 Tenant','hr53');
insert into public.companies(id,tenant_id,legal_name) values
('37000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001','Empresa A'),
('37000000-0000-0000-0000-000000000002','27000000-0000-0000-0000-000000000001','Empresa B');
insert into public.tenant_memberships(tenant_id,user_id,role) values('27000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000000000001','operator');
insert into public.company_memberships(tenant_id,company_id,user_id,role) values('27000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000000000001','manager');
insert into public.cost_centers(id,tenant_id,company_id,name) values
('47000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001','Obra A'),
('47000000-0000-0000-0000-000000000002','27000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000002','Obra B');
insert into public.employees(id,tenant_id,full_name) values('57000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001','Colaborador 5.3');
insert into public.employment_contracts(id,tenant_id,company_id,employee_id,hired_on,job_title) values('67000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001','57000000-0000-0000-0000-000000000001','2026-01-01','Ajudante');

set local role authenticated;
select set_config('request.jwt.claim.sub','17000000-0000-0000-0000-000000000001',true);

select * from public.record_payroll_event(
  '27000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001',
  '67000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000001',
  '2026-09-01','2026-09-15','advance',null,null,500.00,'Adiantamento','hr53-event-1'
);

select * from public.record_payroll_event(
  '27000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001',
  '67000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000001',
  '2026-09-01','2026-09-15','advance',null,null,500.00,'Retry','hr53-event-1'
);

do $$
declare c int;
begin
  select count(*) into c from public.payroll_events where tenant_id='27000000-0000-0000-0000-000000000001';
  if c<>1 then raise exception 'expected one payroll event, got %',c; end if;

  begin
    perform 1 from public.record_payroll_event(
      '27000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001',
      '67000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000001',
      '2026-09-01','2026-09-15','advance',null,null,600.00,'Conflict','hr53-event-1'
    );
    raise exception 'expected idempotency conflict';
  exception when others then
    if sqlerrm='expected idempotency conflict' then raise; end if;
    if position('idempotency key already used' in sqlerrm)=0 then raise; end if;
  end;

  begin
    perform 1 from public.record_payroll_event(
      '27000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001',
      '67000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000002',
      '2026-09-01','2026-09-15','benefit',null,null,100.00,'Wrong company','hr53-event-2'
    );
    raise exception 'expected cross-company rejection';
  exception when others then
    if sqlerrm='expected cross-company rejection' then raise; end if;
    if position('active cost center not found in company' in sqlerrm)=0 then raise; end if;
  end;
end $$;

reset role;

do $$
declare a int;
begin
  select count(*) into a from public.audit_log
  where tenant_id='27000000-0000-0000-0000-000000000001'
    and action='payroll_event.recorded';
  if a<>1 then raise exception 'expected one audit row, got %',a; end if;
end $$;

rollback;
