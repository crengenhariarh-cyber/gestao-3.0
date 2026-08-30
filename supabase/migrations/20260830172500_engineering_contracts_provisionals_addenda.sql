begin;

create function app_private.can_edit_company(target_tenant_id uuid, target_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_tenant_admin(target_tenant_id)
  or exists (
    select 1 from public.company_memberships cm
    where cm.tenant_id = target_tenant_id
      and cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and cm.role in ('company_admin','manager','operator')
  );
$$;
revoke all on function app_private.can_edit_company(uuid,uuid) from public, anon;
grant execute on function app_private.can_edit_company(uuid,uuid) to authenticated;

create table public.engineering_contracts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null, work_id uuid not null,
  contract_number text not null, client_name text, signed_at date, start_date date, end_date date,
  status text not null default 'draft' check (status in ('draft','active','suspended','completed','cancelled')),
  base_value numeric(16,2) not null default 0 check (base_value >= 0), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint engineering_contracts_work_fk foreign key (tenant_id,company_id,work_id) references public.works(tenant_id,company_id,id) on delete restrict,
  unique (tenant_id,company_id,id), unique (tenant_id,company_id,contract_number)
);

create table public.contract_services (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null, contract_id uuid not null,
  description text not null, unit text not null, contracted_quantity numeric(16,4) not null check (contracted_quantity >= 0),
  unit_price numeric(16,4) not null check (unit_price >= 0),
  line_total numeric(16,2) generated always as (round(contracted_quantity * unit_price,2)) stored,
  notes text, status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint contract_services_contract_fk foreign key (tenant_id,company_id,contract_id) references public.engineering_contracts(tenant_id,company_id,id) on delete restrict,
  unique (tenant_id,company_id,id)
);

create table public.provisional_contracts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null, work_id uuid not null,
  provisional_number text not null, title text, client_name text,
  status text not null default 'draft' check (status in ('draft','negotiation','approved','converted','cancelled')),
  notes text, converted_destination_type text check (converted_destination_type in ('contract','addendum')),
  converted_destination_id uuid, converted_at timestamptz, converted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint provisional_contracts_work_fk foreign key (tenant_id,company_id,work_id) references public.works(tenant_id,company_id,id) on delete restrict,
  unique (tenant_id,company_id,id), unique (tenant_id,company_id,work_id,provisional_number),
  constraint provisional_conversion_consistency check ((status='converted') = (converted_destination_type is not null and converted_destination_id is not null and converted_at is not null))
);

create table public.provisional_contract_lines (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null, provisional_id uuid not null,
  description text not null, unit text not null, quantity numeric(16,4) not null check (quantity >= 0),
  unit_price numeric(16,4) not null check (unit_price >= 0),
  line_total numeric(16,2) generated always as (round(quantity * unit_price,2)) stored,
  notes text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint provisional_lines_header_fk foreign key (tenant_id,company_id,provisional_id) references public.provisional_contracts(tenant_id,company_id,id) on delete restrict,
  unique (tenant_id,company_id,id)
);

create table public.contract_addenda (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null, contract_id uuid not null,
  addendum_number text not null, addendum_type text not null check (addendum_type in ('increase','reduction','adjustment')),
  effective_date date, status text not null default 'draft' check (status in ('draft','effective','cancelled')),
  stated_value numeric(16,2), notes text, source_provisional_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint contract_addenda_contract_fk foreign key (tenant_id,company_id,contract_id) references public.engineering_contracts(tenant_id,company_id,id) on delete restrict,
  constraint contract_addenda_source_provisional_fk foreign key (tenant_id,company_id,source_provisional_id) references public.provisional_contracts(tenant_id,company_id,id) on delete restrict,
  unique (tenant_id,company_id,id), unique (tenant_id,company_id,contract_id,addendum_number)
);

create table public.contract_addendum_lines (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null, addendum_id uuid not null,
  contract_service_id uuid, description text not null, unit text not null, quantity_delta numeric(16,4) not null,
  unit_price numeric(16,4) not null check (unit_price >= 0),
  line_total numeric(16,2) generated always as (round(quantity_delta * unit_price,2)) stored,
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint addendum_lines_addendum_fk foreign key (tenant_id,company_id,addendum_id) references public.contract_addenda(tenant_id,company_id,id) on delete restrict,
  constraint addendum_lines_service_fk foreign key (tenant_id,company_id,contract_service_id) references public.contract_services(tenant_id,company_id,id) on delete restrict,
  unique (tenant_id,company_id,id)
);

