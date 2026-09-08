begin;

-- Paridade Gestão 2.0 x 3.0: fortalece a gravação de linhas de medição.
-- Objetivos:
-- 1) preservar preço snapshot para contrato e aditivo;
-- 2) validar saldo no banco para ambas as origens;
-- 3) impedir referências duplicadas/reutilizadas em medições ativas;
-- 4) tentar vincular a unidade física real em work_structures;
-- 5) manter a substituição de uma etapa atômica e auditável.

create or replace function public.validate_measurement_line()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_contract uuid;
  v_work uuid;
  v_price numeric(18,6);
  v_qty numeric(18,6);
  v_prev numeric(18,6);
  v_status text;
  v_structure_work uuid;
begin
  select m.contract_id,m.status
    into v_contract,v_status
  from public.measurements m
  where m.tenant_id=new.tenant_id
    and m.company_id=new.company_id
    and m.id=new.measurement_id;

  if not found then
    raise exception 'measurement not found';
  end if;
  if v_status<>'draft' then
    raise exception 'only draft measurements can be edited';
  end if;
  if (new.contract_service_id is null)=(new.contract_addendum_line_id is null) then
    raise exception 'exactly one measurement source is required';
  end if;

  if new.contract_service_id is not null then
    select cs.unit_price,cs.contracted_quantity,c.work_id
      into v_price,v_qty,v_work
    from public.contract_services cs
    join public.engineering_contracts c
      on c.tenant_id=cs.tenant_id
     and c.company_id=cs.company_id
     and c.id=cs.contract_id
    where cs.tenant_id=new.tenant_id
      and cs.company_id=new.company_id
      and cs.id=new.contract_service_id
      and cs.contract_id=v_contract
      and cs.status='active'
    for update of cs;

    if not found then
      raise exception 'contract service does not belong to measurement contract';
    end if;

    select coalesce(sum(ml.measured_quantity),0)
      into v_prev
    from public.measurement_lines ml
    join public.measurements m
      on m.tenant_id=ml.tenant_id
     and m.company_id=ml.company_id
     and m.id=ml.measurement_id
    where ml.tenant_id=new.tenant_id
      and ml.company_id=new.company_id
      and ml.contract_service_id=new.contract_service_id
      and ml.id<>new.id
      and m.status in('draft','closed','approved');
  else
    select cal.unit_price,abs(cal.quantity_delta),c.work_id
      into v_price,v_qty,v_work
    from public.contract_addendum_lines cal
    join public.contract_addenda ca
      on ca.tenant_id=cal.tenant_id
     and ca.company_id=cal.company_id
     and ca.id=cal.addendum_id
    join public.engineering_contracts c
      on c.tenant_id=ca.tenant_id
     and c.company_id=ca.company_id
     and c.id=ca.contract_id
    where cal.tenant_id=new.tenant_id
      and cal.company_id=new.company_id
      and cal.id=new.contract_addendum_line_id
      and ca.contract_id=v_contract
      and ca.status='effective'
    for update of cal;

    if not found then
      raise exception 'addendum line does not belong to an effective addendum of measurement contract';
    end if;

    select coalesce(sum(ml.measured_quantity),0)
      into v_prev
    from public.measurement_lines ml
    join public.measurements m
      on m.tenant_id=ml.tenant_id
     and m.company_id=ml.company_id
     and m.id=ml.measurement_id
    where ml.tenant_id=new.tenant_id
      and ml.company_id=new.company_id
      and ml.contract_addendum_line_id=new.contract_addendum_line_id
      and ml.id<>new.id
      and m.status in('draft','closed','approved');
  end if;

  if new.structure_id is not null then
    select ws.work_id
      into v_structure_work
    from public.work_structures ws
    where ws.tenant_id=new.tenant_id
      and ws.company_id=new.company_id
      and ws.id=new.structure_id;

    if not found or v_structure_work<>v_work then
      raise exception 'structure does not belong to contract work';
    end if;
  end if;

  new.unit_price_snapshot:=coalesce(v_price,0);

  if v_prev+new.measured_quantity>coalesce(v_qty,0)+0.000001 then
    raise exception 'measured quantity exceeds contracted quantity';
  end if;

  return new;
end;
$$;

