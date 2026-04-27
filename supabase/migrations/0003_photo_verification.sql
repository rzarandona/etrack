-- Optional verification photo per scan. Supabase Storage + Postgres-only RLS.
-- On MySQL migration, photos move to whatever object store you adopt and these
-- policies get rewritten in the app layer.

-- 1. column on scans (nullable: photo is optional)
alter table public.scans
  add column if not exists verification_photo_url text;

-- 2. private bucket for scan photos
insert into storage.buckets (id, name, public)
values ('scan-photos', 'scan-photos', false)
on conflict (id) do nothing;

-- 3. RLS on storage.objects.
--    Path convention enforced by the app:  {supervisor_uid}/{client_scan_id}.jpg
--    Photos are append-only. There is intentionally no update or delete policy.

drop policy if exists "scan-photos: supervisor upload own folder" on storage.objects;
create policy "scan-photos: supervisor upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_supervisor()
  );

drop policy if exists "scan-photos: supervisor read own, admin read all" on storage.objects;
create policy "scan-photos: supervisor read own, admin read all"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'scan-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
