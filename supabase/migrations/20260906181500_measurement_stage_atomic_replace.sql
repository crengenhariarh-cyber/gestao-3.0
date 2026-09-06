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
  v_reference text;
  v_count integer := coalesce(array_length(p_references,1),0);
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

  delete from public.measurement_lines ml
  where ml.tenant_id=v_measurement.tenant_id
    and ml.company_id=v_measurement.company_id
    and ml.measurement_id=v_measurement.id
    and ((p_contract_service_id is not null and ml.contract_service_id=p_contract_service_id)
      or (p_contract_addendum_line_id is not null and ml.contract_addendum_line_id=p_contract_addendum_line_id));

  if v_count>0 then
    foreach v_reference in array p_references loop
      if nullif(trim(v_reference),'') is null then continue; end if;
      insert into public.measurement_lines(
        tenant_id,company_id,measurement_id,contract_service_id,contract_addendum_line_id,
        structure_id,measured_quantity,unit_price_snapshot,notes
      ) values(
        v_measurement.tenant_id,v_measurement.company_id,v_measurement.id,
        p_contract_service_id,p_contract_addendum_line_id,null,1,0,
        concat('[G2PARITY] reference=',trim(v_reference),case when nullif(trim(coalesce(p_notes,'')),'') is null then '' else concat(' | ',trim(p_notes)) end)
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
