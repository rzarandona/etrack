-- Local dev seed. Do NOT run in production.
-- Assumes a Supabase auth user already exists with a known UUID; replace below.

insert into public.supervisor_profiles (id, full_name, role)
values
  ('00000000-0000-0000-0000-000000000001', 'Demo Admin',      'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Demo Supervisor', 'supervisor')
on conflict (id) do nothing;

insert into public.sites (name, latitude, longitude, geofence_radius_m)
values
  ('Main Office',   14.5995, 120.9842,  75),
  ('Warehouse A',   14.6760, 121.0437, 100)
on conflict do nothing;

insert into public.employees (employee_code, full_name, hourly_rate)
values
  ('EMP-0001', 'Juan Dela Cruz',   125.00),
  ('EMP-0002', 'Maria Santos',     150.00),
  ('EMP-0003', 'Pedro Reyes',      110.00)
on conflict (employee_code) do nothing;
