create or replace function public.set_contract_addendum_status(p_addendum_id uuid, p_action text)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  v public.contract_addenda%rowtype;
begin
  select * into v from public.contract_addenda where id=p_addendum_id for update;
  if not found or not app_private.can_edit_company(v.tenant_id,v.company_id) then
    raise exception 'addendum not found or inaccessible';
  end if;

  if p_action='effective' then
    if v.status<>'draft' then raise exception 'only draft addendum can become effective'; end if;
    if coalesce(v.stated_value,0)<=0 and not exists (
      select 1 from public.contract_addendum_lines l
      where l.tenant_id=v.tenant_id and l.company_id=v.company_id and l.addendum_id=v.id
    ) then raise exception 'addendum requires a stated value or at least one line'; end if;
    update public.contract_addenda
      set status='effective', effective_date=coalesce(effective_date,current_date)
      where id=v.id;
  elsif p_action='cancel' then
    if v.status<>'draft' then raise exception 'only draft addendum can be cancelled'; end if;
    update public.contract_addenda set status='cancelled' where id=v.id;
  else
    raise exception 'invalid addendum action';
  end if;
end;
$function$;

revoke all on function public.set_contract_addendum_status(uuid,text) from public, anon;
grant execute on function public.set_contract_addendum_status(uuid,text) to authenticated;

create or replace view public.engineering_contract_financial_summary
with (security_invoker=true)
as
with ad as (
  select a.tenant_id,
         a.company_id,
         a.contract_id,
         sum(case when a.status='effective' then coalesce(a.stated_value,x.lines_value,0::numeric) else 0::numeric end) as addenda_net
  from public.contract_addenda a
  left join (
    select contract_addendum_lines.tenant_id,
           contract_addendum_lines.company_id,
           contract_addendum_lines.addendum_id,
           sum(contract_addendum_lines.line_total) as lines_value
    from public.contract_addendum_lines
    group by contract_addendum_lines.tenant_id, contract_addendum_lines.company_id, contract_addendum_lines.addendum_id
  ) x on x.tenant_id=a.tenant_id and x.company_id=a.company_id and x.addendum_id=a.id
  group by a.tenant_id,a.company_id,a.contract_id
), meas as (
  select m.tenant_id,
         m.company_id,
         m.contract_id,
         sum(case when m.status in ('closed','approved') then fs.gross_amount else 0::numeric end) as measured_gross,
         sum(case when m.status in ('closed','approved') then fs.retained_amount else 0::numeric end) as retained_amount,
         sum(case when m.status in ('closed','approved') then fs.net_amount else 0::numeric end) as measured_net
  from public.measurements m
  join public.measurement_financial_summary fs
    on fs.tenant_id=m.tenant_id and fs.company_id=m.company_id and fs.measurement_id=m.id
  group by m.tenant_id,m.company_id,m.contract_id
)
select c.tenant_id,
       c.company_id,
       c.work_id,
       c.id as contract_id,
       c.contract_number,
       c.status,
       c.base_value as original_contract_value,
       coalesce(ad.addenda_net,0::numeric)::numeric(18,2) as addenda_net,
       (c.base_value+coalesce(ad.addenda_net,0::numeric))::numeric(18,2) as updated_contract_value,
       coalesce(meas.measured_gross,0::numeric)::numeric(18,2) as measured_gross,
       coalesce(meas.retained_amount,0::numeric)::numeric(18,2) as retained_amount,
       coalesce(meas.measured_net,0::numeric)::numeric(18,2) as measured_net,
       (c.base_value+coalesce(ad.addenda_net,0::numeric)-coalesce(meas.measured_gross,0::numeric))::numeric(18,2) as gross_balance,
       case when (c.base_value+coalesce(ad.addenda_net,0::numeric))>0::numeric
         then round(coalesce(meas.measured_gross,0::numeric)*100::numeric/(c.base_value+coalesce(ad.addenda_net,0::numeric)),2)
         else 0::numeric end as measured_percent
from public.engineering_contracts c
left join ad on ad.tenant_id=c.tenant_id and ad.company_id=c.company_id and ad.contract_id=c.id
left join meas on meas.tenant_id=c.tenant_id and meas.company_id=c.company_id and meas.contract_id=c.id;
