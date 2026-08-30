create index if not exists card_installments_transaction_fk_idx on public.card_installments(transaction_id);
create index if not exists card_statement_payments_account_fk_idx on public.card_statement_payments(account_id);
create index if not exists card_statement_payments_card_fk_idx on public.card_statement_payments(card_id);
create index if not exists card_transactions_category_fk_idx on public.card_transactions(category_id);
create index if not exists card_transactions_cost_center_fk_idx on public.card_transactions(cost_center_id);
create index if not exists credit_cards_payment_account_fk_idx on public.credit_cards(default_payment_account_id);

create or replace view public.finance_card_transactions_operational
with (security_invoker=true) as
select ct.tenant_id,ct.company_id,ct.id transaction_id,ct.card_id,cc.name card_name,ct.purchase_date,ct.description,ct.counterparty_name,ct.category_id,ct.cost_center_id,ct.total_amount,ct.installment_count,
case when ct.installment_count>1 then 'installment' else 'single' end purchase_type,
min(ci.statement_month) first_statement_month,max(ci.statement_month) last_statement_month,count(ci.id)::integer generated_installments,
coalesce(sum(ci.amount),0)::numeric(14,2) generated_total,
string_agg(ci.installment_number::text||'/'||ci.installment_count::text,', ' order by ci.installment_number) installment_labels
from public.card_transactions ct
join public.credit_cards cc on cc.tenant_id=ct.tenant_id and cc.company_id=ct.company_id and cc.id=ct.card_id
left join public.card_installments ci on ci.tenant_id=ct.tenant_id and ci.company_id=ct.company_id and ci.transaction_id=ct.id
group by ct.tenant_id,ct.company_id,ct.id,ct.card_id,cc.name,ct.purchase_date,ct.description,ct.counterparty_name,ct.category_id,ct.cost_center_id,ct.total_amount,ct.installment_count;

create or replace view public.finance_cards_company_summary
with (security_invoker=true) as
select d.tenant_id,d.company_id,count(*) filter(where d.status='active')::integer active_cards,
coalesce(sum(d.credit_limit) filter(where d.status='active'),0)::numeric(14,2) total_credit_limit,
coalesce(sum(d.committed_amount) filter(where d.status='active'),0)::numeric(14,2) committed_amount,
coalesce(sum(d.available_limit) filter(where d.status='active'),0)::numeric(14,2) available_limit,
coalesce(sum(d.current_open_statements),0)::numeric(14,2) current_open_statements,
coalesce(sum(d.overdue_statements),0)::numeric(14,2) overdue_statements,min(d.next_open_due_date) next_open_due_date
from public.finance_cards_dashboard d group by d.tenant_id,d.company_id;

create or replace view public.finance_operational_attention
with (security_invoker=true) as
select tenant_id,company_id,'financial_installment'::text source_type,installment_id source_id,due_date attention_date,description,
case when payment_status='overdue' then 'overdue' else payment_status end status,open_amount amount
from public.finance_operational_installments where payment_status in ('overdue','partial')
union all
select tenant_id,company_id,'card_statement'::text,statement_id,due_date,'Fatura '||card_name,operational_status,remaining_amount
from public.finance_card_statements_operational where operational_status in ('overdue','partial_overdue','partial')
union all
select tenant_id,company_id,'recurrence'::text,rule_id,next_occurrence_date,description,operational_status,amount
from public.financial_recurrence_operational where operational_status in ('overdue','due_today');

comment on view public.finance_card_transactions_operational is 'Operational card purchases with explicit installment labels for every purchase.';
comment on view public.finance_cards_company_summary is 'Company-level card limits, commitments, open and overdue statement summary.';
comment on view public.finance_operational_attention is 'Unified operational attention queue for financial installments, card statements and recurrences.';