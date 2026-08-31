create or replace function public.set_measurement_status(p_measurement_id uuid, p_action text, p_reason text default null::text)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  v public.measurements%rowtype;
begin
  select * into v
  from public.measurements
  where id = p_measurement_id
  for update;

  if not found or not app_private.can_edit_company(v.tenant_id, v.company_id) then
    raise exception 'measurement not found or inaccessible';
  end if;

  if p_action = 'close' then
    if v.status <> 'draft' then raise exception 'only draft can be closed'; end if;
    update public.measurements
      set status='closed', closed_at=now(), closed_by=auth.uid()
      where id=v.id;
  elsif p_action = 'approve' then
    if v.status <> 'closed' then raise exception 'only closed can be approved'; end if;
    update public.measurements set status='approved' where id=v.id;
  elsif p_action = 'reopen' then
    if v.status not in ('closed','approved') then raise exception 'only closed/approved can be reopened'; end if;
    if nullif(trim(p_reason),'') is null then raise exception 'reopen reason is required'; end if;
    if exists (
      select 1 from public.measurement_finance_links mfl
      where mfl.tenant_id=v.tenant_id and mfl.company_id=v.company_id and mfl.measurement_id=v.id
    ) then raise exception 'measurement already linked to finance and cannot be reopened'; end if;
    update public.measurements
      set status='draft', reopened_at=now(), reopened_by=auth.uid(), reopen_reason=p_reason
      where id=v.id;
    insert into public.measurement_reopen_log(tenant_id,company_id,measurement_id,reason,actor_user_id)
    values(v.tenant_id,v.company_id,v.id,p_reason,auth.uid());
  elsif p_action = 'cancel' then
    if v.status not in ('draft','closed','approved') then raise exception 'measurement cannot be cancelled from current status'; end if;
    if nullif(trim(p_reason),'') is null then raise exception 'cancel reason is required'; end if;
    if exists (
      select 1 from public.measurement_finance_links mfl
      where mfl.tenant_id=v.tenant_id and mfl.company_id=v.company_id and mfl.measurement_id=v.id
    ) then raise exception 'measurement already linked to finance and cannot be cancelled'; end if;
    update public.measurements
      set status='cancelled', notes=concat_ws(E'\n', nullif(notes,''), 'Cancelamento: ' || p_reason)
      where id=v.id;
  else
    raise exception 'invalid measurement action';
  end if;
end;
$function$;

create or replace function public.validate_contract_addendum_line()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_contract_id uuid;
  v_status text;
  v_service_contract_id uuid;
begin
  select a.contract_id, a.status into v_contract_id, v_status
  from public.contract_addenda a
  where a.tenant_id=new.tenant_id and a.company_id=new.company_id and a.id=new.addendum_id;
  if not found then raise exception 'addendum not found in company scope'; end if;
  if v_status <> 'draft' then raise exception 'only draft addenda can be edited'; end if;

  if new.contract_service_id is not null then
    select cs.contract_id into v_service_contract_id
    from public.contract_services cs
    where cs.tenant_id=new.tenant_id and cs.company_id=new.company_id and cs.id=new.contract_service_id;
    if not found or v_service_contract_id <> v_contract_id then
      raise exception 'contract service does not belong to addendum contract';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists contract_addendum_lines_validate on public.contract_addendum_lines;
create trigger contract_addendum_lines_validate
before insert or update on public.contract_addendum_lines
for each row execute function public.validate_contract_addendum_line();

create or replace function public.guard_provisional_contract_line_mutation()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_provisional_id uuid;
  v_status text;
begin
  v_provisional_id := case when tg_op='DELETE' then old.provisional_id else new.provisional_id end;
  select p.status into v_status
  from public.provisional_contracts p
  where p.id=v_provisional_id
    and p.tenant_id=case when tg_op='DELETE' then old.tenant_id else new.tenant_id end
    and p.company_id=case when tg_op='DELETE' then old.company_id else new.company_id end;
  if not found then raise exception 'provisional not found in company scope'; end if;
  if v_status in ('converted','cancelled') then raise exception 'converted/cancelled provisional is locked'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

drop trigger if exists provisional_contract_lines_mutation_guard on public.provisional_contract_lines;
create trigger provisional_contract_lines_mutation_guard
before insert or update or delete on public.provisional_contract_lines
for each row execute function public.guard_provisional_contract_line_mutation();
