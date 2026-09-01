begin;

alter table public.financial_entries
  add column if not exists planned_account_id uuid;

alter table public.financial_entries
  drop constraint if exists financial_entries_planned_account_fk;

alter table public.financial_entries
  add constraint financial_entries_planned_account_fk
  foreign key (tenant_id, company_id, planned_account_id)
  references public.financial_accounts (tenant_id, company_id, id)
  on delete restrict;

create index if not exists financial_entries_planned_account_idx
  on public.financial_entries (tenant_id, company_id, planned_account_id)
  where planned_account_id is not null;

create or replace function public.set_financial_entry_planned_account(
  p_tenant_id uuid,
  p_company_id uuid,
  p_entry_id uuid,
  p_account_id uuid
)
returns void
language plpgsql
security invoker
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;

  if not exists (
    select 1 from public.financial_entries e
    where e.tenant_id=p_tenant_id and e.company_id=p_company_id and e.id=p_entry_id
  ) then raise exception 'financial entry not found'; end if;

  if p_account_id is not null and not exists (
    select 1 from public.financial_accounts a
    where a.tenant_id=p_tenant_id and a.company_id=p_company_id and a.id=p_account_id and a.status='active'
  ) then raise exception 'active financial account not found in company'; end if;

  update public.financial_entries
     set planned_account_id=p_account_id,
         updated_at=now()
   where tenant_id=p_tenant_id and company_id=p_company_id and id=p_entry_id;
end;
$$;

revoke all on function public.set_financial_entry_planned_account(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.set_financial_entry_planned_account(uuid,uuid,uuid,uuid) to authenticated;

commit;