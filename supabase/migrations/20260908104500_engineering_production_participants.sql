create table if not exists public.engineering_production_participants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  production_entry_id uuid not null,
  employment_contract_id uuid not null,
  percentage numeric(7,4) not null check (percentage > 0 and percentage <= 100),
  participant_value numeric(14,2) not null check (participant_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, company_id, production_entry_id, employment_contract_id),
  foreign key (tenant_id, company_id, production_entry_id) references public.engineering_production_entries(tenant_id, company_id, id) on delete cascade,
  foreign key (tenant_id, company_id, employment_contract_id) references public.employment_contracts(tenant_id, company_id, id) on delete restrict
);
create index if not exists engineering_production_participants_entry_idx on public.engineering_production_participants(tenant_id,company_id,production_entry_id);
create index if not exists engineering_production_participants_employee_idx on public.engineering_production_participants(tenant_id,company_id,employment_contract_id);
alter table public.engineering_production_participants enable row level security;
create policy engineering_production_participants_select on public.engineering_production_participants for select to authenticated using (app_private.can_access_company(tenant_id,company_id));
create policy engineering_production_participants_insert on public.engineering_production_participants for insert to authenticated with check (app_private.can_edit_company(tenant_id,company_id));
create policy engineering_production_participants_update on public.engineering_production_participants for update to authenticated using (app_private.can_edit_company(tenant_id,company_id)) with check (app_private.can_edit_company(tenant_id,company_id));
create policy engineering_production_participants_delete on public.engineering_production_participants for delete to authenticated using (app_private.can_edit_company(tenant_id,company_id));
insert into public.engineering_production_participants(tenant_id,company_id,production_entry_id,employment_contract_id,percentage,participant_value)
select e.tenant_id,e.company_id,e.id,e.employment_contract_id,100,coalesce(e.production_value,coalesce(e.unit_value,0)*e.executed_quantity)
from public.engineering_production_entries e
where not exists (select 1 from public.engineering_production_participants p where p.tenant_id=e.tenant_id and p.company_id=e.company_id and p.production_entry_id=e.id);
