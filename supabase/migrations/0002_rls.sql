-- Row-Level Security policies (Supabase / Postgres only).
-- These are defense-in-depth: app code MUST also enforce these checks,
-- because RLS does not exist in MySQL and will be dropped on migration.

alter table public.employees             enable row level security;
alter table public.sites                 enable row level security;
alter table public.supervisor_profiles   enable row level security;
alter table public.scans                 enable row level security;

-- Helpers query user_profiles directly. Marked SECURITY DEFINER so the
-- inner select bypasses RLS — otherwise self-read policies that themselves
-- call these helpers create exponential recursion that blows the statement
-- timeout. Functions only return a boolean derived from auth.uid(), no
-- data is leaked.

-- Helper: is the caller an admin?
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.supervisor_profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

-- Helper: is the caller an active supervisor or admin?
create or replace function public.is_supervisor()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.supervisor_profiles
    where id = auth.uid() and active
  );
$$;

-- employees: any active supervisor can read; only admins write
create policy employees_read on public.employees
  for select using (public.is_supervisor());
create policy employees_write_admin on public.employees
  for all using (public.is_admin()) with check (public.is_admin());

-- sites: any supervisor reads; admin writes
create policy sites_read on public.sites
  for select using (public.is_supervisor());
create policy sites_write_admin on public.sites
  for all using (public.is_admin()) with check (public.is_admin());

-- supervisor_profiles: a user can read their own row; admins read all
create policy supervisors_self_read on public.supervisor_profiles
  for select using (id = auth.uid() or public.is_admin());
create policy supervisors_admin_write on public.supervisor_profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- scans: a supervisor inserts their own scans; reads their own;
--        admins read everything.
create policy scans_insert_self on public.scans
  for insert with check (
    supervisor_id = auth.uid() and public.is_supervisor()
  );
create policy scans_read_own on public.scans
  for select using (supervisor_id = auth.uid() or public.is_admin());
-- intentionally NO update/delete policy: scans are append-only audit data.
