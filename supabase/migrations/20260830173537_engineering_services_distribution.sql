begin;

create table public.engineering_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  code text,
  name text not null,
  default_unit text not null,
  category text,
  notes text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engineering_services_company_fk foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id) on delete restrict,
  unique (tenant_id, company_id, id)
);

create unique index engineering_services_code_uidx on public.engineering_services (tenant_id, company_id, code) where code is not null;
create index engineering_services_company_status_idx on public.engineering_services (tenant_id, company_id, status, name);

alter table public.contract_services add column service_id uuid;
alter table public.provisional_contract_lines add column service_id uuid;
alter table public.contract_addendum_lines add column service_id uuid;

alter table public.contract_services add constraint contract_services_master_service_fk foreign key (tenant_id, company_id, service_id) references public.engineering_services (tenant_id, company_id, id) on delete restrict;
alter table public.provisional_contract_lines add constraint provisional_lines_master_service_fk foreign key (tenant_id, company_id, service_id) references public.engineering_services (tenant_id, company_id, id) on delete restrict;
alter table public.contract_addendum_lines add constraint addendum_lines_master_service_fk foreign key (tenant_id, company_id, service_id) references public.engineering_services (tenant_id, company_id, id) on delete restrict;

create index contract_services_master_service_idx on public.contract_services (tenant_id, company_id, service_id);
create index provisional_lines_master_service_idx on public.provisional_contract_lines (tenant_id, company_id, service_id);
create index addendum_lines_master_service_idx on public.contract_addendum_lines (tenant_id, company_id, service_id);

create table public.contract_service_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  work_id uuid not null,
  contract_service_id uuid not null,
  structure_id uuid not null,
  allocated_quantity numeric(18,6) not null check (allocated_quantity > 0),
  notes text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_service_allocations_service_fk foreign key (tenant_id, company_id, contract_service_id) references public.contract_services (tenant_id, company_id, id) on delete restrict,
  constraint contract_service_allocations_structure_fk foreign key (tenant_id, company_id, work_id, structure_id) references public.work_structures (tenant_id, company_id, work_id, id) on delete restrict,
  unique (tenant_id, company_id, contract_service_id, structure_id),
  unique (tenant_id, company_id, id)
);

create index contract_service_allocations_structure_idx on public.contract_service_allocations (tenant_id, company_id, work_id, structure_id);
create index contract_service_allocations_service_idx on public.contract_service_allocations (tenant_id, company_id, contract_service_id, status);

create or replace function public.validate_contract_service_allocation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_work_id uuid;
  v_contracted_quantity numeric(18,6);
  v_allocated numeric(18,6);
begin
  select c.work_id, cs.contracted_quantity into v_work_id, v_contracted_quantity
  from public.contract_services cs
  join public.engineering_contracts c on c.tenant_id=cs.tenant_id and c.company_id=cs.company_id and c.id=cs.contract_id
  where cs.tenant_id=new.tenant_id and cs.company_id=new.company_id and cs.id=new.contract_service_id
  for update of cs;

  if not found then raise exception 'contract service not found in tenant/company scope'; end if;
  if new.work_id <> v_work_id then raise exception 'allocation structure must belong to the contract work'; end if;

  if new.status='active' then
    select coalesce(sum(a.allocated_quantity),0) into v_allocated
    from public.contract_service_allocations a
    where a.tenant_id=new.tenant_id and a.company_id=new.company_id and a.contract_service_id=new.contract_service_id and a.status='active' and a.id<>new.id;
    if v_allocated + new.allocated_quantity > v_contracted_quantity then
      raise exception 'allocated quantity (%) exceeds contracted quantity (%)', v_allocated + new.allocated_quantity, v_contracted_quantity;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_contract_service_allocation() from public, anon, authenticated;

create trigger contract_service_allocations_validate before insert or update on public.contract_service_allocations for each row execute function public.validate_contract_service_allocation();
create trigger engineering_services_set_updated_at before update on public.engineering_services for each row execute function public.set_updated_at();
create trigger contract_service_allocations_set_updated_at before update on public.contract_service_allocations for each row execute function public.set_updated_at();

alter table public.engineering_services enable row level security;
alter table public.contract_service_allocations enable row level security;

