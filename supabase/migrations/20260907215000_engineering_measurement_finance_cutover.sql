begin;

-- Measurements before 09/2026 are historical implementation records.
-- They keep gross/net/retention information in Engineering reports,
-- but must not create financial receivables.
create or replace function public.generate_measurement_receivable(p_measurement_id uuid,p_due_date date)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_m public.measurements%rowtype;
  v_contract public.engineering_contracts%rowtype;
  v_work public.works%rowtype;
  v_net numeric(18,2);
  v_entry uuid;
  v_installment uuid;
  v_existing uuid;
begin
  if p_due_date is null then raise exception 'due date is required'; end if;

  select * into v_m
  from public.measurements
  where id=p_measurement_id
  for update;

  if not found or not app_private.can_manage_company(v_m.tenant_id,v_m.company_id) then
    raise exception 'measurement not found or inaccessible';
  end if;

  if v_m.status<>'approved' then
    raise exception 'only approved measurements generate receivables';
  end if;

  if v_m.competence < date '2026-09-01' then
    raise exception 'Medição histórica anterior à competência 09/2026 não integra o Financeiro.';
  end if;

  select financial_entry_id into v_existing
  from public.measurement_finance_links
  where tenant_id=v_m.tenant_id
    and company_id=v_m.company_id
    and measurement_id=v_m.id;
  if found then return v_existing; end if;

  select * into v_contract
  from public.engineering_contracts
  where tenant_id=v_m.tenant_id
    and company_id=v_m.company_id
    and id=v_m.contract_id;

  select * into v_work
  from public.works
  where tenant_id=v_m.tenant_id
    and company_id=v_m.company_id
    and id=v_contract.work_id;

  select net_amount into v_net
  from public.measurement_financial_summary
  where measurement_id=v_m.id;

  if coalesce(v_net,0)<=0 then
    raise exception 'measurement net amount must be positive';
  end if;

  insert into public.financial_entries(
    tenant_id,company_id,entry_type,description,counterparty_name,
    competence_month,notes,created_by,work_id,engineering_contract_id,measurement_id
  ) values (
    v_m.tenant_id,v_m.company_id,'income',
    'Medição - '||coalesce(v_work.name,'Obra')||' - Contrato '||coalesce(v_contract.contract_number,'s/n'),
    coalesce(v_contract.client_name,v_work.client_name),
    v_m.competence,
    'Gerado automaticamente pela Engenharia. Medição: '||v_m.id::text,
    auth.uid(),v_work.id,v_contract.id,v_m.id
  ) returning id into v_entry;

  insert into public.financial_installments(
    tenant_id,company_id,entry_id,installment_number,installment_count,due_date,amount,competence_month
  ) values (
    v_m.tenant_id,v_m.company_id,v_entry,1,1,p_due_date,v_net,v_m.competence
  ) returning id into v_installment;

  insert into public.measurement_finance_links(
    tenant_id,company_id,measurement_id,financial_entry_id,financial_installment_id,linked_by
  ) values (
    v_m.tenant_id,v_m.company_id,v_m.id,v_entry,v_installment,auth.uid()
  );

  return v_entry;
end;
$$;

commit;
