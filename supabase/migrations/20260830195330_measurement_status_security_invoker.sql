-- Security hardening found by Supabase advisor after 06.06.
alter function public.set_measurement_status(uuid,text,text) security invoker;