create policy engineering_services_select on public.engineering_services for select to authenticated using (app_private.can_access_company(tenant_id, company_id));
create policy engineering_services_insert on public.engineering_services for insert to authenticated with check (app_private.is_tenant_admin(tenant_id) or exists (select 1 from public.company_memberships cm where cm.tenant_id=engineering_services.tenant_id and cm.company_id=engineering_services.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator')));
create policy engineering_services_update on public.engineering_services for update to authenticated using (app_private.is_tenant_admin(tenant_id) or exists (select 1 from public.company_memberships cm where cm.tenant_id=engineering_services.tenant_id and cm.company_id=engineering_services.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator'))) with check (app_private.is_tenant_admin(tenant_id) or exists (select 1 from public.company_memberships cm where cm.tenant_id=engineering_services.tenant_id and cm.company_id=engineering_services.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator')));

create policy contract_service_allocations_select on public.contract_service_allocations for select to authenticated using (app_private.can_access_company(tenant_id, company_id));
create policy contract_service_allocations_insert on public.contract_service_allocations for insert to authenticated with check (app_private.is_tenant_admin(tenant_id) or exists (select 1 from public.company_memberships cm where cm.tenant_id=contract_service_allocations.tenant_id and cm.company_id=contract_service_allocations.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator')));
create policy contract_service_allocations_update on public.contract_service_allocations for update to authenticated using (app_private.is_tenant_admin(tenant_id) or exists (select 1 from public.company_memberships cm where cm.tenant_id=contract_service_allocations.tenant_id and cm.company_id=contract_service_allocations.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator'))) with check (app_private.is_tenant_admin(tenant_id) or exists (select 1 from public.company_memberships cm where cm.tenant_id=contract_service_allocations.tenant_id and cm.company_id=contract_service_allocations.company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('company_admin','manager','operator')));

create or replace function public.convert_provisional_contract(p_provisional_id uuid,p_destination text,p_number text,p_contract_id uuid default null,p_addendum_type text default 'increase')
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_prov public.provisional_contracts%rowtype;
  v_destination_id uuid;
begin
  if p_destination not in ('contract','addendum') then raise exception 'invalid destination'; end if;
  select * into v_prov from public.provisional_contracts where id=p_provisional_id for update;
  if not found then raise exception 'provisional not found or inaccessible'; end if;
  if v_prov.status <> 'approved' then raise exception 'provisional must be approved before conversion'; end if;
  if p_destination='contract' then
    insert into public.engineering_contracts(tenant_id,company_id,work_id,contract_number,client_name,status,base_value,notes)
    values(v_prov.tenant_id,v_prov.company_id,v_prov.work_id,p_number,v_prov.client_name,'draft',0,v_prov.notes) returning id into v_destination_id;
    insert into public.contract_services(tenant_id,company_id,contract_id,service_id,description,unit,contracted_quantity,unit_price,notes)
    select tenant_id,company_id,v_destination_id,service_id,description,unit,quantity,unit_price,notes from public.provisional_contract_lines where provisional_id=v_prov.id order by sort_order,id;
  else
    if p_contract_id is null then raise exception 'contract id is required for addendum conversion'; end if;
    perform 1 from public.engineering_contracts c where c.id=p_contract_id and c.tenant_id=v_prov.tenant_id and c.company_id=v_prov.company_id and c.work_id=v_prov.work_id;
    if not found then raise exception 'destination contract not found in same work/company'; end if;
    insert into public.contract_addenda(tenant_id,company_id,contract_id,addendum_number,addendum_type,status,notes,source_provisional_id)
    values(v_prov.tenant_id,v_prov.company_id,p_contract_id,p_number,p_addendum_type,'draft',v_prov.notes,v_prov.id) returning id into v_destination_id;
    insert into public.contract_addendum_lines(tenant_id,company_id,addendum_id,service_id,description,unit,quantity_delta,unit_price,notes)
    select tenant_id,company_id,v_destination_id,service_id,description,unit,quantity,unit_price,notes from public.provisional_contract_lines where provisional_id=v_prov.id order by sort_order,id;
  end if;
  update public.provisional_contracts set status='converted',converted_destination_type=p_destination,converted_destination_id=v_destination_id,converted_at=now(),converted_by=(select auth.uid()) where id=v_prov.id;
  return v_destination_id;
end;
$$;

comment on table public.engineering_services is 'Reusable engineering service catalog. Commercial price never belongs to this master.';
comment on table public.contract_service_allocations is 'Physical distribution of contracted quantities across work structure nodes.';

commit;
