-- etrack initial schema
-- Designed to be portable to MySQL 8 — avoid PG-only types/features.
-- Conventions:
--   * Timestamps stored as UTC. Use timestamp (not timestamptz) for portability.
--   * No jsonb, no array columns, no PG enums, no RLS-as-only-defense.
--   * UUIDs are uuid in PG; map to char(36) on MySQL migration.
--   * Status / type fields are varchar + CHECK constraint (portable).

-- =====================================================================
-- employees: people who get paid; identified by the QR they carry
-- =====================================================================
create table if not exists public.employees (
  id              uuid primary key default gen_random_uuid(),
  employee_code   varchar(32)  not null unique,         -- e.g. EMP-0042, printed on the badge
  full_name       varchar(160) not null,
  photo_url       text,                                 -- shown on supervisor confirm screen
  hourly_rate     numeric(10,2),                        -- payroll input; nullable until set
  active          boolean      not null default true,
  created_at      timestamp    not null default (now() at time zone 'utc'),
  updated_at      timestamp    not null default (now() at time zone 'utc')
);

create index if not exists employees_active_idx on public.employees (active);

-- =====================================================================
-- sites: optional named job sites with geofence
-- =====================================================================
create table if not exists public.sites (
  id                  uuid primary key default gen_random_uuid(),
  name                varchar(160) not null,
  latitude            numeric(9,6),
  longitude           numeric(9,6),
  geofence_radius_m   integer,
  active              boolean   not null default true,
  created_at          timestamp not null default (now() at time zone 'utc')
);

-- =====================================================================
-- supervisor_profiles: extra fields for users with role=supervisor
-- We do NOT mirror Supabase auth.users; we link to it by id.
-- On migration to MySQL, this table absorbs auth fields (email, password_hash).
-- =====================================================================
create table if not exists public.supervisor_profiles (
  id          uuid primary key,                         -- == auth.users.id on Supabase
  full_name   varchar(160) not null,
  role        varchar(16)  not null default 'supervisor'
              check (role in ('supervisor','admin')),
  active      boolean      not null default true,
  created_at  timestamp    not null default (now() at time zone 'utc')
);

-- =====================================================================
-- scans: the core event stream. Each in/out punch is one row.
-- Multiple in/out pairs per employee per day are allowed.
-- =====================================================================
create table if not exists public.scans (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references public.employees(id),
  supervisor_id       uuid not null references public.supervisor_profiles(id),
  site_id             uuid references public.sites(id),  -- nullable: off-site / raw GPS scan

  scan_type           varchar(8) not null
                      check (scan_type in ('in','out')),

  -- timestamps: server is authoritative for payroll; device is audit-only
  server_timestamp    timestamp not null default (now() at time zone 'utc'),
  device_timestamp    timestamp not null,

  -- location: required for every scan, even when site_id is set
  latitude            numeric(9,6) not null,
  longitude           numeric(9,6) not null,
  accuracy_m          numeric(8,2),
  is_mock_location    boolean not null default false,   -- Android exposes this; flag for review

  -- offline replay safety: client generates uuid before submit
  client_scan_id      uuid not null unique,

  created_at          timestamp not null default (now() at time zone 'utc')
);

create index if not exists scans_employee_time_idx
  on public.scans (employee_id, server_timestamp);
create index if not exists scans_supervisor_time_idx
  on public.scans (supervisor_id, server_timestamp);
create index if not exists scans_site_time_idx
  on public.scans (site_id, server_timestamp);

-- =====================================================================
-- shifts (view): pair consecutive in/out scans into worked intervals.
-- Payroll reads from this. Multiple pairs per day are naturally supported.
--
-- NOTE: this view uses LATERAL which is Postgres-specific. On MySQL migration,
-- replace with a stored procedure or compute pairs in app code.
-- The raw scans table remains the source of truth either way.
-- =====================================================================
create or replace view public.shifts as
with ordered as (
  select
    s.*,
    row_number() over (partition by employee_id order by server_timestamp) as rn
  from public.scans s
)
select
  i.employee_id,
  i.id            as in_scan_id,
  o.id            as out_scan_id,
  i.server_timestamp as started_at,
  o.server_timestamp as ended_at,
  extract(epoch from (o.server_timestamp - i.server_timestamp)) / 3600.0
                  as hours,
  i.site_id       as in_site_id,
  o.site_id       as out_site_id,
  i.supervisor_id as in_supervisor_id,
  o.supervisor_id as out_supervisor_id
from ordered i
join ordered o
  on o.employee_id = i.employee_id
 and o.rn = i.rn + 1
where i.scan_type = 'in'
  and o.scan_type = 'out';
