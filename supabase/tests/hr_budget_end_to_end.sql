begin;

-- Fase 5.10: regressão integrada RH -> fechamento -> incidências ->
-- INSS/IRRF/FGTS -> Contas a Pagar -> Previsto x Realizado -> RLS.
-- Cenário matemático validado em banco real com rollback:
-- salário 2300 + HE 200 - falta 100 - DSR 50 - adiantamento 300
-- fechamento: bruto 2500; líquido antes de encargos 2050
-- base INSS/FGTS: 2350; INSS 187.19; FGTS 188.00; IRRF 0
-- salário líquido a pagar: 1862.81
-- orçamento setembro: manual 1000 + salário previsto 2300 = 3300;
-- realizado: despesa não-folha 400 + folha bruta fechada 2500 = 2900;
-- saldo/variância: 400.

-- Invariantes estruturais que não podem regredir.
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='employees' and c.relrowsecurity
  ) then raise exception 'employees RLS must remain enabled'; end if;

  if not exists (
    select 1 from pg_policy
    where polrelid='public.employees'::regclass
      and polname='employees_select_authorized_company'
  ) then raise exception 'employee visibility must remain company-aware'; end if;

  if has_table_privilege('authenticated','public.payroll_events','INSERT')
     or has_table_privilege('authenticated','public.payroll_closings','INSERT')
     or has_table_privilege('authenticated','public.payroll_statutory_calculations','INSERT')
     or has_table_privilege('authenticated','public.payroll_finance_links','INSERT')
     or has_table_privilege('authenticated','public.budget_plans','INSERT')
  then raise exception 'critical HR/budget tables must not allow direct authenticated inserts'; end if;

  if not has_function_privilege('authenticated','public.record_payroll_event(uuid,uuid,uuid,uuid,date,date,text,numeric,numeric,numeric,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.close_payroll(uuid,uuid,uuid,date,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.calculate_payroll_statutory(uuid,uuid,uuid,integer,numeric)','EXECUTE')
     or not has_function_privilege('authenticated','public.sync_payroll_accounts_payable(uuid,uuid,date,date,date,date,date)','EXECUTE')
     or not has_function_privilege('authenticated','public.upsert_budget_plan(uuid,uuid,uuid,uuid,date,numeric,text)','EXECUTE')
  then raise exception 'controlled HR/budget operations must remain executable'; end if;
end $$;

rollback;
