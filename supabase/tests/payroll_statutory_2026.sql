begin;

do $$
declare v numeric;
begin
  v := app_private.calculate_employee_inss_2026(2300.00);
  if v <> 182.69 then raise exception 'INSS 2300 expected 182.69 got %',v; end if;
  v := app_private.calculate_employee_inss_2026(4000.00);
  if v <> 368.60 then raise exception 'INSS 4000 expected 368.60 got %',v; end if;
  v := app_private.calculate_irrf_table_2026(3392.80);
  if v <> 114.76 then raise exception 'IRRF table expected 114.76 got %',v; end if;
  v := app_private.calculate_irrf_reduction_2026(4000.00,114.76);
  if v <> 114.76 then raise exception 'IRRF reduction expected 114.76 got %',v; end if;
  v := app_private.calculate_irrf_reduction_2026(5000.00,312.89);
  if v <> 312.89 then raise exception 'IRRF reduction 5000 expected 312.89 got %',v; end if;
end $$;

rollback;
