begin;
alter table public.measurements
  add column if not exists measurement_number text,
  add column if not exists due_date date,
  add column if not exists expected_payment_date date,
  add column if not exists payment_method text,
  add column if not exists origin_label text;

with numbered as (
  select id, lpad(row_number() over(partition by tenant_id,company_id,contract_id order by competence,created_at)::text,3,'0') as n
  from public.measurements
  where measurement_number is null or btrim(measurement_number)=''
)
update public.measurements m set measurement_number=numbered.n from numbered where numbered.id=m.id;

alter table public.measurements alter column measurement_number set not null;
create unique index if not exists measurements_contract_number_uq on public.measurements(tenant_id,company_id,contract_id,measurement_number);
create index if not exists measurements_due_date_idx on public.measurements(tenant_id,company_id,due_date) where status in ('closed','approved');
commit;