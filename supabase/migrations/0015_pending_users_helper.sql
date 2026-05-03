-- SECURITY DEFINER helper that joins user_profiles to auth.users so the admin
-- "Pending users" page can show emails. Without this, the admin cookie session
-- has no read access to auth.users (that's reserved for the service role), and
-- we'd otherwise have to ship a service role key into the admin app just for
-- one screen.
--
-- The function gates on is_admin() so a leaked execute grant wouldn't expose
-- emails to non-admins.

create or replace function public.pending_users_with_email()
returns table (
  profile_id   uuid,
  full_name    varchar,
  email        text,
  auth_user_id uuid,
  created_at   timestamp
)
language sql stable security definer
set search_path = public, auth as $$
  select
    up.id          as profile_id,
    up.full_name   as full_name,
    au.email::text as email,
    up.auth_user_id,
    up.created_at
  from public.user_profiles up
  left join auth.users au on au.id = up.auth_user_id
  where public.is_admin()
    and up.role = 'pending'
    and up.active
  order by up.created_at desc;
$$;
