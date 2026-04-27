-- Promote QR badges to a first-class table so we can track status
-- (active / deleted) and cascade-delete cleanly when an employee is
-- removed.
--
-- One active badge per employee at a time. Soft-deleting a badge keeps
-- the row but flips its status; re-saving the employee upserts back to
-- 'active'. Hard-deleting an employee cascades the badge row away.

create table if not exists public.badges (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  storage_path  text not null,
  status        varchar(16) not null default 'active'
                check (status in ('active', 'deleted')),
  created_at    timestamp not null default (now() at time zone 'utc'),
  updated_at    timestamp not null default (now() at time zone 'utc')
);

-- One row per employee — `on conflict (employee_id)` upserts.
create unique index if not exists badges_employee_unique
  on public.badges (employee_id);

-- Backfill from the existing employees.qr_badge_url so existing data
-- has a corresponding badge row.
insert into public.badges (employee_id, storage_path, status)
select id, qr_badge_url, 'active'
from public.employees
where qr_badge_url is not null
on conflict (employee_id) do nothing;

-- RLS
alter table public.badges enable row level security;

drop policy if exists badges_admin_all on public.badges;
create policy badges_admin_all on public.badges
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists badges_supervisor_read on public.badges;
create policy badges_supervisor_read on public.badges
  for select using (public.is_supervisor());
