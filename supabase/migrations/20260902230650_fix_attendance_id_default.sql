alter table public.employee_attendance_daily
  alter column id set default gen_random_uuid();
