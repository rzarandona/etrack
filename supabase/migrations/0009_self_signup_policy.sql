-- Allow a freshly-signed-up user to create their own user_profiles row with
-- role='pending'. Without this policy, the mobile signup flow can't insert
-- because the existing user_profiles_admin_write policy requires is_admin().
-- The constraint here is strict: caller must own the row (auth_user_id =
-- auth.uid()) and the role MUST be 'pending'. They cannot self-promote to
-- supervisor / employee / admin — that's an admin-only action.

drop policy if exists user_profiles_self_create on public.user_profiles;
create policy user_profiles_self_create on public.user_profiles
  for insert with check (
    auth_user_id = auth.uid() and role = 'pending'
  );
