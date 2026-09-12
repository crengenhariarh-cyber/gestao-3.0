begin;

create or replace view public.budget_salary_employee_details with (security_invoker=true) as
select bl.id limit_id,bl.tenant_id,bl.company_id,bl.cost_center_id,bl.competence_month,e.id employee_id,e.full_name,ec.job_title,round((ct.base_salary*ea.allocation_percent/100.0)::numeric,2) amount
from public.budget_limits bl
join public.financial_categories fc on fc.id=bl.category_id and fc.tenant_id=bl.tenant_id and fc.company_id=bl.company_id
join public.employment_contracts ec on ec.tenant_id=bl.tenant_id and ec.company_id=bl.company_id
join public.employees e on e.id=ec.employee_id and e.tenant_id=bl.tenant_id
join public.compensation_terms ct on ct.tenant_id=bl.tenant_id and ct.company_id=bl.company_id and ct.employment_contract_id=ec.id
join public.employee_allocations ea on ea.tenant_id=bl.tenant_id and ea.company_id=bl.company_id and ea.employment_contract_id=ec.id and ea.cost_center_id=bl.cost_center_id
where upper(fc.name)='PAGAMENTO DE SALÁRIO'
and ec.hired_on<=(bl.competence_month+interval '1 month - 1 day')::date and (ec.terminated_on is null or ec.terminated_on>=bl.competence_month)
and ct.valid_from<=(bl.competence_month+interval '1 month - 1 day')::date and (ct.valid_to is null or ct.valid_to>=bl.competence_month)
and ea.valid_from<=(bl.competence_month+interval '1 month - 1 day')::date and (ea.valid_to is null or ea.valid_to>=bl.competence_month);

revoke all on public.budget_salary_employee_details from public,anon;
grant select on public.budget_salary_employee_details to authenticated;

alter view public.budget_limit_transaction_details rename to budget_limit_transaction_details_base;
create view public.budget_limit_transaction_details with (security_invoker=true) as
select detail_id,movement_date,description,counterparty_name,source_category_name,amount,payment_method,card_name,limit_id,tenant_id,company_id,cost_center_id,category_id,competence_month from public.budget_limit_transaction_details_base
union all
select ('salary:'||d.limit_id::text||':'||d.employee_id::text),d.competence_month,d.full_name,d.job_title,'PAGAMENTO DE SALÁRIO'::text,d.amount,'salário'::text,null::text,d.limit_id,d.tenant_id,d.company_id,d.cost_center_id,bl.category_id,d.competence_month
from public.budget_salary_employee_details d join public.budget_limits bl on bl.id=d.limit_id;

revoke all on public.budget_limit_transaction_details_base from public,anon;
grant select on public.budget_limit_transaction_details_base to authenticated;
revoke all on public.budget_limit_transaction_details from public,anon;
grant select on public.budget_limit_transaction_details to authenticated;

commit;
