begin;

revoke all privileges on table public.financial_settlements from anon, authenticated;
revoke all privileges on table public.financial_transfers from anon, authenticated;
revoke all privileges on table public.financial_account_movements from anon, authenticated;
revoke all privileges on table public.card_transactions from anon, authenticated;
revoke all privileges on table public.card_installments from anon, authenticated;
revoke all privileges on table public.card_statements from anon, authenticated;
revoke all privileges on table public.card_statement_payments from anon, authenticated;

grant select on table public.financial_settlements to authenticated;
grant select on table public.financial_transfers to authenticated;
grant select on table public.financial_account_movements to authenticated;
grant select on table public.card_transactions to authenticated;
grant select on table public.card_installments to authenticated;
grant select on table public.card_statements to authenticated;
grant select on table public.card_statement_payments to authenticated;

comment on table public.financial_settlements is 'Immutable settlement history. Client roles receive read-only access through RLS; mutations are only through controlled operations.';
comment on table public.financial_transfers is 'Immutable transfer headers. Client roles receive read-only access through RLS; mutations are only through controlled operations.';
comment on table public.financial_account_movements is 'Immutable account ledger. Client roles receive read-only access through RLS; mutations are only through controlled operations.';
comment on table public.card_transactions is 'Immutable card purchase headers after creation. Client roles receive read-only access through RLS; mutations are only through controlled operations.';
comment on table public.card_installments is 'Immutable card installment rows. Client roles receive read-only access through RLS; mutations are only through controlled operations.';
comment on table public.card_statements is 'Immutable closed statement snapshots. Client roles receive read-only access through RLS; mutations are only through controlled operations.';
comment on table public.card_statement_payments is 'Immutable card statement payment history. Client roles receive read-only access through RLS; mutations are only through controlled operations.';

commit;
