begin;

create table public.employee_profiles (
  employee_id uuid primary key,
  tenant_id uuid not null,
  cpf text,
  birth_date date,
  phone text,
  email text,
  postal_code text,
  address_line text,
  address_number text,
  address_extra text,
  district text,
  city text,
  state text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_profiles_employee_fk foreign key (tenant_id, employee_id) references public.employees(tenant_id,id) on delete cascade,
  constraint employee_profiles_cpf_ck check (cpf is null or cpf ~ '^[0-9]{11}$'),
  constraint employee_profiles_email_ck check (email is null or position('@' in email) > 1),
  constraint employee_profiles_state_ck check (state is null or length(state)=2)
);
create unique index employee_profiles_tenant_cpf_uidx on public.employee_profiles(tenant_id,cpf) where cpf is not null;
create index employee_profiles_tenant_employee_idx on public.employee_profiles(tenant_id,employee_id);
alter table public.employee_profiles enable row level security;
create policy employee_profiles_select on public.employee_profiles for select to authenticated using (app_private.can_access_employee(tenant_id,employee_id));
create policy employee_profiles_insert on public.employee_profiles for insert to authenticated with check (app_private.is_tenant_admin(tenant_id));
create policy employee_profiles_update on public.employee_profiles for update to authenticated using (app_private.is_tenant_admin(tenant_id)) with check (app_private.is_tenant_admin(tenant_id));
create policy employee_profiles_delete on public.employee_profiles for delete to authenticated using (app_private.is_tenant_admin(tenant_id));

create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  employment_contract_id uuid not null,
  document_type text not null,
  document_number text,
  issued_on date,
  expires_on date,
  status text not null default 'valid',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_documents_contract_fk foreign key(tenant_id,company_id,employment_contract_id) references public.employment_contracts(tenant_id,company_id,id) on delete cascade,
  constraint employee_documents_type_ck check(document_type in ('cpf','rg','cnh','ctps','pis','voter','military','aso','admission_contract','transport_declaration','salary_family','ir_declaration','epi_form','other')),
  constraint employee_documents_status_ck check(status in ('valid','expired','pending','replaced','cancelled')),
  constraint employee_documents_dates_ck check(expires_on is null or issued_on is null or expires_on>=issued_on)
);
create index employee_documents_contract_idx on public.employee_documents(tenant_id,company_id,employment_contract_id);
create index employee_documents_expiry_idx on public.employee_documents(tenant_id,company_id,expires_on) where expires_on is not null and status='valid';
create index employee_documents_created_by_idx on public.employee_documents(created_by);
alter table public.employee_documents enable row level security;
create policy employee_documents_select on public.employee_documents for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy employee_documents_insert on public.employee_documents for insert to authenticated with check(app_private.can_manage_company(tenant_id,company_id));
create policy employee_documents_update on public.employee_documents for update to authenticated using(app_private.can_manage_company(tenant_id,company_id)) with check(app_private.can_manage_company(tenant_id,company_id));
create policy employee_documents_delete on public.employee_documents for delete to authenticated using(app_private.can_manage_company(tenant_id,company_id));

create table public.employee_occurrences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  employment_contract_id uuid not null,
  occurrence_type text not null,
  starts_on date not null,
  ends_on date not null,
  days_count integer generated always as ((ends_on-starts_on)+1) stored,
  excused boolean not null default false,
  payroll_effect text not null default 'none',
  description text,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_occurrences_contract_fk foreign key(tenant_id,company_id,employment_contract_id) references public.employment_contracts(tenant_id,company_id,id) on delete restrict,
  constraint employee_occurrences_type_ck check(occurrence_type in ('medical_certificate','absence','leave','vacation','work_accident','suspension','warning','other')),
  constraint employee_occurrences_dates_ck check(ends_on>=starts_on),
  constraint employee_occurrences_payroll_ck check(payroll_effect in ('none','absence','dsr','manual_review')),
  constraint employee_occurrences_status_ck check(status in ('active','cancelled'))
);
create index employee_occurrences_contract_date_idx on public.employee_occurrences(tenant_id,company_id,employment_contract_id,starts_on,ends_on);
create index employee_occurrences_company_date_idx on public.employee_occurrences(tenant_id,company_id,starts_on,ends_on);
create index employee_occurrences_created_by_idx on public.employee_occurrences(created_by);
alter table public.employee_occurrences enable row level security;
create policy employee_occurrences_select on public.employee_occurrences for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy employee_occurrences_insert on public.employee_occurrences for insert to authenticated with check(app_private.can_manage_company(tenant_id,company_id));
create policy employee_occurrences_update on public.employee_occurrences for update to authenticated using(app_private.can_manage_company(tenant_id,company_id)) with check(app_private.can_manage_company(tenant_id,company_id));
create policy employee_occurrences_delete on public.employee_occurrences for delete to authenticated using(app_private.can_manage_company(tenant_id,company_id));

create view public.hr_employee_operational_overview with (security_invoker=true) as
select ec.tenant_id,ec.company_id,ec.id employment_contract_id,ec.employee_id,e.full_name,e.status employee_status,ec.job_title,ec.hired_on,ec.terminated_on,ec.status contract_status,ct.base_salary,
       coalesce((select sum(ea.allocation_percent) from public.employee_allocations ea where ea.tenant_id=ec.tenant_id and ea.company_id=ec.company_id and ea.employment_contract_id=ec.id and ea.valid_from<=current_date and (ea.valid_to is null or ea.valid_to>=current_date)),0)::numeric(7,2) current_allocation_percent,
       (select count(*) from public.employee_documents d where d.tenant_id=ec.tenant_id and d.company_id=ec.company_id and d.employment_contract_id=ec.id and d.status='pending')::bigint pending_documents,
       (select count(*) from public.employee_documents d where d.tenant_id=ec.tenant_id and d.company_id=ec.company_id and d.employment_contract_id=ec.id and d.status='valid' and d.expires_on is not null and d.expires_on<=current_date+30)::bigint documents_expiring_30d,
       (select count(*) from public.employee_occurrences o where o.tenant_id=ec.tenant_id and o.company_id=ec.company_id and o.employment_contract_id=ec.id and o.status='active' and current_date between o.starts_on and o.ends_on)::bigint active_occurrences
from public.employment_contracts ec
join public.employees e on e.tenant_id=ec.tenant_id and e.id=ec.employee_id
left join lateral (select c.base_salary from public.compensation_terms c where c.tenant_id=ec.tenant_id and c.company_id=ec.company_id and c.employment_contract_id=ec.id and c.valid_from<=current_date and (c.valid_to is null or c.valid_to>=current_date) order by c.valid_from desc limit 1) ct on true;

comment on table public.employee_profiles is 'Tenant-level personal/contact profile for an employee. Access follows employee authorization; mutation restricted to tenant administrators.';
comment on table public.employee_documents is 'Employment-scoped HR document metadata. File storage is intentionally separate.';
comment on table public.employee_occurrences is 'Operational HR occurrences such as medical certificates, absences, leave, vacation and disciplinary events.';

commit;
