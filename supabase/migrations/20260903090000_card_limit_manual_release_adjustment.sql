begin;

create table if not exists public.card_limit_manual_adjustments (
  tenant_id uuid not null,
  company_id uuid not null,
  card_id uuid primary key references public.credit_cards(id) on delete cascade,
  released_amount numeric(14,2) not null default 0 check (released_amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view public.credit_card_limits as
with installment_totals as (
  select tenant_id, card_id, coalesce(sum(amount),0)::numeric(14,2) as total
  from public.card_installments
  group by tenant_id, card_id
), statement_payment_applied as (
  select cs.tenant_id, cs.card_id, cs.id as statement_id,
         least(coalesce(sum(csp.amount),0),cs.statement_amount)::numeric(14,2) as applied_total
  from public.card_statements cs
  left join public.card_statement_payments csp
    on csp.tenant_id=cs.tenant_id and csp.company_id=cs.company_id and csp.statement_id=cs.id
  group by cs.tenant_id,cs.card_id,cs.id,cs.statement_amount
), payment_totals as (
  select tenant_id,card_id,coalesce(sum(applied_total),0)::numeric(14,2) as total
  from statement_payment_applied
  group by tenant_id,card_id
), manual_release as (
  select tenant_id,company_id,card_id,coalesce(released_amount,0)::numeric(14,2) as total
  from public.card_limit_manual_adjustments
)
select cc.id as card_id,cc.tenant_id,cc.company_id,cc.name,cc.credit_limit,
       greatest(coalesce(it.total,0)-coalesce(pt.total,0)-coalesce(mr.total,0),0)::numeric(14,2) as committed_amount,
       greatest(cc.credit_limit-greatest(coalesce(it.total,0)-coalesce(pt.total,0)-coalesce(mr.total,0),0),0)::numeric(14,2) as available_limit,
       cc.sort_order
from public.credit_cards cc
left join installment_totals it on it.tenant_id=cc.tenant_id and it.card_id=cc.id
left join payment_totals pt on pt.tenant_id=cc.tenant_id and pt.card_id=cc.id
left join manual_release mr on mr.tenant_id=cc.tenant_id and mr.company_id=cc.company_id and mr.card_id=cc.id;

insert into public.card_limit_manual_adjustments(tenant_id,company_id,card_id,released_amount,note)
select cc.tenant_id,cc.company_id,cc.id,3920.96,'Acerto manual solicitado em 2026-09-03 para liberar integralmente o limite do Santander após reconciliação de fatura.'
from public.credit_cards cc
where cc.name='CARTAO SANTANDER'
on conflict(card_id) do update set released_amount=excluded.released_amount,note=excluded.note,updated_at=now();

commit;
