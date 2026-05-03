-- Allow employees to read their own employees row.
--
-- Background: 0002 set employees_read = is_supervisor(). That makes sense for
-- the supervisor scan flow, but it also hides an employee's own HR record from
-- themselves — getMyEmployee() returns null and the mobile app shows "not
-- linked to an employee record yet" even when the linkage is correct.

drop policy if exists employees_self_read on public.employees;
create policy employees_self_read on public.employees
  for select using (
    user_profile_id = public.current_profile_id()
  );
