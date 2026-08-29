begin;

insert into auth.users (id, email)
values ('13000000-0000-0000-0000-000000000001', 'recurrence-test@example.invalid');

insert into public.tenants (id, name, slug)
values ('23000000-0000-0000-0000-000000000001', 'Recurrence Tenant', 'recurrence-tenant');

insert into public.companies (id, tenant_id, legal_name)
values ('33000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', 'Recurrence Company');

insert into public.tenant_memberships (tenant_id, user_id, role)
values ('23000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'operator');

insert into public.company_memberships (tenant_id, company_id, user_id, role)
values ('23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'manager');

insert into public.financial_categories (id, tenant_id, company_id, name, kind)
values ('43000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', 'Recorrente', 'expense');

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);

insert into public.financial_recurrence_rules (
  id, tenant_id, company_id, entry_type, description, category_id, amount,
  start_date, next_occurrence_date, day_of_month, interval_count
) values (
  '53000000-0000-0000-0000-000000000001',
  '23000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  'expense', 'Aluguel recorrente',
  '43000000-0000-0000-0000-000000000001',
  1000.00,
  '2027-01-31', '2027-01-31', 31, 1
);

select * from public.materialize_next_financial_recurrence('53000000-0000-0000-0000-000000000001');
select * from public.materialize_next_financial_recurrence('53000000-0000-0000-0000-000000000001');
select * from public.materialize_next_financial_recurrence('53000000-0000-0000-0000-000000000001');

do $$
declare
  entry_count integer;
  occurrence_count integer;
  february date;
  march date;
begin
  select count(*) into entry_count from public.financial_entries;
  select count(*) into occurrence_count from public.financial_recurrence_occurrences;
  select occurrence_date into february
    from public.financial_recurrence_occurrences
    where recurrence_rule_id = '53000000-0000-0000-0000-000000000001'
    order by occurrence_date offset 1 limit 1;
  select occurrence_date into march
    from public.financial_recurrence_occurrences
    where recurrence_rule_id = '53000000-0000-0000-0000-000000000001'
    order by occurrence_date offset 2 limit 1;

  if entry_count <> 3 then raise exception 'expected three independent entries, got %', entry_count; end if;
  if occurrence_count <> 3 then raise exception 'expected three recurrence occurrences, got %', occurrence_count; end if;
  if february <> date '2027-02-28' then raise exception 'expected clamped February date, got %', february; end if;
  if march <> date '2027-03-31' then raise exception 'anchor day must recover in March, got %', march; end if;
end $$;

rollback;
