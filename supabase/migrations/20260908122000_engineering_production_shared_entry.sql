create or replace function public.create_engineering_production_shared_entry(
  p_tenant_id uuid,
  p_company_id uuid,
  p_period_id uuid,
  p_structure_id uuid,
  p_service_id uuid,
  p_production_date date,
  p_executed_quantity numeric,
  p_unit_value numeric,
  p_notes text,
  p_division_mode text,
  p_participants jsonb
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_entry_id uuid;
  v_primary_employee uuid;
  v_total numeric(14,2);
  v_count integer;
  v_sum numeric;
  v_item jsonb;
  v_employee uuid;
  v_percentage numeric;
  v_value numeric;
begin
  if not app_private.can_edit_company(p_tenant_id,p_company_id) then raise exception 'access denied'; end if;
  if p_executed_quantity is null or p_executed_quantity <= 0 then raise exception 'invalid quantity'; end if;
  if p_unit_value is null or p_unit_value < 0 then raise exception 'invalid unit value'; end if;
  if p_division_mode not in ('equal','percentage','value') then raise exception 'invalid division mode'; end if;
  if jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants)=0 then raise exception 'participants required'; end if;

  select count(*) into v_count from jsonb_array_elements(p_participants);
  v_total:=round((p_executed_quantity*p_unit_value)::numeric,2);
  select (value->>'employmentContractId')::uuid into v_primary_employee from jsonb_array_elements(p_participants) limit 1;

  if p_division_mode='percentage' then
    select coalesce(sum((value->>'percentage')::numeric),0) into v_sum from jsonb_array_elements(p_participants);
    if abs(v_sum-100)>0.01 then raise exception 'participant percentages must total 100'; end if;
  elsif p_division_mode='value' then
    select coalesce(sum((value->>'value')::numeric),0) into v_sum from jsonb_array_elements(p_participants);
    if abs(v_sum-v_total)>0.01 then raise exception 'participant values must equal production total'; end if;
  end if;

  insert into public.engineering_production_entries(
    tenant_id,company_id,production_period_id,employment_contract_id,structure_id,service_id,production_date,executed_quantity,unit_value,production_value,notes
  ) values (
    p_tenant_id,p_company_id,p_period_id,v_primary_employee,p_structure_id,p_service_id,p_production_date,p_executed_quantity,p_unit_value,v_total,nullif(trim(p_notes),'')
  ) returning id into v_entry_id;

  for v_item in select value from jsonb_array_elements(p_participants) loop
    v_employee:=(v_item->>'employmentContractId')::uuid;
    if p_division_mode='equal' then
      v_percentage:=100.0/v_count;
      v_value:=round(v_total/v_count,2);
    elsif p_division_mode='percentage' then
      v_percentage:=(v_item->>'percentage')::numeric;
      v_value:=round(v_total*v_percentage/100.0,2);
    else
      v_value:=(v_item->>'value')::numeric;
      v_percentage:=case when v_total=0 then 100.0/v_count else v_value/v_total*100.0 end;
    end if;
    insert into public.engineering_production_participants(tenant_id,company_id,production_entry_id,employment_contract_id,percentage,participant_value)
    values(p_tenant_id,p_company_id,v_entry_id,v_employee,v_percentage,v_value);
  end loop;

  return v_entry_id;
end;
$$;

grant execute on function public.create_engineering_production_shared_entry(uuid,uuid,uuid,uuid,uuid,date,numeric,numeric,text,text,jsonb) to authenticated;