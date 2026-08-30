begin;

create or replace function app_private.upsert_payroll_payable(
  p_tenant_id uuid,p_company_id uuid,p_competence_month date,p_source_kind text,p_source_key text,p_payroll_closing_id uuid,
  p_category_id uuid,p_description text,p_counterparty text,p_due_date date,p_amount numeric,p_user uuid
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_link public.payroll_finance_links%rowtype;
  v_entry uuid;
  v_installment uuid;
  v_settled numeric(14,2);
begin
  if p_amount is null or p_amount <= 0 then return null; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text||':'||p_company_id::text||':'||p_source_key,0)
  );

  select * into v_link
  from public.payroll_finance_links
  where tenant_id=p_tenant_id and company_id=p_company_id and source_key=p_source_key;

  if found then
    select coalesce(sum(fs.amount),0)::numeric(14,2) into v_settled
    from public.financial_settlements fs
    where fs.tenant_id=p_tenant_id and fs.company_id=p_company_id
      and fs.installment_id=v_link.financial_installment_id;

    if v_settled>0 and (
      v_link.generated_amount<>round(p_amount,2)
      or exists(
        select 1 from public.financial_installments fi
        where fi.id=v_link.financial_installment_id
          and (fi.due_date<>p_due_date or fi.amount<>round(p_amount,2) or fi.competence_month<>p_competence_month)
      )
    ) then
      raise exception 'payroll payable already settled/partially settled and cannot be recalculated';
    end if;

    update public.financial_entries set
      description=btrim(p_description),
      counterparty_name=nullif(btrim(p_counterparty),''),
      category_id=p_category_id,
      competence_month=p_competence_month,
      notes='Gerado automaticamente pelo RH do Gestão 3.0.'
    where tenant_id=p_tenant_id and company_id=p_company_id and id=v_link.financial_entry_id;

    update public.financial_installments set
      competence_month=p_competence_month,
      due_date=p_due_date,
      amount=round(p_amount,2)
    where tenant_id=p_tenant_id and company_id=p_company_id and id=v_link.financial_installment_id;

    update public.payroll_finance_links set
      generated_amount=round(p_amount,2),
      synced_at=now(),
      synced_by=p_user,
      payroll_closing_id=p_payroll_closing_id
    where id=v_link.id;

    return v_link.financial_entry_id;
  end if;

  insert into public.financial_entries(
    tenant_id,company_id,entry_type,description,counterparty_name,category_id,cost_center_id,
    competence_month,notes,created_by
  ) values(
    p_tenant_id,p_company_id,'expense',btrim(p_description),nullif(btrim(p_counterparty),''),p_category_id,null,
    p_competence_month,'Gerado automaticamente pelo RH do Gestão 3.0.',p_user
  ) returning id into v_entry;

  insert into public.financial_installments(
    tenant_id,company_id,entry_id,installment_number,installment_count,competence_month,due_date,amount
  ) values(
    p_tenant_id,p_company_id,v_entry,1,1,p_competence_month,p_due_date,round(p_amount,2)
  ) returning id into v_installment;

  insert into public.payroll_finance_links(
    tenant_id,company_id,competence_month,source_kind,source_key,payroll_closing_id,
    financial_entry_id,financial_installment_id,generated_amount,synced_by
  ) values(
    p_tenant_id,p_company_id,p_competence_month,p_source_kind,p_source_key,p_payroll_closing_id,
    v_entry,v_installment,round(p_amount,2),p_user
  );

  return v_entry;
end;
$$;

revoke all on function app_private.upsert_payroll_payable(uuid,uuid,date,text,text,uuid,uuid,text,text,date,numeric,uuid)
from public,anon,authenticated;

commit;
