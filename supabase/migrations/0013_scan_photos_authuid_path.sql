-- Revert scan-photos write policy to key on auth.uid(), not current_profile_id().
--
-- 0010 rewrote the policy to use public.current_profile_id() so the path
-- would mirror user_profiles.id. In practice that fails inside Supabase
-- Storage's RLS context with "database schema is invalid or incompatible"
-- because Storage can't always resolve cross-schema SECURITY DEFINER calls.
-- The path is just an opaque folder per user — the read policy already keys
-- on auth.uid()::text — so keeping write on auth.uid() is the simplest fix.

drop policy if exists "scan-photos: actor upload own folder" on storage.objects;
create policy "scan-photos: actor upload own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  );
