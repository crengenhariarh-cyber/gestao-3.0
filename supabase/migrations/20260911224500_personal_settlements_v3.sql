begin;

create table public.personal_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  user_id uuid not null default auth.uid(),
  person_name text not null check (length(btrim(person_name)) between 1 and 160),
  direction text not null check (direction in ('i_owe','owes_me')),
  original_amount numeric(14,2) not null default 0 check (original_amount >= 0),
  started_on date not null default current_date,
  description text,
  notes text,
  status text not null default 'open' check (status in ('open','partial','settled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_settlements_company_fk foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id) on delete restrict
);

create table public.personal_settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.personal_settlements(id) on delete cascade,
  tenant_id uuid not null,
  company_id uuid not null,
  user_id uuid not null default auth.uid(),
  item_date date not null default current_date,
  description text not null check (length(btrim(description)) between 1 and 240),
  amount numeric(14,2) not null check (amount > 0),
  notes text,
  financial_entry_id uuid,
  financial_settlement_id uuid,
  financial_account_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_settlement_items_company_fk foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id) on delete restrict
);

create table public.personal_settlement_movements (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.personal_settlements(id) on delete cascade,
  tenant_id uuid not null,
  company_id uuid not null,
  user_id uuid not null default auth.uid(),
  movement_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  note text,
  financial_entry_id uuid,
  financial_settlement_id uuid,
  financial_account_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_settlement_movements_company_fk foreign key (tenant_id, company_id)
    references public.companies (tenant_id, id) on delete restrict
);

create index personal_settlements_scope_user_idx on public.personal_settlements(tenant_id, company_id, user_id, status, started_on desc);
create index personal_settlement_items_parent_idx on public.personal_settlement_items(settlement_id, item_date desc, created_at desc);
create index personal_settlement_movements_parent_idx on public.personal_settlement_movements(settlement_id, movement_date desc, created_at desc);

create trigger personal_settlements_set_updated_at before update on public.personal_settlements for each row execute function public.set_updated_at();
create trigger personal_settlement_items_set_updated_at before update on public.personal_settlement_items for each row execute function public.set_updated_at();
create trigger personal_settlement_movements_set_updated_at before update on public.personal_settlement_movements for each row execute function public.set_updated_at();

alter table public.personal_settlements enable row level security;
alter table public.personal_settlement_items enable row level security;
alter table public.personal_settlement_movements enable row level security;

create policy personal_settlements_select_own on public.personal_settlements for select to authenticated
using (auth.uid() = user_id and app_private.can_access_company(tenant_id, company_id));
create policy personal_settlement_items_select_own on public.personal_settlement_items for select to authenticated
using (auth.uid() = user_id and app_private.can_access_company(tenant_id, company_id)
  and exists (select 1 from public.personal_settlements s where s.id=settlement_id and s.user_id=auth.uid()));
create policy personal_settlement_movements_select_own on public.personal_settlement_movements for select to authenticated
using (auth.uid() = user_id and app_private.can_access_company(tenant_id, company_id)
  and exists (select 1 from public.personal_settlements s where s.id=settlement_id and s.user_id=auth.uid()));

revoke all on public.personal_settlements, public.personal_settlement_items, public.personal_settlement_movements from public, anon;
revoke insert, update, delete on public.personal_settlements, public.personal_settlement_items, public.personal_settlement_movements from authenticated;
grant select on public.personal_settlements, public.personal_settlement_items, public.personal_settlement_movements to authenticated;

