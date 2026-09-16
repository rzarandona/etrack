# etrack

Event-based payroll workflow for an event video / lights / sounds business.
Customers book events; each event has 1..N admin-defined phases (typically
Ingress / Event Proper / Egress); employees clock in/out per phase; payroll is
worked phases × pay rate. Roles: `admin`, `supervisor`, `employee`, `pending`.

This repository is an educational reference project for an offline-capable
payroll workflow built with Expo, Next.js, and Supabase. It is not a production
payroll system; review security, data-retention, and local employment
requirements before adapting it for real use.

## Layout

```
etrack/
├── mobile/        Expo (React Native) supervisor + employee app
├── admin/         Next.js admin web (events, employees, badges, scans, rates)
└── supabase/
    ├── migrations/    schema (portable Postgres / MySQL where possible)
    ├── seed.sql       minimal demo seed (admin + supervisor + a few employees)
    └── seed_dev.sql   30-row dev seed across every table except scans
```

## Quick start

### 1. Supabase project

1. Create a project at https://supabase.com.
2. In the SQL editor, run the migrations in numeric order:
   `0001_initial.sql` → `0002_rls.sql` → `0003_photo_verification.sql`
   → `0004_employee_fields.sql` → `0005_event_workflow.sql`
   → `0006_workforce_needed.sql` → `0007_badges_table.sql`
   → `0008_user_profile_auth_link.sql` → `0009_self_signup_policy.sql`
   → `0010_profile_id_translation.sql` → `0011_employees_self_read.sql`
   → `0012_admin_scans_bypass.sql` → `0013_scan_photos_authuid_path.sql`
   → `0014_drop_message_attachments_policies.sql`
   → `0015_pending_users_helper.sql`.
   They're idempotent (`if not exists` guards) and create the storage buckets
   along the way.
3. Create at least one admin auth user (Authentication → Users → Add user,
   tick "Auto Confirm User"). Copy the user's UID.
4. In the SQL editor, link that auth user to a `user_profiles` row with the
   `admin` role:
   ```sql
   insert into public.user_profiles (id, auth_user_id, full_name, role, active)
   values ('PASTE-UID-HERE', 'PASTE-UID-HERE', 'Your Name', 'admin', true);
   ```
   The convention is `id = auth_user_id` for users that can log in.
5. Optionally run `supabase/seed_dev.sql` for 30 seeded users / employees /
   events / etc. Seeded users are data-only — they won't have matching auth
   accounts and can't log in.

### 2. Admin web app

```bash
cd admin
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Use a project-specific Supabase URL and anon key. Never commit a `.env.local`
file or a Supabase service-role key.

Open http://localhost:3000 and sign in with the admin user. Pages:

- `/dashboard` — today's scans, active employees, mock-flag count, upcoming events
- `/employees` — list / search / filter, create / edit / deactivate / delete
- `/events` — table + calendar views, create / edit, phase editor, assignments,
  suggested pay rate calculator
- `/rates` — preset hourly rates used by the employee form
- `/badges` — pick employees → export ZIP of QR PNGs + CSV for the print vendor
- `/scans` — recent activity, photo viewer, filters
- `/cash-advances` — record and manage employee cash advances
- `/pending` — review self-signup requests
- `/violations` — record and review employee violations

### 3. Mobile app

```bash
cd mobile
cp .env.example .env
# fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start --tunnel   # tunnel is the reliable default for testing on a phone
```

Camera + GPS need a real device. SDK 54 typically requires a development
build via EAS (`eas build --profile development --platform android`).

### 4. Test scan flow

1. In admin: create an employee (or use a seeded one), then `/badges` →
   download a single badge or export the ZIP. Display the QR on screen.
2. In mobile (signed in as a supervisor): tap **Scan badge**, aim the camera
   at the QR.
3. Confirm screen shows the employee, picks In/Out from the last scan today,
   captures GPS, optional verification photo, **Submit**.
4. Scan goes to the offline queue and flushes when online (auto-syncs on
   reconnect via `@react-native-community/netinfo`).

## Badge production

Employees carry printed PVC cards with a QR encoding their `employees.id`
(uuid). The admin app's `/badges` page exports a ZIP containing one QR PNG per
selected employee plus an `employees.csv` with `employee_code, full_name,
employee_id, hourly_rate, qr_filename` — ready to hand to your PVC card
printing vendor.

## Data model

Source of truth: the migration files. Headline tables:

- `user_profiles` — every authed user; role = admin | supervisor | employee | pending.
  `id` is internal, `auth_user_id` links to `auth.users` for loginable users
  (NULL for seeded data).
- `employees` — HR-extension table; `user_profile_id` (nullable) links to
  the auth-bearing user_profile when the employee can log in.
- `events` + `event_phases` + `event_assignments` — the event workflow.
- `scans` — append-only clock-in/out events tied to `(event_id, phase_id)`.
- `cash_advances`, `messages` (+ threads + reads + attachments), `violations` —
  back-office workflow.
- `badges` — one row per employee tracking QR badge status.

## Backend portability

We start on Supabase (Postgres) but may move to MySQL when the payroll app
launches on shared hosting. The schema avoids Postgres-only types and features
where possible. RLS policies are defense-in-depth — the apps **also** enforce
authorization in app code (server actions call `requireAdmin()`), so removing
RLS during a MySQL migration won't open holes.

Supabase Auth is Postgres-bound; if migration becomes real, the cleanest path
is self-hosted Postgres (Supabase **is** Postgres) rather than MySQL — only
switch DB engines if hosting truly requires it.
