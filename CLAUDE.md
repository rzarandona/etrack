# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

etrack is an **event-based payroll workflow** for an event video / lights / sounds business. Customers book events; each event has 1..N admin-defined phases (typically `Ingress / Event Proper / Egress`); employees clock in/out per phase; payroll = worked phases × pay rate. Roles: `admin`, `supervisor`, `employee`, `pending` (self-signup awaiting admin approval).

The earlier "supervisor scans QR for time/location" model is gone. Every clock-in attaches to a `(event_id, phase_id)` pair. Sites are removed entirely.

## Repo layout

A monorepo with three deployable surfaces sharing one Supabase project:

```
etrack/
├── mobile/      Expo (RN) app — supervisor scan flow today; employee selfie clock-in arriving in Phase 3
├── admin/      Next.js admin web — employees, rates, badges, scans browser, dashboard; events arriving in Phase 2
└── supabase/   Schema migrations (run in order in Supabase SQL editor) + seed
```

`README.md` at the root has the original setup walkthrough; some of it is outdated post-Phase 1 (sites references) — refer to migration files for the current schema.

## Commands

All commands run from inside the relevant subdir. The repo has no root `package.json`.

**Mobile** (cd `mobile/`):
- `npm install` — first-time deps
- `npx expo start --tunnel` — Metro bundler with ngrok tunnel (LAN often fails behind firewalls; tunnel is the reliable default for testing)
- `npm run lint` — `expo lint`
- `npx tsc --noEmit` — typecheck (no `npm run typecheck` script defined)
- `eas build --profile development --platform android` — build the dev client APK (required for SDK 54 on most current Expo Go installs; build profiles in `eas.json`). Native modules (`@react-native-community/netinfo`, `expo-file-system`, `expo-camera`, `expo-location`, `expo-secure-store`) need a fresh dev-client build to take effect — JS reload alone won't pick them up.

**Admin** (cd `admin/`):
- `npm install`
- `npm run dev` — Next.js dev server on `:3000`
- `npm run build` / `npm run start` — production
- `npm run lint`
- `npx tsc --noEmit` — typecheck
- See `admin/AGENTS.md` for important Next.js 16 deltas before writing Next code.

**Supabase**: run migrations in numeric order via the Supabase dashboard's SQL editor: `0001_initial.sql` → `0002_rls.sql` → `0003_photo_verification.sql` → `0004_employee_fields.sql` → `0005_event_workflow.sql`, then optionally `seed.sql`. Each migration is idempotent (`if not exists` guards, etc.).

## Phased rollout

The event workflow is shipping in phases (each independently deployable):
1. ✅ **Schema + auth migration** — `0005_event_workflow.sql` (renamed `supervisor_profiles` → `user_profiles`, dropped sites, added events / phases / assignments / cash advances / messaging / violations).
2. **Admin event management** — events CRUD, phase editor, assignments, calendar view, suggested pay rate calculator.
3. **Mobile employee role** — employee login, "my events" list, selfie clock-in per phase.
4. **Mobile supervisor scoping** — supervisor sees only assigned events + assigned employees (offline cache narrows accordingly).
5. **Cash advances + messaging + violations** admin/self views.
6. **Self-signup + Facebook OAuth**.
7. **Reports + payslip export**.

When working in this repo, find out which phase is current before changing things — schema landed but UI is mid-Phase-2.

## Architecture you can't see by glancing at one file

### Schema portability (Supabase → MySQL)

The Postgres schema is intentionally written to be portable to MySQL because hosting may need to switch when payroll launches. **Avoid PG-only types/features** in new migrations and app code:

- No `jsonb`, `timestamptz`, PG `enum`, array columns, materialized views, `LATERAL`, `DISTINCT ON`, or PG-specific JSON operators.
- Use `varchar` + `CHECK` constraints instead of enums; `timestamp` (UTC convention) instead of `timestamptz`; `numeric` for money.
- UUIDs stay `uuid` in Postgres but conceptually map to `char(36)` for MySQL.
- **RLS is defense-in-depth, not the only line.** App code (mobile + admin server actions) **also** enforces authorization, because RLS doesn't exist in MySQL and `auth.uid()` checks would have to be rewritten on migration.
- Supabase Auth is Postgres-bound. If migrating, the cleanest target is self-hosted Postgres (Supabase **is** Postgres), not MySQL.

