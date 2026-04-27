# etrack

Mobile time + location tracker. A supervisor scans an employee's QR badge; the
app records the employee, the supervisor, the scan type (clock-in / clock-out),
the server timestamp, and the device's GPS. Multiple in/out pairs per day are
supported (lunch, multi-site). Scan data feeds a separate payroll app.

## Layout

```
etrack/
├── mobile/        Expo (React Native) supervisor app
├── admin/         Next.js admin web app (employee CRUD, badge export, scan browser)
└── supabase/
    ├── migrations/    schema (portable Postgres / MySQL where possible)
    └── seed.sql       local dev seed data
```

## Quick start

### 1. Supabase project

1. Create a project at https://supabase.com.
2. In the SQL editor, run the migrations in order:
   `0001_initial.sql`, `0002_rls.sql`, `0003_photo_verification.sql`.
   The third migration also creates the private Storage bucket `scan-photos`
   used for verification photos.
3. Create at least one auth user (Authentication → Users → Add user).
4. In the SQL editor, insert a `supervisor_profiles` row whose `id` matches
   that auth user's id, with role `supervisor` or `admin`.
5. Optionally run `supabase/seed.sql` for demo employees and sites.

### 2. Mobile app

```bash
cd mobile
cp .env.example .env
# fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start
```

Scan the QR with **Expo Go** on iOS/Android, or press `a`/`i` to launch a
simulator. Camera + location need a real device or a configured simulator with
location set.

### 3. Admin web app

```bash
cd admin
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install   # already installed if you ran the scaffold; safe to re-run
npm run dev
```

Open http://localhost:3000 and sign in with an `admin` user. Pages:

- `/dashboard` — today's scan count, active employees, mock-location flags
- `/employees` — create / edit / deactivate; preserves history (no hard delete)
- `/badges` — pick employees, export ZIP of QR PNGs + CSV for the print vendor
- `/sites` — CRUD with lat/lng + geofence radius
- `/scans` — recent activity, photo viewer (signed URLs), `?mock=1` filter

### 4. Test scan flow

1. In the admin app, create an employee (or use the seeded ones), then go to
   **/badges** and export a ZIP. Open one QR PNG on screen.
2. In the mobile app, sign in as a supervisor.
3. Tap **Scan badge** and point the camera at the QR PNG.
4. On the confirm screen, pick **In** or **Out** (defaults based on the
   employee's last scan today), pick a site or "Off-site", optionally take a
   verification photo, and submit.

## Badge production

Employees carry printed PVC cards with a QR encoding their `employees.id`
(uuid). The admin app's `/badges` page exports a ZIP containing one QR PNG per
selected employee plus an `employees.csv` with `employee_code, full_name,
employee_id, hourly_rate, qr_filename` — ready to hand to your PVC card
printing vendor.

## Data model

Source of truth: `supabase/migrations/0001_initial.sql`.

- `employees` — id (uuid in QR), employee_code, full_name, photo_url, hourly_rate, active
- `supervisor_profiles` — links to Supabase auth.users; role = supervisor | admin
- `sites` — optional named job sites with geofence; `scans.site_id` is nullable
- `scans` — append-only event log: in/out, server_timestamp (authoritative),
  device_timestamp (audit), lat/long, accuracy, is_mock_location flag,
  client_scan_id (idempotency for offline replay)
- `shifts` — view that pairs consecutive in/out scans into worked intervals
  (Postgres-only; rebuild as a stored proc or app-layer logic on MySQL)

## Backend portability

We're starting on Supabase (Postgres) but may migrate to MySQL when the payroll
app launches on shared hosting. The schema avoids Postgres-only types and
features where possible. RLS policies in `0002_rls.sql` are defense-in-depth —
the mobile app **also** scopes inserts to the signed-in supervisor, so removing
RLS during a MySQL migration won't open holes.

Supabase Auth is Postgres-bound; if migration to MySQL becomes real, the
cleanest path is self-hosted Postgres (Supabase **is** Postgres) rather than
MySQL — only switch DB engines if hosting truly requires it.