create index engineering_contracts_work_idx on public.engineering_contracts(tenant_id,company_id,work_id,status);
create index contract_services_contract_idx on public.contract_services(tenant_id,company_id,contract_id,status);
create index provisional_contracts_work_idx on public.provisional_contracts(tenant_id,company_id,work_id,status);
create index provisional_contract_lines_header_idx on public.provisional_contract_lines(tenant_id,company_id,provisional_id,sort_order);
create index contract_addenda_contract_idx on public.contract_addenda(tenant_id,company_id,contract_id,status);
create index contract_addenda_source_provisional_idx on public.contract_addenda(tenant_id,company_id,source_provisional_id);
create index contract_addendum_lines_addendum_idx on public.contract_addendum_lines(tenant_id,company_id,addendum_id);
create index contract_addendum_lines_service_idx on public.contract_addendum_lines(tenant_id,company_id,contract_service_id);

create trigger engineering_contracts_set_updated_at before update on public.engineering_contracts for each row execute function public.set_updated_at();
create trigger contract_services_set_updated_at before update on public.contract_services for each row execute function public.set_updated_at();
create trigger provisional_contracts_set_updated_at before update on public.provisional_contracts for each row execute function public.set_updated_at();
create trigger provisional_contract_lines_set_updated_at before update on public.provisional_contract_lines for each row execute function public.set_updated_at();
create trigger contract_addenda_set_updated_at before update on public.contract_addenda for each row execute function public.set_updated_at();
create trigger contract_addendum_lines_set_updated_at before update on public.contract_addendum_lines for each row execute function public.set_updated_at();

do $$ declare t text; begin
  foreach t in array array['engineering_contracts','contract_services','provisional_contracts','provisional_contract_lines','contract_addenda','contract_addendum_lines'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update on public.%I to authenticated',t);
    execute format('create policy %I_select on public.%I for select to authenticated using ((select app_private.can_access_company(tenant_id,company_id)))',t,t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check ((select app_private.can_edit_company(tenant_id,company_id)))',t,t);
    execute format('create policy %I_update on public.%I for update to authenticated using ((select app_private.can_edit_company(tenant_id,company_id))) with check ((select app_private.can_edit_company(tenant_id,company_id)))',t,t);
  end loop;
end $$;

create function public.convert_provisional_contract(p_provisional_id uuid,p_destination text,p_number text,p_contract_id uuid default null,p_addendum_type text default 'increase')
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_prov public.provisional_contracts%rowtype; v_destination_id uuid;
begin
  if p_destination not in ('contract','addendum') then raise exception 'invalid destination'; end if;
  select * into v_prov from public.provisional_contracts where id=p_provisional_id for update;
  if not found then raise exception 'provisional not found or inaccessible'; end if;
  if v_prov.status <> 'approved' then raise exception 'provisional must be approved before conversion'; end if;
  if p_destination='contract' then
    insert into public.engineering_contracts(tenant_id,company_id,work_id,contract_number,client_name,status,base_value,notes)
    values(v_prov.tenant_id,v_prov.company_id,v_prov.work_id,p_number,v_prov.client_name,'draft',0,v_prov.notes) returning id into v_destination_id;
    insert into public.contract_services(tenant_id,company_id,contract_id,description,unit,contracted_quantity,unit_price,notes)
    select tenant_id,company_id,v_destination_id,description,unit,quantity,unit_price,notes from public.provisional_contract_lines where provisional_id=v_prov.id order by sort_order,id;
    update public.engineering_contracts c set base_value=(select coalesce(sum(cs.line_total),0) from public.contract_services cs where cs.contract_id=c.id) where c.id=v_destination_id;
  else
    if p_contract_id is null then raise exception 'contract id is required for addendum conversion'; end if;
    perform 1 from public.engineering_contracts c where c.id=p_contract_id and c.tenant_id=v_prov.tenant_id and c.company_id=v_prov.company_id and c.work_id=v_prov.work_id;
    if not found then raise exception 'destination contract not found in same work/company'; end if;
    insert into public.contract_addenda(tenant_id,company_id,contract_id,addendum_number,addendum_type,status,notes,source_provisional_id)
    values(v_prov.tenant_id,v_prov.company_id,p_contract_id,p_number,p_addendum_type,'draft',v_prov.notes,v_prov.id) returning id into v_destination_id;
    insert into public.contract_addendum_lines(tenant_id,company_id,addendum_id,description,unit,quantity_delta,unit_price,notes)
    select tenant_id,company_id,v_destination_id,description,unit,quantity,unit_price,notes from public.provisional_contract_lines where provisional_id=v_prov.id order by sort_order,id;
  end if;
  update public.provisional_contracts set status='converted',converted_destination_type=p_destination,converted_destination_id=v_destination_id,converted_at=now(),converted_by=(select auth.uid()) where id=v_prov.id;
  return v_destination_id;
end; $$;
revoke all on function public.convert_provisional_contract(uuid,text,text,uuid,text) from public,anon;
grant execute on function public.convert_provisional_contract(uuid,text,text,uuid,text) to authenticated;

comment on table public.provisional_contracts is 'Editable negotiation; approved records convert once into contract or addendum.';
comment on function public.convert_provisional_contract(uuid,text,text,uuid,text) is 'Atomic conversion preserving provisional origin and caller RLS.';

commit;
