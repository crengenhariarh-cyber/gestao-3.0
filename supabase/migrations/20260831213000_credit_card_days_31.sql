alter table public.credit_cards
  drop constraint if exists credit_cards_closing_day_check;

alter table public.credit_cards
  drop constraint if exists credit_cards_due_day_check;

alter table public.credit_cards
  add constraint credit_cards_closing_day_check
  check (closing_day between 1 and 31);

alter table public.credit_cards
  add constraint credit_cards_due_day_check
  check (due_day between 1 and 31);