create or replace function app_private.recompute_personal_settlement(p_settlement_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_total numeric(14,2); v_paid numeric(14,2);
begin
  select coalesce(sum(i.amount),0)::numeric(14,2) into v_total from public.personal_settlement_items i where i.settlement_id=p_settlement_id;
  select coalesce(sum(m.amount),0)::numeric(14,2) into v_paid from public.personal_settlement_movements m where m.settlement_id=p_settlement_id;
  update public.personal_settlements set original_amount=v_total,
    status=case when v_total>0 and v_paid>=v_total then 'settled' when v_paid>0 then 'partial' else 'open' end,
    updated_at=now() where id=p_settlement_id;
end;$$;
revoke all on function app_private.recompute_personal_settlement(uuid) from public, anon, authenticated;

create or replace function app_private.personal_settlement_category(p_tenant_id uuid,p_company_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_kind text; v_status text;
begin
  select id,kind,status into v_id,v_kind,v_status from public.financial_categories
   where tenant_id=p_tenant_id and company_id=p_company_id and lower(name)=lower('Acertos pessoais') limit 1;
  if v_id is null then
    insert into public.financial_categories(tenant_id,company_id,name,kind,status)
    values(p_tenant_id,p_company_id,'Acertos pessoais','both','active') returning id into v_id;
    return v_id;
  end if;
  if v_status<>'active' or v_kind not in ('both') then raise exception 'A categoria Acertos pessoais existe, mas não está ativa para receitas e despesas.'; end if;
  return v_id;
end;$$;
revoke all on function app_private.personal_settlement_category(uuid,uuid) from public, anon, authenticated;

create or replace function app_private.create_personal_finance_link(
  p_tenant_id uuid,p_company_id uuid,p_account_id uuid,p_event_date date,p_entry_type text,
  p_person_name text,p_description text,p_notes text,p_reference text)
returns table(financial_entry_id uuid, financial_settlement_id uuid, financial_account_id uuid)
language plpgsql security definer set search_path='' as $$
declare v_category uuid; v_entry uuid; v_installment uuid; v_fin_settlement uuid; v_amount numeric(14,2);
begin
  if p_entry_type not in ('income','expense') then raise exception 'invalid personal settlement financial type'; end if;
  if p_event_date is null or p_event_date>current_date then raise exception 'A movimentação bancária não pode ter data futura.'; end if;
  if not exists(select 1 from public.financial_accounts a where a.tenant_id=p_tenant_id and a.company_id=p_company_id and a.id=p_account_id and a.status='active') then raise exception 'Conta financeira ativa não encontrada.'; end if;
  v_amount := nullif(split_part(p_reference,'|',1),'')::numeric;
  if v_amount is null or v_amount<=0 then raise exception 'invalid personal settlement amount'; end if;
  v_category:=app_private.personal_settlement_category(p_tenant_id,p_company_id);
  select r.entry_id,r.installment_id into v_entry,v_installment from public.create_single_financial_entry(
    p_tenant_id,p_company_id,p_entry_type,
    'Acerto pessoal · '||btrim(p_person_name)||' · '||btrim(p_description),
    btrim(p_person_name),v_category,null,date_trunc('month',p_event_date)::date,p_event_date,v_amount,
    nullif(btrim(coalesce(p_notes,'')),'')
  ) r;
  select r.settlement_id into v_fin_settlement from public.record_financial_settlement(
    p_tenant_id,p_company_id,v_installment,p_account_id,p_event_date,v_amount,
    'personal-settlement:'||split_part(p_reference,'|',2),nullif(btrim(coalesce(p_notes,'')),'')
  ) r;
  return query select v_entry,v_fin_settlement,p_account_id;
end;$$;
revoke all on function app_private.create_personal_finance_link(uuid,uuid,uuid,date,text,text,text,text,text) from public, anon, authenticated;

create or replace function app_private.delete_personal_finance_link(p_tenant_id uuid,p_company_id uuid,p_entry_id uuid,p_financial_settlement_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_financial_settlement_id is not null then
    delete from public.financial_account_movements where tenant_id=p_tenant_id and company_id=p_company_id and source_type='settlement' and source_id=p_financial_settlement_id;
    delete from public.financial_settlements where tenant_id=p_tenant_id and company_id=p_company_id and id=p_financial_settlement_id;
  end if;
  if p_entry_id is not null then
    delete from public.financial_installments where tenant_id=p_tenant_id and company_id=p_company_id and entry_id=p_entry_id;
    delete from public.financial_entries where tenant_id=p_tenant_id and company_id=p_company_id and id=p_entry_id;
  end if;
end;$$;
revoke all on function app_private.delete_personal_finance_link(uuid,uuid,uuid,uuid) from public, anon, authenticated;

create or replace function public.create_personal_settlement(
  p_tenant_id uuid,p_company_id uuid,p_person_name text,p_direction text,p_started_on date,
  p_description text,p_amount numeric,p_notes text default null,p_account_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_settlement uuid; v_item uuid; v_type text; v_link record;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'company management permission required'; end if;
  if p_direction not in ('i_owe','owes_me') then raise exception 'Direção inválida.'; end if;
  if length(btrim(coalesce(p_person_name,'')))=0 then raise exception 'Informe a pessoa.'; end if;
  if p_started_on is null then raise exception 'Informe a data.'; end if;
  if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount then raise exception 'Informe um valor válido.'; end if;
  insert into public.personal_settlements(tenant_id,company_id,user_id,person_name,direction,started_on,description,notes)
  values(p_tenant_id,p_company_id,auth.uid(),btrim(p_person_name),p_direction,p_started_on,nullif(btrim(coalesce(p_description,'')),''),nullif(btrim(coalesce(p_notes,'')),'')) returning id into v_settlement;
  insert into public.personal_settlement_items(settlement_id,tenant_id,company_id,user_id,item_date,description,amount,notes)
  values(v_settlement,p_tenant_id,p_company_id,auth.uid(),p_started_on,coalesce(nullif(btrim(coalesce(p_description,'')),''),'Valor inicial'),p_amount,nullif(btrim(coalesce(p_notes,'')),'')) returning id into v_item;
  if p_account_id is not null then
    v_type:=case when p_direction='owes_me' then 'expense' else 'income' end;
    select * into v_link from app_private.create_personal_finance_link(p_tenant_id,p_company_id,p_account_id,p_started_on,v_type,p_person_name,coalesce(nullif(btrim(coalesce(p_description,'')),''),'Valor inicial'),p_notes,p_amount::text||'|'||v_item::text);
    update public.personal_settlement_items set financial_entry_id=v_link.financial_entry_id,financial_settlement_id=v_link.financial_settlement_id,financial_account_id=p_account_id where id=v_item;
  end if;
  perform app_private.recompute_personal_settlement(v_settlement);
  return v_settlement;
end;$$;

create or replace function public.add_personal_settlement_item(
 p_settlement_id uuid,p_item_date date,p_description text,p_amount numeric,p_notes text default null,p_account_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_parent public.personal_settlements%rowtype;v_item uuid;v_type text;v_link record;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into v_parent from public.personal_settlements where id=p_settlement_id and user_id=auth.uid() for update;
 if not found or not app_private.can_manage_company(v_parent.tenant_id,v_parent.company_id) then raise exception 'Acerto não encontrado ou sem permissão.'; end if;
 if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount then raise exception 'Informe um valor válido.'; end if;
 if length(btrim(coalesce(p_description,'')))=0 then raise exception 'Informe a descrição.'; end if;
 insert into public.personal_settlement_items(settlement_id,tenant_id,company_id,user_id,item_date,description,amount,notes)
 values(v_parent.id,v_parent.tenant_id,v_parent.company_id,auth.uid(),p_item_date,btrim(p_description),p_amount,nullif(btrim(coalesce(p_notes,'')),'')) returning id into v_item;
 if p_account_id is not null then
  v_type:=case when v_parent.direction='owes_me' then 'expense' else 'income' end;
  select * into v_link from app_private.create_personal_finance_link(v_parent.tenant_id,v_parent.company_id,p_account_id,p_item_date,v_type,v_parent.person_name,p_description,p_notes,p_amount::text||'|'||v_item::text);
  update public.personal_settlement_items set financial_entry_id=v_link.financial_entry_id,financial_settlement_id=v_link.financial_settlement_id,financial_account_id=p_account_id where id=v_item;
 end if;
 perform app_private.recompute_personal_settlement(v_parent.id);return v_item;
end;$$;

create or replace function public.update_personal_settlement_item(
 p_item_id uuid,p_item_date date,p_description text,p_amount numeric,p_notes text default null,p_account_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.personal_settlement_items%rowtype;v_parent public.personal_settlements%rowtype;v_paid numeric(14,2);v_other numeric(14,2);v_type text;v_link record;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into v_item from public.personal_settlement_items where id=p_item_id and user_id=auth.uid() for update;if not found then raise exception 'Item não encontrado.';end if;
 select * into v_parent from public.personal_settlements where id=v_item.settlement_id and user_id=auth.uid() for update;if not found or not app_private.can_manage_company(v_parent.tenant_id,v_parent.company_id) then raise exception 'Sem permissão.';end if;
 if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount then raise exception 'Informe um valor válido.';end if;
 select coalesce(sum(amount),0) into v_paid from public.personal_settlement_movements where settlement_id=v_parent.id;
 select coalesce(sum(amount),0) into v_other from public.personal_settlement_items where settlement_id=v_parent.id and id<>p_item_id;
 if v_other+p_amount<v_paid then raise exception 'O total dos itens não pode ficar abaixo do valor já abatido.';end if;
 perform app_private.delete_personal_finance_link(v_parent.tenant_id,v_parent.company_id,v_item.financial_entry_id,v_item.financial_settlement_id);
 update public.personal_settlement_items set item_date=p_item_date,description=btrim(p_description),amount=p_amount,notes=nullif(btrim(coalesce(p_notes,'')),''),financial_entry_id=null,financial_settlement_id=null,financial_account_id=null where id=p_item_id;
 if p_account_id is not null then
  v_type:=case when v_parent.direction='owes_me' then 'expense' else 'income' end;
  select * into v_link from app_private.create_personal_finance_link(v_parent.tenant_id,v_parent.company_id,p_account_id,p_item_date,v_type,v_parent.person_name,p_description,p_notes,p_amount::text||'|'||p_item_id::text);
  update public.personal_settlement_items set financial_entry_id=v_link.financial_entry_id,financial_settlement_id=v_link.financial_settlement_id,financial_account_id=p_account_id where id=p_item_id;
 end if;perform app_private.recompute_personal_settlement(v_parent.id);
end;$$;

create or replace function public.delete_personal_settlement_item(p_item_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.personal_settlement_items%rowtype;v_parent public.personal_settlements%rowtype;v_paid numeric(14,2);v_remaining numeric(14,2);
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into v_item from public.personal_settlement_items where id=p_item_id and user_id=auth.uid() for update;if not found then raise exception 'Item não encontrado.';end if;
 select * into v_parent from public.personal_settlements where id=v_item.settlement_id and user_id=auth.uid() for update;if not found or not app_private.can_manage_company(v_parent.tenant_id,v_parent.company_id) then raise exception 'Sem permissão.';end if;
 select coalesce(sum(amount),0) into v_paid from public.personal_settlement_movements where settlement_id=v_parent.id;
 select coalesce(sum(amount),0) into v_remaining from public.personal_settlement_items where settlement_id=v_parent.id and id<>p_item_id;
 if v_remaining<v_paid then raise exception 'Este item não pode ser excluído porque o total restante ficaria abaixo do valor já abatido.';end if;
 perform app_private.delete_personal_finance_link(v_parent.tenant_id,v_parent.company_id,v_item.financial_entry_id,v_item.financial_settlement_id);
 delete from public.personal_settlement_items where id=p_item_id;perform app_private.recompute_personal_settlement(v_parent.id);
end;$$;

create or replace function public.record_personal_settlement_movement(
 p_settlement_id uuid,p_movement_date date,p_amount numeric,p_note text,p_account_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_parent public.personal_settlements%rowtype;v_paid numeric(14,2);v_movement uuid;v_type text;v_link record;
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 select * into v_parent from public.personal_settlements where id=p_settlement_id and user_id=auth.uid() for update;if not found or not app_private.can_manage_company(v_parent.tenant_id,v_parent.company_id) then raise exception 'Acerto não encontrado ou sem permissão.';end if;
 if p_account_id is null then raise exception 'Selecione a conta da movimentação.';end if;
 select coalesce(sum(amount),0) into v_paid from public.personal_settlement_movements where settlement_id=v_parent.id;
 if p_amount is null or p_amount<=0 or v_paid+p_amount>v_parent.original_amount then raise exception 'O abatimento não pode ultrapassar o saldo do acerto.';end if;
 insert into public.personal_settlement_movements(settlement_id,tenant_id,company_id,user_id,movement_date,amount,note)
 values(v_parent.id,v_parent.tenant_id,v_parent.company_id,auth.uid(),p_movement_date,p_amount,nullif(btrim(coalesce(p_note,'')),'')) returning id into v_movement;
 v_type:=case when v_parent.direction='i_owe' then 'expense' else 'income' end;
 select * into v_link from app_private.create_personal_finance_link(v_parent.tenant_id,v_parent.company_id,p_account_id,p_movement_date,v_type,v_parent.person_name,case when v_parent.direction='i_owe' then 'Pagamento do acerto' else 'Recebimento do acerto' end,p_note,p_amount::text||'|'||v_movement::text);
 update public.personal_settlement_movements set financial_entry_id=v_link.financial_entry_id,financial_settlement_id=v_link.financial_settlement_id,financial_account_id=p_account_id where id=v_movement;
 perform app_private.recompute_personal_settlement(v_parent.id);return v_movement;
end;$$;

create or replace function public.update_personal_settlement_movement(
 p_movement_id uuid,p_movement_date date,p_amount numeric,p_note text,p_account_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_move public.personal_settlement_movements%rowtype;v_parent public.personal_settlements%rowtype;v_other numeric(14,2);v_type text;v_link record;
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 select * into v_move from public.personal_settlement_movements where id=p_movement_id and user_id=auth.uid() for update;if not found then raise exception 'Movimentação não encontrada.';end if;
 select * into v_parent from public.personal_settlements where id=v_move.settlement_id and user_id=auth.uid() for update;if not found or not app_private.can_manage_company(v_parent.tenant_id,v_parent.company_id) then raise exception 'Sem permissão.';end if;
 select coalesce(sum(amount),0) into v_other from public.personal_settlement_movements where settlement_id=v_parent.id and id<>p_movement_id;
 if p_account_id is null then raise exception 'Selecione a conta da movimentação.';end if;
 if p_amount is null or p_amount<=0 or v_other+p_amount>v_parent.original_amount then raise exception 'O abatimento não pode ultrapassar o saldo do acerto.';end if;
 perform app_private.delete_personal_finance_link(v_parent.tenant_id,v_parent.company_id,v_move.financial_entry_id,v_move.financial_settlement_id);
 update public.personal_settlement_movements set movement_date=p_movement_date,amount=p_amount,note=nullif(btrim(coalesce(p_note,'')),''),financial_entry_id=null,financial_settlement_id=null,financial_account_id=null where id=p_movement_id;
 v_type:=case when v_parent.direction='i_owe' then 'expense' else 'income' end;
 select * into v_link from app_private.create_personal_finance_link(v_parent.tenant_id,v_parent.company_id,p_account_id,p_movement_date,v_type,v_parent.person_name,case when v_parent.direction='i_owe' then 'Pagamento do acerto' else 'Recebimento do acerto' end,p_note,p_amount::text||'|'||p_movement_id::text);
 update public.personal_settlement_movements set financial_entry_id=v_link.financial_entry_id,financial_settlement_id=v_link.financial_settlement_id,financial_account_id=p_account_id where id=p_movement_id;
 perform app_private.recompute_personal_settlement(v_parent.id);
end;$$;

create or replace function public.delete_personal_settlement_movement(p_movement_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_move public.personal_settlement_movements%rowtype;v_parent public.personal_settlements%rowtype;
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 select * into v_move from public.personal_settlement_movements where id=p_movement_id and user_id=auth.uid() for update;if not found then raise exception 'Movimentação não encontrada.';end if;
 select * into v_parent from public.personal_settlements where id=v_move.settlement_id and user_id=auth.uid() for update;if not found or not app_private.can_manage_company(v_parent.tenant_id,v_parent.company_id) then raise exception 'Sem permissão.';end if;
 perform app_private.delete_personal_finance_link(v_parent.tenant_id,v_parent.company_id,v_move.financial_entry_id,v_move.financial_settlement_id);
 delete from public.personal_settlement_movements where id=p_movement_id;perform app_private.recompute_personal_settlement(v_parent.id);
end;$$;

create or replace function public.delete_personal_settlement(p_settlement_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_parent public.personal_settlements%rowtype;
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 select * into v_parent from public.personal_settlements where id=p_settlement_id and user_id=auth.uid() for update;if not found then raise exception 'Acerto não encontrado.';end if;
 if not app_private.can_manage_company(v_parent.tenant_id,v_parent.company_id) then raise exception 'Sem permissão.';end if;
 -- Paridade com o Gestão 2.0: excluir o acerto privado não apaga o histórico bancário já realizado.
 delete from public.personal_settlements where id=p_settlement_id;
end;$$;

revoke all on function public.create_personal_settlement(uuid,uuid,text,text,date,text,numeric,text,uuid) from public, anon;
revoke all on function public.add_personal_settlement_item(uuid,date,text,numeric,text,uuid) from public, anon;
revoke all on function public.update_personal_settlement_item(uuid,date,text,numeric,text,uuid) from public, anon;
revoke all on function public.delete_personal_settlement_item(uuid) from public, anon;
revoke all on function public.record_personal_settlement_movement(uuid,date,numeric,text,uuid) from public, anon;
revoke all on function public.update_personal_settlement_movement(uuid,date,numeric,text,uuid) from public, anon;
revoke all on function public.delete_personal_settlement_movement(uuid) from public, anon;
revoke all on function public.delete_personal_settlement(uuid) from public, anon;
grant execute on function public.create_personal_settlement(uuid,uuid,text,text,date,text,numeric,text,uuid) to authenticated;
grant execute on function public.add_personal_settlement_item(uuid,date,text,numeric,text,uuid) to authenticated;
grant execute on function public.update_personal_settlement_item(uuid,date,text,numeric,text,uuid) to authenticated;
grant execute on function public.delete_personal_settlement_item(uuid) to authenticated;
grant execute on function public.record_personal_settlement_movement(uuid,date,numeric,text,uuid) to authenticated;
grant execute on function public.update_personal_settlement_movement(uuid,date,numeric,text,uuid) to authenticated;
grant execute on function public.delete_personal_settlement_movement(uuid) to authenticated;
grant execute on function public.delete_personal_settlement(uuid) to authenticated;

comment on table public.personal_settlements is 'Private user-owned personal settlement header scoped to the Pessoal company.';
comment on function public.delete_personal_settlement(uuid) is 'Deletes private settlement bookkeeping while preserving already-posted financial ledger history, matching Gestão 2.0 behavior.';

commit;
