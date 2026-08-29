begin;

do $$
declare
  v_table text;
  v_bad_count integer;
  v_select_count integer;
begin
  foreach v_table in array array[
    'financial_settlements',
    'financial_transfers',
    'financial_account_movements',
    'card_transactions',
    'card_installments',
    'card_statements',
    'card_statement_payments'
  ] loop
    select count(*) into v_bad_count
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = v_table
      and grantee in ('anon', 'authenticated')
      and privilege_type <> 'SELECT';

    if v_bad_count <> 0 then
      raise exception 'immutable table % exposes non-SELECT client privileges', v_table;
    end if;

    select count(*) into v_select_count
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = v_table
      and grantee = 'authenticated'
      and privilege_type = 'SELECT';

    if v_select_count <> 1 then
      raise exception 'immutable table % must grant SELECT to authenticated exactly once', v_table;
    end if;

    if exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = v_table
        and grantee = 'anon'
    ) then
      raise exception 'immutable table % must not grant privileges to anon', v_table;
    end if;
  end loop;
end $$;

do $$
declare
  v_name text;
begin
  foreach v_name in array array[
    'record_financial_settlement',
    'record_financial_transfer',
    'create_card_purchase',
    'close_card_statement',
    'record_card_statement_payment'
  ] loop
    if exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = v_name
        and p.prosecdef
    ) then
      raise exception 'public RPC % must not be SECURITY DEFINER', v_name;
    end if;

    if exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = v_name
        and has_function_privilege('anon', p.oid, 'EXECUTE')
    ) then
      raise exception 'public RPC % must not be executable by anon', v_name;
    end if;
  end loop;
end $$;

rollback;
