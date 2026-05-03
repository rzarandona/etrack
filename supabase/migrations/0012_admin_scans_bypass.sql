-- Allow admins to insert scans for any event without needing an
-- event_assignments row. Other event-related policies already short-circuit on
-- is_admin(); scans_insert was missed. Without this, an admin scanning a
-- badge for an event they aren't assigned to gets the insert rejected and the
-- scan stays stuck in the offline queue.

drop policy if exists scans_insert on public.scans;
create policy scans_insert on public.scans
  for insert with check (
    public.is_active_user()
    and supervisor_id = public.current_profile_id()
    and (
      event_id is null
      or public.is_admin()
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
