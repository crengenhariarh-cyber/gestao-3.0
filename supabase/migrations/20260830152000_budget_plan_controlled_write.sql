begin;
revoke insert, update, delete on public.budget_plans from authenticated;
create or replace function app_private.upsert_budget_plan_impl(p_tenant_id uuid,p_company_id uuid,p_cost_center_id uuid,p_category_id uuid,p_competence_month date,p_planned_amount numeric,p_notes text default null)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; begin
 if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized to manage company'; end if;
 if p_competence_month is null or p_competence_month<>date_trunc('month',p_competence_month)::date then raise exception 'competence must be first day of month'; end if;
 if p_planned_amount is null or p_planned_amount<0 then raise exception 'planned amount must be non-negative'; end if;
 if p_cost_center_id is not null and not exists(select 1 from public.cost_centers where tenant_id=p_tenant_id and company_id=p_company_id and id=p_cost_center_id and status='active') then raise exception 'invalid cost center'; end if;
 if p_category_id is not null and not exists(select 1 from public.financial_categories where tenant_id=p_tenant_id and company_id=p_company_id and id=p_category_id and kind='expense' and status='active') then raise exception 'invalid expense category'; end if;
 select id into v_id from public.budget_plans where tenant_id=p_tenant_id and company_id=p_company_id and cost_center_id is not distinct from p_cost_center_id and category_id is not distinct from p_category_id and competence_month=p_competence_month and source_kind='manual' for update;
 if v_id is null then insert into public.budget_plans(tenant_id,company_id,cost_center_id,category_id,competence_month,planned_amount,source_kind,notes,created_by) values(p_tenant_id,p_company_id,p_cost_center_id,p_category_id,p_competence_month,round(p_planned_amount,2),'manual',p_notes,auth.uid()) returning id into v_id;
 else update public.budget_plans set planned_amount=round(p_planned_amount,2),notes=p_notes where id=v_id; end if;
 insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_tenant_id,p_company_id,auth.uid(),'budget.plan.upserted','budget_plan',v_id,jsonb_build_object('competence_month',p_competence_month,'planned_amount',round(p_planned_amount,2),'cost_center_id',p_cost_center_id,'category_id',p_category_id));
 return v_id; end $$;
create or replace function public.upsert_budget_plan(p_tenant_id uuid,p_company_id uuid,p_cost_center_id uuid,p_category_id uuid,p_competence_month date,p_planned_amount numeric,p_notes text default null)
returns uuid language sql security invoker set search_path='' as $$ select app_private.upsert_budget_plan_impl(p_tenant_id,p_company_id,p_cost_center_id,p_category_id,p_competence_month,p_planned_amount,p_notes); $$;
revoke all on function public.upsert_budget_plan(uuid,uuid,uuid,uuid,date,numeric,text) from public,anon;
grant execute on function public.upsert_budget_plan(uuid,uuid,uuid,uuid,date,numeric,text) to authenticated;
commit;
