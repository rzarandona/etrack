-- Translate auth.uid() → user_profiles.id in every RLS policy that compares
-- against a column holding user_profiles.id.
--
-- Background: migration 0008 decoupled user_profiles.id from auth.users.id.
-- After that, comparing `<column> = auth.uid()` (where the column references
-- user_profiles.id) is wrong unless the user happens to satisfy id =
-- auth_user_id. New signups and hand-linked seed users (id ≠ auth_user_id)
-- silently couldn't see their events, scans, messages, etc.
--
-- This migration introduces public.current_profile_id() and rewrites every
-- affected policy + helper to go through it.

begin;

-- Helper: returns the internal user_profiles.id for the current auth user, or
-- NULL when no profile is linked. SECURITY DEFINER so the lookup bypasses the
-- user_profiles_self_read policy (same recursion-avoidance pattern as is_admin).
create or replace function public.current_profile_id()
returns uuid language sql stable security definer
set search_path = public as $$
  select id from public.user_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- is_assigned_to_event compared event_assignments.user_id (a user_profiles.id)
-- to auth.uid() directly. Translate via auth_user_id.
create or replace function public.is_assigned_to_event(event_uuid uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1
    from public.event_assignments ea
    join public.user_profiles up on up.id = ea.user_id
    where ea.event_id = event_uuid and up.auth_user_id = auth.uid()
  );
$$;

-- ---- cash_advances --------------------------------------------------------
drop policy if exists cash_advances_self_read on public.cash_advances;
create policy cash_advances_self_read on public.cash_advances
  for select using (user_id = public.current_profile_id() or public.is_admin());

-- ---- messaging ------------------------------------------------------------
drop policy if exists threads_participant_read on public.message_threads;
create policy threads_participant_read on public.message_threads
  for select using (
    public.is_admin() or exists (
      select 1 from public.message_participants
      where thread_id = id and user_id = public.current_profile_id()
    )
  );

drop policy if exists threads_create on public.message_threads;
create policy threads_create on public.message_threads
  for insert with check (
    created_by = public.current_profile_id() and public.is_active_user()
  );

drop policy if exists participants_read on public.message_participants;
create policy participants_read on public.message_participants
  for select using (
    public.is_admin()
    or user_id = public.current_profile_id()
    or exists (
      select 1 from public.message_participants p2
      where p2.thread_id = message_participants.thread_id
        and p2.user_id = public.current_profile_id()
    )
  );

drop policy if exists messages_participant_read on public.messages;
create policy messages_participant_read on public.messages
  for select using (
    public.is_admin() or exists (
      select 1 from public.message_participants
      where thread_id = messages.thread_id
        and user_id = public.current_profile_id()
    )
  );

drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages
  for insert with check (
    sender_id = public.current_profile_id()
    and exists (
      select 1 from public.message_participants
      where thread_id = messages.thread_id
        and user_id = public.current_profile_id()
    )
  );

drop policy if exists message_reads_self on public.message_reads;
create policy message_reads_self on public.message_reads
  for all using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

drop policy if exists message_attachments_read on public.message_attachments;
create policy message_attachments_read on public.message_attachments
  for select using (
    public.is_admin() or exists (
      select 1 from public.messages m
      join public.message_participants p on p.thread_id = m.thread_id
      where m.id = message_attachments.message_id
        and p.user_id = public.current_profile_id()
    )
  );

drop policy if exists message_attachments_insert on public.message_attachments;
create policy message_attachments_insert on public.message_attachments
  for insert with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.sender_id = public.current_profile_id()
    )
  );

drop policy if exists "message-attachments: participant read" on storage.objects;
create policy "message-attachments: participant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (
      public.is_admin() or exists (
        select 1 from public.message_participants p
        where p.user_id = public.current_profile_id()
          and p.thread_id::text = (storage.foldername(name))[1]
      )
    )
  );

drop policy if exists "message-attachments: participant write" on storage.objects;
create policy "message-attachments: participant write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and public.is_active_user()
    and exists (
      select 1 from public.message_participants p
      where p.user_id = public.current_profile_id()
        and p.thread_id::text = (storage.foldername(name))[1]
    )
  );

-- ---- violations -----------------------------------------------------------
drop policy if exists violations_read on public.violations;
create policy violations_read on public.violations
  for select using (
    public.is_admin()
    or employee_id = public.current_profile_id()
    or reported_by = public.current_profile_id()
    or (event_id is not null and public.is_assigned_to_event(event_id))
  );

drop policy if exists violations_supervisor_create on public.violations;
create policy violations_supervisor_create on public.violations
  for insert with check (
    public.is_supervisor()
    and reported_by = public.current_profile_id()
  );

-- ---- scans ---------------------------------------------------------------
drop policy if exists scans_insert on public.scans;
create policy scans_insert on public.scans
  for insert with check (
    public.is_active_user()
    and supervisor_id = public.current_profile_id()
    and (
      event_id is null
      or public.is_assigned_to_event(event_id)
    )
    and (
      (self_clocked = false and public.is_supervisor())
      or (
        self_clocked = true and exists (
          select 1 from public.employees
          where id = scans.employee_id
            and user_profile_id = public.current_profile_id()
        )
      )
    )
  );

drop policy if exists scans_read on public.scans;
create policy scans_read on public.scans
  for select using (
    public.is_admin()
    or supervisor_id = public.current_profile_id()
    or exists (
      select 1 from public.employees
      where id = scans.employee_id
        and user_profile_id = public.current_profile_id()
    )
    or (event_id is not null and public.is_assigned_to_event(event_id))
  );

-- ---- scan-photos storage --------------------------------------------------
-- Path convention is {user_profile_id}/{client_scan_id}.jpg (the actor's
-- internal id, not their auth uid).
drop policy if exists "scan-photos: supervisor upload own folder" on storage.objects;
drop policy if exists "scan-photos: actor upload own folder" on storage.objects;
create policy "scan-photos: actor upload own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = public.current_profile_id()::text
    and public.is_active_user()
  );

commit;
