create or replace function app_private.handle_first_owner_bootstrap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_company_id uuid;
  v_tenant_name text;
  v_company_name text;
  v_code text;
  v_code_hash text;
  v_tenant_count integer;
begin
  if coalesce(new.raw_user_meta_data ->> 'gestao_bootstrap', 'false') <> 'true' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gestao-3-first-owner-bootstrap'));

  if exists (select 1 from public.tenant_memberships)
     or exists (select 1 from public.company_memberships) then
    raise exception 'O primeiro acesso do Gestão 3.0 já foi configurado.';
  end if;

  v_code := coalesce(new.raw_user_meta_data ->> 'gestao_bootstrap_code', '');
  v_code_hash := pg_catalog.encode(extensions.digest(v_code, 'sha256'), 'hex');
  if v_code_hash <> 'bbb6d8fc8f896f360d8317fbadef94b6c4f48507dfe0ad035cb139398b8ed2e3' then
    raise exception 'Código inicial inválido.';
  end if;

  select count(*) into v_tenant_count from public.tenants;

  if v_tenant_count = 0 then
    v_tenant_name := pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'gestao_tenant_name', ''));
    v_company_name := pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'gestao_company_name', ''));

    if v_tenant_name = '' or v_company_name = '' then
      raise exception 'Organização e empresa inicial são obrigatórias.';
    end if;

    insert into public.tenants (name, slug, status)
    values (v_tenant_name, 'gestao-' || pg_catalog.replace(pg_catalog.left(new.id::text, 8), '-', ''), 'active')
    returning id into v_tenant_id;

    insert into public.companies (tenant_id, legal_name, trade_name, status)
    values (v_tenant_id, v_company_name, v_company_name, 'active')
    returning id into v_company_id;
  elsif v_tenant_count = 1 then
    select id into v_tenant_id from public.tenants limit 1;

    if not exists (
      select 1
      from public.companies
      where tenant_id = v_tenant_id
        and status = 'active'
    ) then
      raise exception 'A organização provisionada não possui empresa ativa.';
    end if;
  else
    raise exception 'Bootstrap inicial recusado: há mais de uma organização sem proprietário.';
  end if;

  insert into public.tenant_memberships (tenant_id, user_id, role, status)
  values (v_tenant_id, new.id, 'tenant_owner', 'active');

  insert into public.company_memberships (tenant_id, company_id, user_id, role, status)
  select v_tenant_id, c.id, new.id, 'company_admin', 'active'
  from public.companies c
  where c.tenant_id = v_tenant_id
    and c.status = 'active';

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      - 'gestao_bootstrap_code'
      - 'gestao_bootstrap'
      - 'gestao_company_name'
  where id = new.id;

  return new;
end;
$$;

revoke all on function app_private.handle_first_owner_bootstrap() from public, anon, authenticated;

drop trigger if exists gestao_first_owner_bootstrap on auth.users;
create trigger gestao_first_owner_bootstrap
after insert on auth.users
for each row execute function app_private.handle_first_owner_bootstrap();
