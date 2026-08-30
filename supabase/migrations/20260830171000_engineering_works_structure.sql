begin;

create table public.works (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  name text not null,
  code text,
  client_name text,
  address text,
  city text,
  state text,
  planned_start_date date,
  planned_end_date date,
  responsible_name text,
  status text not null default 'planning' check (status in ('planning','active','paused','completed','archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint works_company_fk foreign key (tenant_id, company_id) references public.companies (tenant_id, id) on delete restrict,
  unique (tenant_id, company_id, id),
  unique (tenant_id, company_id, code)
);

create table public.work_structures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  work_id uuid not null,
  parent_id uuid,
  structure_type text not null check (structure_type in ('tower','block','sector','quad','floor','unit','house','area','basement','ground_floor','roof','other')),
  code text,
  name text not null,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_structures_work_fk foreign key (tenant_id, company_id, work_id) references public.works (tenant_id, company_id, id) on delete restrict,
  unique (tenant_id, company_id, work_id, id)
);

alter table public.work_structures add constraint work_structures_parent_fk foreign key (tenant_id, company_id, work_id, parent_id) references public.work_structures (tenant_id, company_id, work_id, id) on delete restrict;
create index works_company_status_idx on public.works (tenant_id, company_id, status);
create index work_structures_tree_idx on public.work_structures (tenant_id, company_id, work_id, parent_id, sort_order);
create trigger works_set_updated_at before update on public.works for each row execute function public.set_updated_at();
create trigger work_structures_set_updated_at before update on public.work_structures for each row execute function public.set_updated_at();
alter table public.works enable row level security;
alter table public.work_structures enable row level security;

create policy works_select on public.works for select to authenticated using (exists (select 1 from public.company_memberships cm where cm.tenant_id=works.tenant_id and cm.company_id=works.company_id and cm.user_id=(select auth.uid()) and cm.status='active') or exists (select 1 from public.tenant_memberships tm where tm.tenant_id=works.tenant_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role in ('tenant_owner','tenant_admin')));
create policy works_insert on public.works for insert to authenticated with check (exists (select 1 from public.company_memberships cm where cm.tenant_id=works.tenant_id and cm.company_id=works.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator')) or exists (select 1 from public.tenant_memberships tm where tm.tenant_id=works.tenant_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role in ('tenant_owner','tenant_admin')));
create policy works_update on public.works for update to authenticated using (exists (select 1 from public.company_memberships cm where cm.tenant_id=works.tenant_id and cm.company_id=works.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator')) or exists (select 1 from public.tenant_memberships tm where tm.tenant_id=works.tenant_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role in ('tenant_owner','tenant_admin'))) with check (exists (select 1 from public.company_memberships cm where cm.tenant_id=works.tenant_id and cm.company_id=works.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator')) or exists (select 1 from public.tenant_memberships tm where tm.tenant_id=works.tenant_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role in ('tenant_owner','tenant_admin')));
create policy work_structures_select on public.work_structures for select to authenticated using (exists (select 1 from public.company_memberships cm where cm.tenant_id=work_structures.tenant_id and cm.company_id=work_structures.company_id and cm.user_id=(select auth.uid()) and cm.status='active') or exists (select 1 from public.tenant_memberships tm where tm.tenant_id=work_structures.tenant_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role in ('tenant_owner','tenant_admin')));
create policy work_structures_insert on public.work_structures for insert to authenticated with check (exists (select 1 from public.company_memberships cm where cm.tenant_id=work_structures.tenant_id and cm.company_id=work_structures.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator')) or exists (select 1 from public.tenant_memberships tm where tm.tenant_id=work_structures.tenant_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role in ('tenant_owner','tenant_admin')));
create policy work_structures_update on public.work_structures for update to authenticated using (exists (select 1 from public.company_memberships cm where cm.tenant_id=work_structures.tenant_id and cm.company_id=work_structures.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator')) or exists (select 1 from public.tenant_memberships tm where tm.tenant_id=work_structures.tenant_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role in ('tenant_owner','tenant_admin'))) with check (exists (select 1 from public.company_memberships cm where cm.tenant_id=work_structures.tenant_id and cm.company_id=work_structures.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator')) or exists (select 1 from public.tenant_memberships tm where tm.tenant_id=work_structures.tenant_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role in ('tenant_owner','tenant_admin')));
comment on table public.works is 'Engineering work/project. Physical root independent from contracts.';
comment on table public.work_structures is 'Reusable hierarchical physical structure for a work.';
commit;
