revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke execute on function public.create_installment_financial_entry(uuid, uuid, text, text, text, uuid, uuid, date, date, numeric, integer, text) from anon;
revoke execute on function public.materialize_next_financial_recurrence(uuid) from anon;
revoke execute on function public.sync_employee_occurrence_payroll(uuid, date, text, numeric, uuid) from public, anon;