create or replace function public.replace_measurement_stage(
  p_measurement_id uuid,
  p_contract_service_id uuid default null,
  p_contract_addendum_line_id uuid default null,
  p_quantity numeric default null,
  p_references text[] default null,
  p_notes text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_measurement public.measurements%rowtype;
  v_contract public.engineering_contracts%rowtype;
  v_reference text;
  v_count integer := coalesce(array_length(p_references,1),0);
  v_distinct_count integer := 0;
  v_source_qty numeric(18,6);
  v_previous_qty numeric(18,6);
  v_structure_id uuid;
  v_origin_name text;
begin
  select * into v_measurement
  from public.measurements
  where id=p_measurement_id
  for update;

  if not found or not app_private.can_access_company(v_measurement.tenant_id,v_measurement.company_id) then
    raise exception 'measurement not found or inaccessible';
  end if;
  if v_measurement.status<>'draft' then
    raise exception 'only draft measurements can be edited';
  end if;
  if (p_contract_service_id is null)=(p_contract_addendum_line_id is null) then
    raise exception 'exactly one measurement source is required';
  end if;

  select * into v_contract
  from public.engineering_contracts c
  where c.tenant_id=v_measurement.tenant_id
    and c.company_id=v_measurement.company_id
    and c.id=v_measurement.contract_id;

  if not found then
    raise exception 'measurement contract not found';
  end if;

  if p_contract_service_id is not null then
    select cs.contracted_quantity
      into v_source_qty
    from public.contract_services cs
    where cs.tenant_id=v_measurement.tenant_id
      and cs.company_id=v_measurement.company_id
      and cs.contract_id=v_measurement.contract_id
      and cs.id=p_contract_service_id
      and cs.status='active'
    for update;

    if not found then
      raise exception 'contract service does not belong to measurement contract';
    end if;

    select coalesce(sum(ml.measured_quantity),0)
      into v_previous_qty
    from public.measurement_lines ml
    join public.measurements m
      on m.tenant_id=ml.tenant_id
     and m.company_id=ml.company_id
     and m.id=ml.measurement_id
    where ml.tenant_id=v_measurement.tenant_id
      and ml.company_id=v_measurement.company_id
      and ml.contract_service_id=p_contract_service_id
      and ml.measurement_id<>v_measurement.id
      and m.status in('draft','closed','approved');
  else
    select abs(cal.quantity_delta)
      into v_source_qty
    from public.contract_addendum_lines cal
    join public.contract_addenda ca
      on ca.tenant_id=cal.tenant_id
     and ca.company_id=cal.company_id
     and ca.id=cal.addendum_id
    where cal.tenant_id=v_measurement.tenant_id
      and cal.company_id=v_measurement.company_id
      and cal.id=p_contract_addendum_line_id
      and ca.contract_id=v_measurement.contract_id
      and ca.status='effective'
    for update of cal;

    if not found then
      raise exception 'addendum line does not belong to an effective addendum of measurement contract';
    end if;

    select coalesce(sum(ml.measured_quantity),0)
      into v_previous_qty
    from public.measurement_lines ml
    join public.measurements m
      on m.tenant_id=ml.tenant_id
     and m.company_id=ml.company_id
     and m.id=ml.measurement_id
    where ml.tenant_id=v_measurement.tenant_id
      and ml.company_id=v_measurement.company_id
      and ml.contract_addendum_line_id=p_contract_addendum_line_id
      and ml.measurement_id<>v_measurement.id
      and m.status in('draft','closed','approved');
  end if;

  if v_count>0 then
    select count(distinct lower(trim(value)))
      into v_distinct_count
    from unnest(p_references) value
    where nullif(trim(value),'') is not null;

    if v_distinct_count<>v_count then
      raise exception 'measurement references contain blanks or duplicates';
    end if;

    if v_previous_qty+v_count>coalesce(v_source_qty,0)+0.000001 then
      raise exception 'selected units exceed remaining measurement balance';
    end if;

    if exists(
      select 1
      from public.measurement_lines ml
      join public.measurements m
        on m.tenant_id=ml.tenant_id
       and m.company_id=ml.company_id
       and m.id=ml.measurement_id
      where ml.tenant_id=v_measurement.tenant_id
        and ml.company_id=v_measurement.company_id
        and ml.measurement_id<>v_measurement.id
        and m.status in('draft','closed','approved')
        and (
          (p_contract_service_id is not null and ml.contract_service_id=p_contract_service_id)
          or (p_contract_addendum_line_id is not null and ml.contract_addendum_line_id=p_contract_addendum_line_id)
        )
        and lower(trim(substring(coalesce(ml.notes,'') from '\[G2PARITY\][[:space:]]+reference=([^|]+)')))
            = any(select lower(trim(value)) from unnest(p_references) value)
    ) then
      raise exception 'one or more selected units were already measured';
    end if;
  elsif coalesce(p_quantity,0)>0 then
    if v_previous_qty+p_quantity>coalesce(v_source_qty,0)+0.000001 then
      raise exception 'measured quantity exceeds remaining balance';
    end if;
  end if;

  delete from public.measurement_lines ml
  where ml.tenant_id=v_measurement.tenant_id
    and ml.company_id=v_measurement.company_id
    and ml.measurement_id=v_measurement.id
    and (
      (p_contract_service_id is not null and ml.contract_service_id=p_contract_service_id)
      or (p_contract_addendum_line_id is not null and ml.contract_addendum_line_id=p_contract_addendum_line_id)
    );

  v_origin_name:=nullif(trim(substring(coalesce(p_notes,'') from 'origin=([^|]+)')),'');

  if v_count>0 then
    foreach v_reference in array p_references loop
      v_reference:=trim(v_reference);
      v_structure_id:=null;

      -- Primeiro tenta localizar a unidade dentro da origem (torre/bloco) informada.
      if v_origin_name is not null then
        with recursive origin_nodes as (
          select ws.id,ws.parent_id,0 depth
          from public.work_structures ws
          where ws.tenant_id=v_measurement.tenant_id
            and ws.company_id=v_measurement.company_id
            and ws.work_id=v_contract.work_id
            and ws.status='active'
            and (lower(trim(ws.name))=lower(v_origin_name) or lower(trim(coalesce(ws.code,'')))=lower(v_origin_name))
          union all
          select child.id,child.parent_id,parent.depth+1
          from public.work_structures child
          join origin_nodes parent on child.parent_id=parent.id
          where child.tenant_id=v_measurement.tenant_id
            and child.company_id=v_measurement.company_id
            and child.work_id=v_contract.work_id
            and child.status='active'
        )
        select ws.id
          into v_structure_id
        from origin_nodes d
        join public.work_structures ws on ws.id=d.id
        where lower(trim(coalesce(ws.code,'')))=lower(v_reference)
           or lower(trim(ws.name))=lower(v_reference)
        order by d.depth desc
        limit 1;
      end if;

      -- Fallback somente quando a referência é única na obra.
      if v_structure_id is null then
        select min(ws.id)
          into v_structure_id
        from public.work_structures ws
        where ws.tenant_id=v_measurement.tenant_id
          and ws.company_id=v_measurement.company_id
          and ws.work_id=v_contract.work_id
          and ws.status='active'
          and (lower(trim(coalesce(ws.code,'')))=lower(v_reference) or lower(trim(ws.name))=lower(v_reference))
        having count(*)=1;
      end if;

      insert into public.measurement_lines(
        tenant_id,company_id,measurement_id,contract_service_id,contract_addendum_line_id,
        structure_id,measured_quantity,unit_price_snapshot,notes
      ) values(
        v_measurement.tenant_id,v_measurement.company_id,v_measurement.id,
        p_contract_service_id,p_contract_addendum_line_id,v_structure_id,1,0,
        concat('[G2PARITY] reference=',v_reference,case when nullif(trim(coalesce(p_notes,'')),'') is null then '' else concat(' | ',trim(p_notes)) end)
      );
    end loop;
  elsif coalesce(p_quantity,0)>0 then
    insert into public.measurement_lines(
      tenant_id,company_id,measurement_id,contract_service_id,contract_addendum_line_id,
      structure_id,measured_quantity,unit_price_snapshot,notes
    ) values(
      v_measurement.tenant_id,v_measurement.company_id,v_measurement.id,
      p_contract_service_id,p_contract_addendum_line_id,null,p_quantity,0,
      concat('[G2PARITY]',case when nullif(trim(coalesce(p_notes,'')),'') is null then '' else concat(' ',trim(p_notes)) end)
    );
  end if;
end;
$$;

revoke all on function public.replace_measurement_stage(uuid,uuid,uuid,numeric,text[],text) from public,anon;
grant execute on function public.replace_measurement_stage(uuid,uuid,uuid,numeric,text[],text) to authenticated;

commit;