The `shifts` view (in `0001_initial.sql`) is the one Postgres-only piece — annotated with a comment to rebuild as a stored proc or app-layer logic on migration.

### User accounts and roles

- Single `user_profiles` table (renamed from `supervisor_profiles` in 0005). Role is `admin | supervisor | employee | pending`. Every authed user has exactly one row keyed by their `auth.users.id`.
- `employees` is the HR-extension table: hourly_rate, photo, address, contact, badge QR, etc. It carries a nullable `user_profile_id` linking to the auth user — NULL until that employee self-signs up and admin approves them (changes their `user_profiles.role` from `pending` to `employee`).
- Helper functions: `is_admin()`, `is_supervisor()` (admin counts as supervisor), `is_active_user()` (active + role ≠ pending), `is_assigned_to_event(event_uuid)`.

### Event scoping (RLS)

- `events`, `event_phases`, `event_assignments` are visible to admins + anyone in `event_assignments` for that event. Admins manage the rosters.
- `scans` are scoped: a row is readable by admins, by the actor who created it, by the employee it's about (via `employees.user_profile_id`), or by anyone assigned to the same event. Inserting a scan requires the actor to be active **and** assigned to the event (when `event_id` is set), **and** the action matches their role: supervisors must `is_supervisor()` for non-self scans; employees must own the `employees.user_profile_id` for `self_clocked = true` selfies.
- Pre-Phase-2 mobile code submits scans with `event_id = null` (legacy / unscoped); the policy allows that to keep the existing scan flow working until events ship.

### Mobile offline architecture

The app is built for offline-first operation in the field:

1. **Directory cache** ([mobile/lib/directory.ts](mobile/lib/directory.ts)) — stores active employees in `AsyncStorage` so the `confirm` screen can resolve names with no network. Will narrow to "employees on my upcoming events" in Phase 4.
2. **Pending scan queue** ([mobile/lib/queue.ts](mobile/lib/queue.ts)) — every scan is enqueued before submit. Each entry has a client-generated `client_scan_id` (server-side `unique` constraint ⇒ idempotent retry). Photos persist to `${FileSystem.documentDirectory}etrack/photos/` so they survive app restarts.
3. **Auto-sync on reconnect** ([mobile/lib/use-auto-sync.ts](mobile/lib/use-auto-sync.ts)) — `@react-native-community/netinfo` listener watches offline→online transitions and flushes the queue. Loaded lazily via `require()` with try/catch so a stale dev client without the native module degrades to manual sync instead of crashing.
4. **Photo upload from RN** — `fetch(file://...).blob()` produces a Blob that `supabase-js` cannot actually read on RN; uploads silently fail. The queue reads via `FileSystem.readAsStringAsync({ encoding: 'base64' })` and uploads as a `Uint8Array` decoded with `globalThis.atob`. **Don't change this back to Blob.**
5. **Mock-location** is an app-layer hard block (`coords.mocked === true`, Android only). Geofence enforcement against site lat/lng was removed when sites were dropped; will return in Phase 2 tied to `events.venue_latitude/longitude`.

### Admin auth & Next.js 16 specifics

- `admin/CLAUDE.md` chains to `admin/AGENTS.md` which warns Next.js 16 has breaking changes from training-data conventions; **read `node_modules/next/dist/docs/` before introducing new Next idioms.** Notable already-bitten items:
  - `middleware.ts` is renamed to **`proxy.ts`** with exported `proxy` function, not `middleware`.
  - `params` and `searchParams` are now `Promise`s — `await` them.
