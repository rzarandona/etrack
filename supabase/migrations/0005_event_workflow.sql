-- 0005_event_workflow.sql
-- Phase 1 of the event-based payroll workflow.
--   * Wipes pre-launch test scans (clean slate before introducing event scoping).
--   * Renames supervisor_profiles → user_profiles, adds employee + pending roles.
--   * Adds employees.user_profile_id link (1:1 nullable until self-signup approval).
--   * Drops sites entirely.
--   * Adds events, event_phases, event_assignments.
--   * Adds cash_advances, message_threads + messages + reads + attachments,
--     violations.
--   * Rebinds scans to (event_id, phase_id) and adds self_clocked.
--   * RLS for all new tables + storage policies for the new bucket.
--
-- Portability note: stays Postgres-only constructs to a minimum (no jsonb,
-- no PG enums, no array columns, no DISTINCT ON). RLS policies are PG-only
-- and will be replaced with app-layer enforcement on a MySQL migration.

begin;

-- ============================================================
-- 0. CLEAN SLATE — wipe pre-launch test scans
-- ============================================================
delete from public.scans;

-- ============================================================
-- 1. supervisor_profiles → user_profiles, expand role enum
-- ============================================================
alter table public.supervisor_profiles rename to user_profiles;

alter table public.user_profiles
  drop constraint if exists supervisor_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('admin', 'supervisor', 'employee', 'pending'));

-- Helper functions (renamed table broke the body of the old definitions).
-- SECURITY DEFINER so inner select bypasses RLS — see 0002 for rationale.
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function public.is_supervisor()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role in ('admin','supervisor') and active
  );
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and active and role <> 'pending'
  );
$$;

-- Existing policies on the renamed table need recreation under new names
drop policy if exists supervisors_self_read on public.user_profiles;
create policy user_profiles_self_read on public.user_profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists supervisors_admin_write on public.user_profiles;
create policy user_profiles_admin_write on public.user_profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 2. Link employees ↔ user_profiles (employees can now log in)
-- ============================================================
alter table public.employees
  add column if not exists user_profile_id uuid references public.user_profiles(id);

create unique index if not exists employees_user_profile_unique
  on public.employees (user_profile_id) where user_profile_id is not null;

-- ============================================================
-- 3. Drop sites — must drop the dependent shifts view first because
--    its definition references scans.site_id. We rebuild it later
--    once event_id / phase_id are added to scans.
-- ============================================================
drop view if exists public.shifts;
alter table public.scans drop column if exists site_id;
drop table if exists public.sites cascade;

