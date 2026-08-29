begin;

grant execute on function app_private.record_financial_transfer_impl(uuid, uuid, uuid, uuid, date, numeric, text, text) to authenticated;

comment on function app_private.record_financial_transfer_impl(uuid, uuid, uuid, uuid, date, numeric, text, text)
is 'Privileged transfer implementation. Callable by authenticated only; authorization is enforced internally with can_manage_company. Not exposed through the public schema.';

commit;
