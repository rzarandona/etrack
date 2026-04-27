-- Expand the employees record + add a rates lookup table + a private storage
-- bucket for employee photos and pre-generated QR badges.
--
-- Required-ness for the new fields is enforced in the application layer so
-- this migration is safe to run on a database that already has employee rows.

alter table public.employees
  add column if not exists home_address              text,
  add column if not exists home_latitude             numeric(9,6),
  add column if not exists home_longitude            numeric(9,6),
  add column if not exists contact_no                varchar(40),
  add column if not exists birthdate                 date,
  add column if not exists emergency_contact_name    varchar(160),
  add column if not exists emergency_contact_number  varchar(40),
  add column if not exists qr_badge_url              text;
-- (photo_url already exists from 0001_initial.sql)

-- =====================================================================
-- Rates: preset hourly_rate values an admin can pick when creating /
-- editing an employee. The selected value is denormalized to
-- employees.hourly_rate at save time so editing a rate later does not
-- retroactively change historical payroll calculations.
-- =====================================================================
create table if not exists public.rates (
  id           uuid primary key default gen_random_uuid(),
  label        varchar(80) not null,
  hourly_rate  numeric(10,2) not null,
  active       boolean     not null default true,
  created_at   timestamp   not null default (now() at time zone 'utc')
);

create index if not exists rates_active_idx on public.rates (active);

alter table public.rates enable row level security;

drop policy if exists rates_read on public.rates;
create policy rates_read on public.rates
  for select using (public.is_supervisor());

drop policy if exists rates_write_admin on public.rates;
create policy rates_write_admin on public.rates
  for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- Storage bucket for employee photos and pre-generated QR badges.
-- Path conventions (enforced by the app):
--   {employee_id}/photo.{ext}
--   {employee_id}/badge.png
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', false)
on conflict (id) do nothing;

drop policy if exists "employee-photos: admin write" on storage.objects;
create policy "employee-photos: admin write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'employee-photos' and public.is_admin());

drop policy if exists "employee-photos: admin update" on storage.objects;
create policy "employee-photos: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'employee-photos' and public.is_admin())
  with check (bucket_id = 'employee-photos' and public.is_admin());

drop policy if exists "employee-photos: admin delete" on storage.objects;
create policy "employee-photos: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'employee-photos' and public.is_admin());

drop policy if exists "employee-photos: supervisor read" on storage.objects;
create policy "employee-photos: supervisor read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'employee-photos' and public.is_supervisor());