-- ============================================================
-- 4. Events
-- ============================================================
create table if not exists public.events (
  id                    uuid primary key default gen_random_uuid(),
  title                 varchar(200) not null,
  contact_person        varchar(160),
  contact_phone         varchar(40),
  venue                 text,
  venue_latitude        numeric(9,6),
  venue_longitude       numeric(9,6),
  starts_at             timestamp not null,
  ends_at               timestamp,
  contract_price        numeric(12,2),
  -- Per-event labor budget range (defaults 40-50%, override per event type)
  labor_budget_pct_min  numeric(4,2) not null default 0.40,
  labor_budget_pct_max  numeric(4,2) not null default 0.50,
  status                varchar(16) not null default 'planned'
                        check (status in ('planned','in_progress','completed','cancelled')),
  notes                 text,
  created_by            uuid references public.user_profiles(id),
  created_at            timestamp not null default (now() at time zone 'utc'),
  updated_at            timestamp not null default (now() at time zone 'utc')
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_status_idx   on public.events (status);

-- ============================================================
-- 5. Event phases (flexible 1..N per event)
-- ============================================================
create table if not exists public.event_phases (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  name        varchar(80) not null,         -- 'Ingress', 'Event Proper', 'Egress', or custom
  starts_at   timestamp,
  ends_at     timestamp,
  ord         integer not null,             -- display order within event
  pay_rate    numeric(10,2),                -- per-employee default for this phase
  notes       text,
  created_at  timestamp not null default (now() at time zone 'utc')
);

create unique index if not exists event_phases_event_ord_idx
  on public.event_phases (event_id, ord);
create index if not exists event_phases_event_idx on public.event_phases (event_id);

-- ============================================================
-- 6. Event assignments (supervisor + employee roster per event)
-- ============================================================
create table if not exists public.event_assignments (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  user_id             uuid not null references public.user_profiles(id),
  role                varchar(16) not null check (role in ('supervisor','employee')),
  -- Override of the phase default. NULL = use event_phases.pay_rate.
  pay_rate_override   numeric(10,2),
  created_at          timestamp not null default (now() at time zone 'utc')
);

create unique index if not exists event_assignments_unique_idx
  on public.event_assignments (event_id, user_id);
create index if not exists event_assignments_user_idx
  on public.event_assignments (user_id);

-- ============================================================
-- 7. Rebind scans to (event_id, phase_id) + self-clocked flag
-- ============================================================
alter table public.scans
  add column if not exists event_id     uuid references public.events(id) on delete cascade,
  add column if not exists phase_id     uuid references public.event_phases(id) on delete set null,
  add column if not exists self_clocked boolean not null default false;

create index if not exists scans_event_idx on public.scans (event_id);
create index if not exists scans_phase_idx on public.scans (phase_id);

-- Rebuild the shifts view (dropped earlier) around the new event/phase model.
-- A shift is a consecutive in/out pair for the same (employee, event, phase).
-- IS NOT DISTINCT FROM treats two NULLs as equal so legacy unscoped scans
-- still pair sensibly. Postgres-only; on MySQL migration this becomes a
-- stored procedure or app-layer logic.
create or replace view public.shifts as
with ordered as (
  select
    s.*,
    row_number() over (
      partition by employee_id, event_id, phase_id
      order by server_timestamp
    ) as rn
  from public.scans s
)
select
  i.employee_id,
  i.event_id,
  i.phase_id,
  i.id               as in_scan_id,
  o.id               as out_scan_id,
  i.server_timestamp as started_at,
  o.server_timestamp as ended_at,
  extract(epoch from (o.server_timestamp - i.server_timestamp)) / 3600.0
                     as hours,
  i.supervisor_id    as in_supervisor_id,
  o.supervisor_id    as out_supervisor_id
from ordered i
join ordered o
  on o.employee_id = i.employee_id
 and o.event_id is not distinct from i.event_id
 and o.phase_id is not distinct from i.phase_id
 and o.rn = i.rn + 1
where i.scan_type = 'in'
  and o.scan_type = 'out';

-- ============================================================
-- 8. Cash advances
-- ============================================================
create table if not exists public.cash_advances (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.user_profiles(id),
  amount           numeric(12,2) not null,
  advance_date     date not null,
  notes            text,
  -- pending  = newly recorded, not yet applied to a payroll
  -- applied  = deducted from the named applied_event_id payout
  -- deferred = explicitly skipped on the current event, will roll forward
  -- cancelled = wiped (e.g. data entry mistake)
  status           varchar(16) not null default 'pending'
                   check (status in ('pending','applied','deferred','cancelled')),
  applied_event_id uuid references public.events(id),
  created_by       uuid references public.user_profiles(id),
  created_at       timestamp not null default (now() at time zone 'utc')
);

create index if not exists cash_advances_user_idx   on public.cash_advances (user_id);
create index if not exists cash_advances_status_idx on public.cash_advances (status);

-- ============================================================
-- 9. Messaging (threads + participants + messages + reads + attachments)
-- ============================================================
create table if not exists public.message_threads (
  id          uuid primary key default gen_random_uuid(),
  subject     varchar(200),
  created_by  uuid not null references public.user_profiles(id),
  created_at  timestamp not null default (now() at time zone 'utc')
);

create table if not exists public.message_participants (
  thread_id  uuid not null references public.message_threads(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(id),
  primary key (thread_id, user_id)
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.message_threads(id) on delete cascade,
  sender_id   uuid not null references public.user_profiles(id),
  body        text not null,
  created_at  timestamp not null default (now() at time zone 'utc')
);

create index if not exists messages_thread_idx on public.messages (thread_id, created_at);

-- Per-user read receipts (one row per (message, reader) when they've seen it)
create table if not exists public.message_reads (
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references public.user_profiles(id),
  read_at     timestamp not null default (now() at time zone 'utc'),
  primary key (message_id, user_id)
);

create table if not exists public.message_attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.messages(id) on delete cascade,
  -- Path convention: {thread_id}/{message_id}/{filename}
  storage_path text not null,
  mime_type    varchar(100),
  file_name    varchar(255),
  size_bytes   integer,
  created_at   timestamp not null default (now() at time zone 'utc')
);

create index if not exists message_attachments_message_idx
  on public.message_attachments (message_id);

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

-- ============================================================
-- 10. Violations
-- ============================================================
create table if not exists public.violations (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid references public.events(id) on delete set null,
  phase_id     uuid references public.event_phases(id) on delete set null,
  reported_by  uuid not null references public.user_profiles(id),
  employee_id  uuid not null references public.user_profiles(id),
  description  text not null,
  severity     varchar(16) not null default 'minor'
               check (severity in ('minor','major','critical')),
  resolved     boolean not null default false,
  resolved_at  timestamp,
  created_at   timestamp not null default (now() at time zone 'utc')
);

create index if not exists violations_employee_idx on public.violations (employee_id);
create index if not exists violations_event_idx    on public.violations (event_id);

-- ============================================================
-- 11. RLS for all new tables
-- ============================================================
alter table public.events                enable row level security;
alter table public.event_phases          enable row level security;
alter table public.event_assignments     enable row level security;
alter table public.cash_advances         enable row level security;
alter table public.message_threads       enable row level security;
alter table public.message_participants  enable row level security;
alter table public.messages              enable row level security;
alter table public.message_reads         enable row level security;
alter table public.message_attachments   enable row level security;
alter table public.violations            enable row level security;

create or replace function public.is_assigned_to_event(event_uuid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.event_assignments
    where event_id = event_uuid and user_id = auth.uid()
  );
$$;

-- Events / phases / assignments: visible to anyone assigned + admins
create policy events_assigned_read on public.events
  for select using (public.is_admin() or public.is_assigned_to_event(id));
create policy events_admin_write on public.events
  for all using (public.is_admin()) with check (public.is_admin());

create policy event_phases_assigned_read on public.event_phases
  for select using (public.is_admin() or public.is_assigned_to_event(event_id));
create policy event_phases_admin_write on public.event_phases
  for all using (public.is_admin()) with check (public.is_admin());

create policy event_assignments_read on public.event_assignments
  for select using (public.is_admin() or public.is_assigned_to_event(event_id));
create policy event_assignments_admin_write on public.event_assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- Cash advances: caller sees own; admin sees + writes all
create policy cash_advances_self_read on public.cash_advances
  for select using (user_id = auth.uid() or public.is_admin());
create policy cash_advances_admin_write on public.cash_advances
  for all using (public.is_admin()) with check (public.is_admin());

-- Messaging: thread participants only (admins included for moderation)
create policy threads_participant_read on public.message_threads
  for select using (
    public.is_admin() or exists (
      select 1 from public.message_participants
      where thread_id = id and user_id = auth.uid()
    )
  );
create policy threads_create on public.message_threads
  for insert with check (created_by = auth.uid() and public.is_active_user());

create policy participants_read on public.message_participants
  for select using (
    public.is_admin() or user_id = auth.uid() or exists (
      select 1 from public.message_participants p2
      where p2.thread_id = thread_id and p2.user_id = auth.uid()
    )
  );
create policy participants_admin_write on public.message_participants
  for all using (public.is_admin()) with check (public.is_admin());

create policy messages_participant_read on public.messages
  for select using (
    public.is_admin() or exists (
      select 1 from public.message_participants
      where thread_id = messages.thread_id and user_id = auth.uid()
    )
  );
create policy messages_send on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.message_participants
      where thread_id = messages.thread_id and user_id = auth.uid()
    )
  );

