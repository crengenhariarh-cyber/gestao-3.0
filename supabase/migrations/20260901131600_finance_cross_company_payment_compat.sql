begin;

create or replace function app_private.card_transaction_default_expense_company()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.expense_company_id is null then
    new.expense_company_id := new.company_id;
  end if;
  return new;
end;
$$;

drop trigger if exists card_transactions_default_expense_company on public.card_transactions;
create trigger card_transactions_default_expense_company
before insert on public.card_transactions
for each row execute function app_private.card_transaction_default_expense_company();

commit;