- Auth is `@supabase/ssr` cookie-based: [admin/lib/supabase/server.ts](admin/lib/supabase/server.ts), [client.ts](admin/lib/supabase/client.ts), [middleware.ts](admin/lib/supabase/middleware.ts) (still named `middleware.ts` inside `lib/`; only the root convention file is `proxy.ts`). Server clients are `await`ed because `cookies()` is async.
- `requireAdmin()` ([admin/lib/auth.ts](admin/lib/auth.ts)) gates the `(admin)` route layout AND must be called inside every server action — per Next 16 docs, server actions are POSTs to the route they live in and a proxy matcher tweak can silently bypass them.
- Server actions return `{ ok: true; id?: string } | { ok: false; error: string }` consistently. Mutations call `revalidatePath` for affected routes.
- **Phase 2 onward, prefer JS/AJAX-driven mutations** (Supabase JS client from client components + optimistic UI) over server-action-with-revalidatePath where it makes UX feel snappier. Keep server actions for sensitive ops (badge gen, photo move, anything that must run server-only).

### Employee photo + QR pipeline

When admin saves an employee:
1. Client uploads photo to `employee-photos/staging/{ts}-{rand}.{ext}` (path is a temp upload — employee `id` doesn't exist yet at create time).
2. Server action in [admin/app/(admin)/employees/actions.ts](admin/app/(admin)/employees/actions.ts) inserts the row, then **moves** staging file to `{employee.id}/photo.{ext}`.
3. Same action calls [admin/lib/badge.ts](admin/lib/badge.ts) → `generateAndStoreBadge()` to render a QR (encoding the employee uuid) at `{employee.id}/badge.png` with `upsert: true`.
4. Row is updated with both paths. Photo + QR upload failures are logged but don't roll back the employee — the row stays.
5. The badge QR is scanned by the mobile app. The QR encodes the bare uuid; the mobile scanner validates with a UUID regex before navigating to the confirm screen.

The `/badges` page batches signed URLs and exports a ZIP of pre-generated PNGs + a CSV (`employees.csv`) for the PVC card vendor — see [admin/app/api/badges/export/route.ts](admin/app/api/badges/export/route.ts).

### Design system

`admin/app/globals.css` defines the design tokens (`--bg`, `--accent`, `--ink`, `--muted`, `--line`, etc.) sourced from `admin/assets/payroli-dashboard.html` (the design mockup — keep it as the visual source of truth). Reusable utility classes: `.card`, `.ring-soft`, `.btn-primary` / `.btn-secondary` / `.btn-ghost-danger`, `.input`, `.label`, `.pill` + status variants, `.text-muted` / `.text-deep` / etc., `.avatar-bg-orange`. Global rules capitalize headings, buttons, and table headers automatically.

Shared components live in [admin/lib/components/](admin/lib/components/): `<Avatar>`, `<StatusPill>`, `<ScanTypePill>`, `<MockFlagPill>`. Helpers: [admin/lib/storage.ts](admin/lib/storage.ts) for batch-signing storage paths, [admin/lib/format.ts](admin/lib/format.ts) for the canonical scan timestamp format.

## Conventions worth knowing

- **No commits unless asked.** This repo lives at `git@github.com:rzarandona/etrack.git` on `main`. Keep commits as new commits (don't amend) and don't push without explicit instruction.
- **Hours are denormalized at save time.** Editing a `rates` row does **not** retroactively change `employees.hourly_rate` — the picked rate is copied to the employee record so payroll history stays correct. Same principle for `event_assignments.pay_rate_override` vs `event_phases.pay_rate`.
- **Append-only scans.** No update/delete RLS policy exists for `scans`. If a record is wrong, fix it via a counter-scan or admin override outside the app — don't add a delete path.
- **Cash advances default to "deduct from event payout"** (`status='applied'` against `applied_event_id`) but admin can flip to `deferred` to roll forward to a future event.
- **Facebook is the only chosen social-login provider.** Google/etc. are not in scope. Configure dashboard credentials only when running the Phase 5 pre-build test (a memory entry tracks this so future agents prompt the user at the right moment).