create policy message_reads_self on public.message_reads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy message_attachments_read on public.message_attachments
  for select using (
    public.is_admin() or exists (
      select 1 from public.messages m
      join public.message_participants p on p.thread_id = m.thread_id
      where m.id = message_attachments.message_id and p.user_id = auth.uid()
    )
  );
create policy message_attachments_insert on public.message_attachments
  for insert with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.sender_id = auth.uid()
    )
  );

-- Storage policies for message-attachments bucket
-- Path convention: {thread_id}/{message_id}/{filename}
drop policy if exists "message-attachments: participant read" on storage.objects;
create policy "message-attachments: participant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (
      public.is_admin() or exists (
        select 1 from public.message_participants p
        where p.user_id = auth.uid()
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
      where p.user_id = auth.uid()
        and p.thread_id::text = (storage.foldername(name))[1]
    )
  );

-- Violations
create policy violations_read on public.violations
  for select using (
    public.is_admin()
    or employee_id = auth.uid()
    or reported_by = auth.uid()
    or (event_id is not null and public.is_assigned_to_event(event_id))
  );
create policy violations_supervisor_create on public.violations
  for insert with check (
    public.is_supervisor()
    and reported_by = auth.uid()
  );
create policy violations_admin_resolve on public.violations
  for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 12. Update existing scans RLS for the new world
--     (an employee can selfie-scan; supervisors must be assigned to the
--     event; the actor's scan must match their own auth uid as supervisor_id.)
-- ============================================================
drop policy if exists scans_insert_self on public.scans;
create policy scans_insert on public.scans
  for insert with check (
    public.is_active_user()
    and supervisor_id = auth.uid()
    and (
      event_id is null  -- legacy/global scans (unused going forward)
      or public.is_assigned_to_event(event_id)
    )
    and (
      -- supervisor scanning someone else
      (self_clocked = false and public.is_supervisor())
      -- or employee selfie: the auth user must be the linked user for this employee
      or (
        self_clocked = true and exists (
          select 1 from public.employees
          where id = scans.employee_id and user_profile_id = auth.uid()
        )
      )
    )
  );

drop policy if exists scans_read_own on public.scans;
create policy scans_read on public.scans
  for select using (
    public.is_admin()
    or supervisor_id = auth.uid()  -- I created this scan
    or exists (
      select 1 from public.employees
      where id = scans.employee_id and user_profile_id = auth.uid()
    )  -- this scan is about me
    or (event_id is not null and public.is_assigned_to_event(event_id))
  );

-- Storage policies on scan-photos: loosen "supervisor only" to "any active user"
-- so employees can upload their own selfie clock-in photos.
drop policy if exists "scan-photos: supervisor upload own folder" on storage.objects;
create policy "scan-photos: actor upload own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  );

commit;
