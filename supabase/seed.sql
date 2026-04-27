-- Local dev seed. Do NOT run in production.
-- Assumes Supabase auth users already exist with the UUIDs you replace below.

insert into public.user_profiles (id, full_name, role, active)
values
  ('00000000-0000-0000-0000-000000000001', 'Demo Admin',      'admin',      true),
  ('00000000-0000-0000-0000-000000000002', 'Demo Supervisor', 'supervisor', true)
on conflict (id) do nothing;

insert into public.employees (employee_code, full_name, hourly_rate)
values
  ('EMP-0001', 'Juan Dela Cruz', 125.00),
  ('EMP-0002', 'Maria Santos',   150.00),
  ('EMP-0003', 'Pedro Reyes',    110.00)
on conflict (employee_code) do nothing;
