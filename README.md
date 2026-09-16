<h1 align="center">Etrack</h1>

<p align="center"><strong>Event payroll and workforce workflows.</strong></p>

<p align="center">
   An admin web app and offline-capable mobile app for planning event phases, managing employees, and recording verified attendance.
</p>

<p align="center">
   <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
   <img src="https://img.shields.io/badge/Expo-54-000020?logo=expo&logoColor=white" alt="Expo 54" />
   <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
   <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
   <img src="https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white" alt="Supabase and Postgres" />
</p>

---

## Overview

Etrack manages event-based payroll for video, lighting, and sound crews.
Customers book events with one or more admin-defined phases, such as Ingress,
Event Proper, and Egress. Employees clock in and out for each phase, and
payroll is calculated from worked phases and the assigned pay rate.

The system supports `admin`, `supervisor`, `employee`, and `pending` roles.
The admin web app manages events, workforce records, rates, badges, scans, and
back-office workflows. The mobile app lets supervisors and employees work from
a phone, including offline scan queuing and later synchronization.

## Tech Stack

### Platform

| Area | Technology |
| --- | --- |
| Admin application | Next.js 16, React 19, React DOM 19, TypeScript 5 |
| Admin styling | Tailwind CSS 4, PostCSS |
| Mobile application | Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9 |
| Mobile navigation | Expo Router 6, React Navigation 7 |
| Backend | Supabase, Postgres, Supabase Auth, Supabase Storage, Row Level Security |

### Admin Dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `@supabase/ssr` | 0.10.2 | Supabase session handling for server-rendered Next.js routes. |
| `@supabase/supabase-js` | 2.104.1 | Supabase database, authentication, and storage client. |
| `jszip` | 3.10.1 | QR badge ZIP exports. |
| `next` | 16.2.4 | Admin web application framework. |
| `qrcode` | 1.5.4 | Employee QR badge generation. |
| `react` | 19.2.4 | Admin interface runtime. |
| `react-dom` | 19.2.4 | React DOM renderer. |

### Admin Development Dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `@tailwindcss/postcss` | 4 | Tailwind CSS PostCSS integration. |
| `@types/node` | 20 | Node.js type definitions. |
| `@types/qrcode` | 1.5.6 | QRCode type definitions. |
| `@types/react` | 19 | React type definitions. |
| `@types/react-dom` | 19 | React DOM type definitions. |
| `eslint` | 9 | JavaScript and TypeScript linting. |
| `eslint-config-next` | 16.2.4 | Next.js linting rules. |
| `tailwindcss` | 4 | Utility-first CSS framework. |
| `typescript` | 5 | Type checking and compilation. |

### Mobile Dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `@expo/vector-icons` | 15.0.3 | Icon set for the mobile UI. |
| `@react-native-async-storage/async-storage` | 2.2.0 | Persistent local storage. |
| `@react-native-community/netinfo` | 11.4.1 | Network state for offline synchronization. |
| `@react-navigation/bottom-tabs` | 7.4.0 | Bottom-tab navigation. |
| `@react-navigation/elements` | 2.6.3 | Shared React Navigation components. |
| `@react-navigation/native` | 7.1.8 | Mobile navigation foundation. |
| `@supabase/supabase-js` | 2.104.1 | Supabase database, authentication, and storage client. |
| `expo` | 54.0.33 | Expo application platform. |
| `expo-camera` | 17.0.10 | QR badge scanning and photo capture. |
| `expo-constants` | 18.0.13 | Application configuration access. |
| `expo-dev-client` | 6.0.20 | Custom development builds. |
| `expo-file-system` | 19.0.21 | Device file access. |
| `expo-font` | 14.0.11 | Font loading. |
| `expo-haptics` | 15.0.8 | Tactile feedback. |
| `expo-image` | 3.0.11 | Optimized image rendering. |
| `expo-linking` | 8.0.11 | Deep-link handling. |
| `expo-location` | 19.0.8 | Scan-location capture. |
| `expo-router` | 6.0.23 | File-based routing. |
| `expo-secure-store` | 15.0.8 | Secure local credential storage. |
| `expo-splash-screen` | 31.0.13 | Native splash-screen control. |
| `expo-status-bar` | 3.0.9 | Status-bar configuration. |
| `expo-symbols` | 1.0.8 | SF Symbols integration. |
| `expo-system-ui` | 6.0.9 | Android system UI configuration. |
| `expo-web-browser` | 15.0.10 | In-app web browser support. |
| `react` | 19.1.0 | Mobile interface runtime. |
| `react-dom` | 19.1.0 | Web renderer for Expo web. |
| `react-native` | 0.81.5 | Native mobile UI runtime. |
| `react-native-gesture-handler` | 2.28.0 | Native gesture handling. |
| `react-native-get-random-values` | 1.11.0 | Cryptographic random-value polyfill. |
| `react-native-reanimated` | 4.1.1 | Native-driven animations. |
| `react-native-safe-area-context` | 5.6.0 | Safe-area insets. |
| `react-native-screens` | 4.16.0 | Native navigation screens. |
| `react-native-url-polyfill` | 3.0.0 | URL API polyfill. |
| `react-native-web` | 0.21.0 | React Native renderer for web. |
| `react-native-worklets` | 0.5.1 | Worklet runtime for animations. |
| `uuid` | 14.0.0 | Offline queue identifiers. |

### Mobile Development Dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `@expo/ngrok` | 4.1.3 | Expo tunnel support. |
| `@types/react` | 19.1.0 | React type definitions. |
| `eslint` | 9.25.0 | JavaScript and TypeScript linting. |
| `eslint-config-expo` | 10.0.0 | Expo linting rules. |
| `typescript` | 5.9.2 | Type checking and compilation. |

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
