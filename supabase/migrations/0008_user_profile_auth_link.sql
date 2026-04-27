-- Decouple user_profiles.id from auth.users.id.
--
-- Before this migration: user_profiles.id was the primary key AND was assumed
-- (by convention) to equal auth.users.id. That made seeding awkward — every
-- seeded row needed a matching auth user or it was effectively orphaned.
--
-- After this migration:
--   * user_profiles.id is just an internal PK (auto-generated UUID).
--   * user_profiles.auth_user_id is the FK to auth.users.id when the row
--     represents a loginable user; NULL for seed/test data.
--   * Helpers and policies look up the caller via auth_user_id.
--   * All other tables that reference user_profiles.id keep working — they
--     point at internal IDs which don't change.
--
-- Existing rows: backfilled with auth_user_id = id (which used to be
-- auth.users.id by convention). If any historical row had id that was NOT
-- a real auth user, the FK constraint will reject the backfill — easiest
-- fix is to nullify those (already orphaned) rows manually before re-running.

begin;

-- 1. Add the new auth-link column.
alter table public.user_profiles
  add column if not exists auth_user_id uuid;

-- 2. Backfill from the existing convention (id was auth.users.id).
--    Skip rows whose `id` doesn't match an actual auth.users row.
update public.user_profiles up
set auth_user_id = up.id
where up.auth_user_id is null
  and exists (select 1 from auth.users au where au.id = up.id);

-- 3. Add the FK + uniqueness constraint now that backfill is in place.
alter table public.user_profiles
  drop constraint if exists user_profiles_auth_user_id_fkey;
alter table public.user_profiles
  add constraint user_profiles_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete set null;

create unique index if not exists user_profiles_auth_user_id_unique
  on public.user_profiles (auth_user_id) where auth_user_id is not null;

-- 4. Future inserts get a fresh internal id by default (seeds + new signups
--    no longer have to pick a UUID).
alter table public.user_profiles alter column id set default gen_random_uuid();

-- 5. Helpers: caller identity is now auth_user_id, not id. SECURITY DEFINER
--    so the inner select bypasses RLS — without it, the user_profiles_self_read
--    policy below recursively triggers these helpers and the query times out.
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where auth_user_id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function public.is_supervisor()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where auth_user_id = auth.uid() and role in ('admin','supervisor') and active
  );
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where auth_user_id = auth.uid() and active and role <> 'pending'
  );
$$;

-- 6. The user_profiles self-read policy lookups by auth_user_id now.
drop policy if exists user_profiles_self_read on public.user_profiles;
create policy user_profiles_self_read on public.user_profiles
  for select using (auth_user_id = auth.uid() or public.is_admin());

-- Note: the scans / event_assignments / cash_advances / messages / etc.
-- policies all rely on `supervisor_id = auth.uid()` or `user_id = auth.uid()`
-- where those columns reference user_profiles.id. For real users we still
-- follow the convention `id = auth_user_id` (signup creates them that way),
-- so those policies keep working unchanged. Seeded users have no auth.uid
-- and can't access these tables under RLS — which is the desired behavior.

commit;
