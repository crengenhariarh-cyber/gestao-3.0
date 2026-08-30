begin;

create function public.sync_engineering_contract_base_value()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.engineering_contracts c
  set base_value = (
    select coalesce(sum(cs.line_total),0)
    from public.contract_services cs
    where cs.contract_id = c.id
      and cs.tenant_id = c.tenant_id
      and cs.company_id = c.company_id
      and cs.status = 'active'
  )
  where c.id = coalesce(new.contract_id, old.contract_id)
    and c.tenant_id = coalesce(new.tenant_id, old.tenant_id)
    and c.company_id = coalesce(new.company_id, old.company_id);
  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_engineering_contract_base_value() from public, anon, authenticated;

create trigger contract_services_sync_contract_base_value
  after insert or update of contracted_quantity, unit_price, status on public.contract_services
  for each row execute function public.sync_engineering_contract_base_value();

comment on function public.sync_engineering_contract_base_value() is 'Keeps engineering_contracts.base_value derived from active contract service lines.';

commit;
