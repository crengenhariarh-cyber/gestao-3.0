begin;

create function app_private.prevent_closed_card_statement_installment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.card_statements cs
    where cs.tenant_id = new.tenant_id
      and cs.company_id = new.company_id
      and cs.card_id = new.card_id
      and cs.statement_month = new.statement_month
  ) then
    raise exception 'card statement is already closed for this competence';
  end if;

  return new;
end;
$$;

revoke all on function app_private.prevent_closed_card_statement_installment() from public, anon, authenticated;

create trigger card_installments_prevent_closed_statement
before insert on public.card_installments
for each row execute function app_private.prevent_closed_card_statement_installment();

commit;
