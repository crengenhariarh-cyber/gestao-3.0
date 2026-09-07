alter table public.contract_service_allocations
  add column if not exists scope_config jsonb not null default '{}'::jsonb;

alter table public.contract_service_allocations
  drop constraint if exists contract_service_allocations_scope_config_object;

alter table public.contract_service_allocations
  add constraint contract_service_allocations_scope_config_object
  check (jsonb_typeof(scope_config) = 'object');

comment on column public.contract_service_allocations.scope_config is
  'Operational scope for a service allocation, including floors/units selected for measurement parity with Gestão 2.0.';
