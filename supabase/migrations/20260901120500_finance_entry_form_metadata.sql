begin;

alter table public.financial_entries
  add column if not exists payment_method text;

alter table public.card_transactions
  add column if not exists payment_method text,
  add column if not exists work_id uuid;

alter table public.financial_recurrence_rules
  add column if not exists payment_method text,
  add column if not exists work_id uuid;

alter table public.financial_entries
  drop constraint if exists financial_entries_payment_method_check;
alter table public.financial_entries
  add constraint financial_entries_payment_method_check
  check (payment_method is null or payment_method in ('pix','debit','credit','cash','transfer','boleto','other'));

alter table public.card_transactions
  drop constraint if exists card_transactions_payment_method_check;
alter table public.card_transactions
  add constraint card_transactions_payment_method_check
  check (payment_method is null or payment_method = 'credit');

alter table public.financial_recurrence_rules
  drop constraint if exists financial_recurrence_rules_payment_method_check;
alter table public.financial_recurrence_rules
  add constraint financial_recurrence_rules_payment_method_check
  check (payment_method is null or payment_method in ('pix','debit','credit','cash','transfer','boleto','other'));

create index if not exists financial_entries_work_id_idx
  on public.financial_entries (tenant_id, company_id, work_id);
create index if not exists card_transactions_work_id_idx
  on public.card_transactions (tenant_id, company_id, work_id);
create index if not exists recurrence_work_id_idx
  on public.financial_recurrence_rules (tenant_id, company_id, work_id);

commit;
