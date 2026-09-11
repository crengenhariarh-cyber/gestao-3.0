begin;

create index if not exists personal_settlement_items_company_idx
  on public.personal_settlement_items(tenant_id, company_id);
create index if not exists personal_settlement_movements_company_idx
  on public.personal_settlement_movements(tenant_id, company_id);

drop policy if exists personal_settlements_select_own on public.personal_settlements;
create policy personal_settlements_select_own on public.personal_settlements
for select to authenticated
using ((select auth.uid()) = user_id and app_private.can_access_company(tenant_id, company_id));

drop policy if exists personal_settlement_items_select_own on public.personal_settlement_items;
create policy personal_settlement_items_select_own on public.personal_settlement_items
for select to authenticated
using (
  (select auth.uid()) = user_id
  and app_private.can_access_company(tenant_id, company_id)
  and exists (
    select 1 from public.personal_settlements s
    where s.id = settlement_id and s.user_id = (select auth.uid())
  )
);

drop policy if exists personal_settlement_movements_select_own on public.personal_settlement_movements;
create policy personal_settlement_movements_select_own on public.personal_settlement_movements
for select to authenticated
using (
  (select auth.uid()) = user_id
  and app_private.can_access_company(tenant_id, company_id)
  and exists (
    select 1 from public.personal_settlements s
    where s.id = settlement_id and s.user_id = (select auth.uid())
  )
);

commit;
