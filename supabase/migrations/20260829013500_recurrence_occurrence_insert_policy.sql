begin;

create policy financial_recurrence_occurrences_insert_manager
on public.financial_recurrence_occurrences
for insert
to authenticated
with check (app_private.can_manage_company(tenant_id, company_id));

commit;
