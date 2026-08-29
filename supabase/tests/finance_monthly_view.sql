begin;

insert into auth.users (id, email)
values ('16000000-0000-0000-0000-000000000001', 'monthly-test@example.invalid');

insert into public.tenants (id, name, slug)
values ('26000000-0000-0000-0000-000000000001', 'Monthly Tenant', 'monthly-tenant');

insert into public.companies (id, tenant_id, legal_name)
values
  ('36000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', 'Monthly Company A'),
  ('36000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000001', 'Monthly Company B');

insert into public.tenant_memberships (tenant_id, user_id, role)
values ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', 'operator');

insert into public.company_memberships (tenant_id, company_id, user_id, role)
values ('26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', 'manager');

insert into public.financial_categories (id, tenant_id, company_id, name, kind)
values ('46000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'Alimentação', 'expense');

insert into public.cost_centers (id, tenant_id, company_id, name, code)
values ('56000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'Obra A', 'OBRA-A');

insert into public.financial_accounts (id, tenant_id, company_id, name, account_type, opening_balance)
values ('66000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'Banco', 'bank', 1000.00);

insert into public.financial_entries (id, tenant_id, company_id, entry_type, description, counterparty_name, category_id, cost_center_id, competence_month)
values ('76000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'expense', 'Café da manhã', 'Fornecedor A', '46000000-0000-0000-0000-000000000001', '56000000-0000-0000-0000-000000000001', '2026-09-01');

insert into public.financial_installments (id, tenant_id, company_id, entry_id, installment_number, installment_count, due_date, competence_month, amount)
values ('86000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 1, 1, '2026-09-10', '2026-09-01', 100.00);

insert into public.financial_settlements (tenant_id, company_id, installment_id, account_id, settled_on, amount, idempotency_key)
values ('26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000001', '2026-09-10', 40.00, 'monthly-settlement');

insert into public.credit_cards (id, tenant_id, company_id, name, credit_limit, closing_day, due_day)
values ('96000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'Cartão', 1000.00, 10, 20);

insert into public.card_transactions (id, tenant_id, company_id, card_id, purchase_date, description, counterparty_name, category_id, cost_center_id, total_amount, installment_count, idempotency_key)
values ('a6000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', '2026-09-05', 'Compra cartão', 'Fornecedor Cartão', '46000000-0000-0000-0000-000000000001', '56000000-0000-0000-0000-000000000001', 300.00, 3, 'monthly-card');

insert into public.card_installments (id, tenant_id, company_id, card_id, transaction_id, installment_number, installment_count, statement_month, amount)
values ('b6000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 1, 3, '2026-09-01', 100.00);

insert into public.card_statements (id, tenant_id, company_id, card_id, statement_month, due_date, statement_amount, closed_at)
values ('c6000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', '2026-09-01', '2026-09-20', 100.00, now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);

do $$
declare
  v_count integer;
  v_planned numeric;
  v_realized numeric;
  v_pending numeric;
  v_financial_status text;
  v_card_status text;
begin
  select count(*), sum(planned_amount), sum(realized_amount), sum(pending_amount)
    into v_count, v_planned, v_realized, v_pending
  from public.finance_monthly_items
  where tenant_id = '26000000-0000-0000-0000-000000000001'
    and company_id = '36000000-0000-0000-0000-000000000001'
    and competence_month = '2026-09-01';

  if v_count <> 2 then raise exception 'expected 2 monthly items, got %', v_count; end if;
  if v_planned <> 200.00 then raise exception 'expected planned 200.00, got %', v_planned; end if;
  if v_realized <> 140.00 then raise exception 'expected realized 140.00, got %', v_realized; end if;
  if v_pending <> 60.00 then raise exception 'expected pending 60.00, got %', v_pending; end if;

  select payment_status into v_financial_status from public.finance_monthly_items where item_id = '86000000-0000-0000-0000-000000000001';
  select payment_status into v_card_status from public.finance_monthly_items where item_id = 'b6000000-0000-0000-0000-000000000001';

  if v_financial_status <> 'partial' then raise exception 'expected financial status partial, got %', v_financial_status; end if;
  if v_card_status <> 'pending' then raise exception 'expected card statement status pending, got %', v_card_status; end if;

  if exists (select 1 from public.finance_monthly_items where company_id = '36000000-0000-0000-0000-000000000002') then
    raise exception 'unauthorized company leaked into monthly view';
  end if;
end $$;

rollback;
