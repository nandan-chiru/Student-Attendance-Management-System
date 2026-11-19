<<<<<<< HEAD
# Student-Attendance-Management-System
A role-based student attendance management system built with Next.js, MySQL, Prisma, and MongoDB. It supports attendance tracking, risk and recovery analysis, dashboards, and asynchronous audit events.
=======
# Student Attendance Management System

A DBMS Level 3 Student Attendance Management System built on Next.js App Router and TypeScript, with MySQL-backed attendance workflows and MongoDB-backed event audit summaries.

See [REQUIREMENTS.md](REQUIREMENTS.md) for software prerequisites, configuration requirements, and functional scope.

## Project overview and problem statement

Attendance is often tracked in separate spreadsheets or manual registers, which makes it difficult to maintain a reliable history, calculate percentages consistently, identify students who may fall below a requirement, or restrict records to the right staff. This project provides a role-based web system that records finalized attendance in a relational database and derives summaries and risk guidance from those records.

## Features

- Auth.js credentials sign-in with `STUDENT`, `FACULTY`, and `ADMIN` roles.
- Faculty create/finalize attendance sessions for offerings assigned to them and mark the enrolled roster.
- Students view only their own course attendance, counts, history, risk, and recovery guidance.
- Faculty dashboards show assigned-offering attendance and student risk; admin dashboards show broader institution-level summaries.
- Attendance trends and percentages are calculated from finalized MySQL records. `EXCUSED` marks are excluded from the denominator.
- A transactional SQL outbox publishes minimal attendance-finalization audit events asynchronously to MongoDB.
- Admin and faculty can review authorized MongoDB audit history and aggregates.

## Technology stack

- Next.js App Router, React, TypeScript, and Tailwind CSS
- MySQL 8 with Prisma ORM
- Prisma's MariaDB driver adapter for Prisma Client
- MongoDB Node.js driver for the optional attendance event/audit foundation
- Git and GitHub

Authentication uses Auth.js Credentials with JWT-backed sessions. Passwords are verified against the existing bcrypt hashes; plaintext passwords are never stored.

The dependency manifest is `package.json` and `package-lock.json`. Install this Node.js project with `npm ci`; `pip install -r requirements.txt` is not applicable because the application is not written in Python. The `REQUIREMENTS.md` file documents system prerequisites and project requirements; it is not a Python package list.

## Database architecture

MySQL is the primary and canonical relational source of truth for users and profiles, academic terms, courses and offerings, enrollments, attendance sessions, attendance records, and the SQL outbox. Attendance percentages are calculated only from attendance records in finalized sessions.

MySQL remains the system of record. MongoDB is the secondary NoSQL store for immutable attendance event/audit history and event-based aggregation/reporting. Attendance sessions, attendance records, and percentages are not duplicated there. Attendance finalization writes an event to the existing SQL `OutboxEvent` table in the same MySQL transaction as its session and records. A standalone worker validates pending outbox events, persists them idempotently to MongoDB, then conditionally marks them delivered in MySQL. Stage 7D uses MongoDB aggregation for scoped audit summaries and history.

## System architecture

```text
Student / Faculty / Admin browser
              ↓
       Next.js App Router
       Auth.js + role checks
              ↓
  Server pages / actions / services
              ↓
    Data access and SQL queries
              ↓
   MySQL (canonical application data)
    ├─ attendance sessions and records
    └─ outbox event in same transaction
              ↓ (standalone worker, after commit)
   MongoDB student_attendance database
       attendance_events (audit projection)
```

Attendance operations and percentages use MySQL. MongoDB is an asynchronous audit/event projection, not a second attendance source of truth. If MongoDB is unavailable, a successfully committed MySQL attendance transaction remains valid and its outbox event can be retried later.

## MySQL outbox and MongoDB audit flow

1. Faculty finalizes an attendance session through the authorized Next.js server action.
2. One MySQL transaction writes the finalized session, attendance records, and one pending `OutboxEvent` (`deliveredAt` is null).
3. The separate `npm run db:outbox-worker` process reads pending events after commit and validates each event payload.
4. The worker persists the event in MongoDB `student_attendance.attendance_events`, using the stable `eventId` for idempotent delivery.
5. Only after MongoDB confirms the event is stored does the worker set MySQL `OutboxEvent.deliveredAt`.
6. Admin/faculty audit pages aggregate MongoDB event history. Attendance status, percentages, and risk calculations still come from MySQL.

The worker can be stopped and restarted. Failed or unavailable MongoDB delivery leaves the SQL event pending for retry; no MongoDB network request runs inside the attendance transaction.

## Local prerequisites

- Node.js 20.9 or newer and npm
- MySQL 8.0.16 or newer (the migration includes enforced `CHECK` constraints)
- Git

MongoDB Atlas or a reachable MongoDB server is needed for the outbox worker, MongoDB health check, and audit pages. MongoDB is optional for the core MySQL attendance workflow. MongoDB Compass is optional; it is only a GUI for browsing MongoDB and does not need to stay open while the application runs. The worker requires both database configurations and runs separately from Next.js.

## Environment configuration

Copy `.env.example` to `.env` and set local values. Replace the illustrative values before running the application. The file is ignored by Git.

```dotenv
DATABASE_URL="mysql://<user>:<password>@localhost:3306/student_attendance"
MONGODB_URI=<Atlas-or-local-MongoDB-URI>
AUTH_SECRET=<generate-a-random-secret>
DEMO_SEED_PASSWORD=
ATTENDANCE_TEST_DATABASE_URL=
```

URL-encode reserved characters in the database username/password. `DEMO_SEED_PASSWORD` is only needed when running the development seed. Choose a throwaway local password; the script hashes it with bcrypt before storing it. All demo users receive that same hash. Never commit `.env` or share the seed password. No credentials are stored in source control.

## Setup on Windows

Open PowerShell in the project folder. Start your installed MySQL service. If using a local MongoDB server, start it too; Atlas is hosted remotely and needs no local MongoDB service. Service names vary, so find the names first:

```powershell
Get-Service | Where-Object { $_.Name -match 'mysql|maria|mongo' -or $_.DisplayName -match 'mysql|maria|mongo' } | Format-Table Name, Status, DisplayName
# Replace these examples with the service names shown above:
Start-Service -Name 'MySQL80'
Start-Service -Name 'MongoDB'
```

For MySQL managed by XAMPP, use the XAMPP Control Panel instead. From the repository folder, create `.env` only if it does not exist, edit it locally, then install dependencies and check Prisma:

```powershell
Set-Location "C:\path\to\Student Attendance Management System"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
npm.cmd ci
npm.cmd run db:validate
npm.cmd run db:generate
npx.cmd prisma migrate status
```

Set `DATABASE_URL` to the MySQL `student_attendance` database, `MONGODB_URI` to your Atlas or local MongoDB URI, and `AUTH_SECRET` to a private random secret. Set `DEMO_SEED_PASSWORD` only if you need to seed development accounts. Keep credentials in `.env`, not in Git or this README.

If `migrate status` reports pending migrations, apply only the checked-in migrations:

```powershell
npx.cmd prisma migrate deploy
```

Do not run `prisma migrate reset`. Seed only a new/empty development database. The seed script upserts demo users and updates their password hashes to the current `DEMO_SEED_PASSWORD`; do not run it on every startup:

```powershell
npm.cmd run db:seed
```

Run the web app and worker in separate PowerShell windows from the project folder:

```powershell
npm.cmd run dev
```

```powershell
npm.cmd run db:outbox-worker
```

Open the localhost URL printed by Next.js, usually `http://localhost:3000`. Check the app layer and MongoDB separately:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
curl.exe -i http://localhost:3000/api/health/mongodb
```

## Setup on Linux and macOS

Start MySQL using your installed service manager. Typical Linux systemd commands are:

```bash
sudo systemctl start mysql
# Optional, only when using a locally installed MongoDB server instead of Atlas:
sudo systemctl start mongod
```

Typical macOS Homebrew commands are:

```bash
brew services start mysql
# Optional, only if MongoDB Community is installed locally:
brew services start mongodb-community
```

Service/formula names vary. Atlas needs no local MongoDB service. From the repository folder, create `.env` only if it does not exist, edit it locally, then install dependencies and check Prisma:

```bash
cd "/path/to/Student Attendance Management System"
test -f .env || cp .env.example .env
${EDITOR:-nano} .env
npm ci
npm run db:validate
npm run db:generate
npx prisma migrate status
```

Set `DATABASE_URL` to the MySQL `student_attendance` database, `MONGODB_URI` to your Atlas or local MongoDB URI, and `AUTH_SECRET` to a private random secret. Set `DEMO_SEED_PASSWORD` only if you need to seed development accounts. Keep credentials in `.env`, not in Git or this README.

If `migrate status` reports pending migrations, apply only the checked-in migrations:

```bash
npx prisma migrate deploy
```

Do not run `prisma migrate reset`. Seed only a new/empty development database. The seed script upserts demo users and updates their password hashes to the current `DEMO_SEED_PASSWORD`; do not run it on every startup:

```bash
npm run db:seed
```

Run the web app and worker in separate terminals from the project folder:

```bash
npm run dev
```

```bash
npm run db:outbox-worker
```

Open the localhost URL printed by Next.js, usually `http://localhost:3000`. Check the app layer and MongoDB separately:

```bash
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/api/health/mongodb
```

## Database, worker, and test commands

The asynchronous outbox worker polls pending MySQL events in bounded batches, sleeps when idle, and retries failures with backoff. Stop it with Ctrl+C. MongoDB is contacted by the worker outside attendance transactions; attendance finalization remains available when MongoDB is unavailable.

`npx prisma migrate deploy` applies pending checked-in migrations without creating a development migration. `db:seed` requires a reachable MySQL database and `DEMO_SEED_PASSWORD`; use it for initial demo-data setup, not each restart. The migration source is `prisma/migrations/20261115120000_init_attendance_management_schema/migration.sql`; the initial migration includes enforced MySQL `CHECK` constraints.

The integration test requires `ATTENDANCE_TEST_DATABASE_URL` to point to a separate migrated and seeded test database whose name ends in `_test`. Do not point it at the normal `student_attendance` database. On Windows PowerShell, run:

See [docs/testing.md](docs/testing.md) for test layers, coverage, isolated database safety, and the manual browser smoke checklist.

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

On Linux/macOS, run:

```bash
npm test
npm run lint
npm run build
```

## Demo seed accounts

The development seed creates these fictional accounts:

| Role | Demo email |
|---|---|
| Admin | `admin@attendance-demo.test` |
| Faculty | `faculty.one@attendance-demo.test`, `faculty.two@attendance-demo.test` |
| Student | `student.1@attendance-demo.test` through `student.5@attendance-demo.test` |

The password is the local-only `DEMO_SEED_PASSWORD` value set when the seed was last run. No demo password is published in this repository. When seeding a development database, all demo accounts receive the configured value, hashed with bcrypt. Rerunning the seed updates those demo password hashes, so do not run it during ordinary restarts.

## Authentication foundation

The sign-in page is `/login`. Auth.js validates credentials against the existing MySQL `User` records and uses the stored bcrypt password hash. An eight-hour JWT session is held in an HTTP-only, same-site cookie managed by Auth.js; Auth.js enables the secure-cookie flag for HTTPS deployments. `AUTH_SECRET` is required in the local `.env`; generate a unique random value for each environment. The `.env` file is ignored by Git.

The database roles are `STUDENT`, `FACULTY`, and `ADMIN`. Successful sign-in routes users to `/student`, `/faculty`, or `/admin`. Student and faculty areas provide the attendance workflow; admins and faculty can open their role-scoped audit views. Server-rendered pages and Server Actions use centralized role guards. Student profile access is derived from the authenticated user; a caller-provided profile ID is not trusted. Faculty offering access checks the `OfferingFaculty` relation in MySQL. Admin-only operations require the `ADMIN` role. Authorization is enforced on the server because browser-side hiding is not a security boundary and can be bypassed by direct requests.

`GET /api/auth/me` returns only the current user's `id`, `email`, and `role`, or `401` without a session. It never returns a password hash. No user-active flag exists in the current schema; account enabled/disabled state is therefore not currently represented.

For local development, configure `DATABASE_URL` and `AUTH_SECRET` in `.env`, then run `npm run dev` and open `/login`. The existing seeded development accounts can sign in with the local `DEMO_SEED_PASSWORD` used when seeding; do not put that value in source control or share it. Focused authorization tests run with `npm test`.

MongoDB uses the optional server-only `MONGODB_URI` variable. The shared connection targets the `student_attendance` database and does not create a collection on connection. `GET /api/health/mongodb` checks connectivity when configured and reports `not_configured` when the URI is absent. MongoDB health is separate from `/api/health`; a MongoDB outage does not block login or MySQL attendance operations.

## Attendance workflow (Stage 5)

Faculty see only offerings assigned through `OfferingFaculty`. For an offering, the active enrollment roster is loaded from MySQL. Faculty select a valid date within the offering term and mark every active enrollee PRESENT, ABSENT, or EXCUSED. One serializable MySQL transaction creates the session as `FINALIZED`, inserts the complete roster of attendance records, and writes exactly one pending `ATTENDANCE_SESSION_FINALIZED` outbox event. Duplicate date/topic sessions and roster mismatches are rejected; any insert failure rolls back all three kinds of rows. Finalized history is read-only in this stage.

Students see only their own ACTIVE or COMPLETED enrollments, finalized session history, and per-course/overall counts. The profile ID is derived from the authenticated server-side user. Attendance is calculated from finalized MySQL records: PRESENT counts attended, ABSENT counts held but not attended, and EXCUSED is excluded from both. With no counted marks the safe percentage is `0%`; values are rounded to two decimal places. No percentage is stored in the database.

Faculty pages use `/faculty`; session history details are at `/faculty/sessions/[sessionId]`. Student attendance is at `/student`. Session creation uses a validated Server Action; reads are server-side Prisma queries. The admin landing area links to the system audit page. The standalone Stage 7C worker delivers outbox events asynchronously to MongoDB.

## Attendance risk and recovery planner (Stage 6)

Risk is derived from finalized MySQL marks at request time; percentages and risk classifications are not persisted. Each course offering uses its configurable `attendanceThreshold` (default 75%), while the overall summary uses `DEFAULT_ATTENDANCE_THRESHOLD_PERCENT` (75%). `EXCUSED` marks do not count as held or attended. Percentages are rounded to two decimals for display; risk checks use exact attendance counts.

Statuses are: `NO_DATA` when no counted finalized marks exist; `SAFE` when the requirement is met; `AT_RISK` when below a recoverable requirement; and `CRITICAL` when below a 100% requirement, which future attendance alone cannot recover. For threshold fraction `p < 1`, attended count `a`, and held count `h`, the minimum future consecutive classes to attend is `ceil((p × h - a) / (1 - p))`. A student already meeting the threshold needs zero classes. The calculation handles zero sessions separately, uses integer arithmetic for the decision and recovery count, rejects invalid input, and does not confuse rounded display values with the underlying ratio.

The Student page shows overall and per-course status and recommendations. The Faculty page shows the same analysis for ACTIVE students in offerings assigned to the authenticated faculty profile. The feature provides a decision from historical data, rather than only create/read/update/delete operations. A database view was not added because per-offering thresholds and authorization-scoped Prisma reads are better kept in the existing service/DAL flow.

`npm test` runs unit tests plus an optional MySQL integration test. To enable the integration test, set `ATTENDANCE_TEST_DATABASE_URL` to a separately migrated and seeded database whose name ends in `_test`. The test transaction deliberately rolls back; it never targets `DATABASE_URL`.

## MongoDB aggregation and audit (Stage 7D)

`/admin/audit` shows global finalized-event counts, event counts grouped by UTC date and offering, and paginated recent history. `/faculty/audit` shows the same information only for course offerings assigned to the authenticated faculty member. Both pages enforce server-side role authorization.

Faculty scope comes from MySQL `OfferingFaculty` assignments before MongoDB is queried. Browser-supplied offering IDs are not accepted as an authorization scope. Students do not have a MongoDB audit page because event documents do not contain student IDs. MongoDB aggregations summarize the event/audit projection only; MySQL remains authoritative for attendance records, assignments, and attendance percentages.

The affected-student event count is the sum of roster sizes recorded on events. It counts student-event occurrences and is not a count of unique students.

## Outbox failure and retry guarantees (Stage 7E)

The outbox unit tests simulate MongoDB and SQL failures without requiring MongoDB. A MongoDB persistence failure leaves `OutboxEvent.deliveredAt` null. SQL acknowledgement occurs only after MongoDB confirms event persistence. If that SQL acknowledgement then fails, the MongoDB document is retained and the SQL row remains pending; retrying the same `eventId` accepts the identical document without inserting a duplicate, then can mark SQL delivered. Conflicting content under an existing event ID is rejected and is not overwritten. Invalid or mismatched payloads are rejected before MongoDB is called. These tests exercise dispatcher retries deterministically rather than waiting for the worker's polling timer.

## Attendance analytics dashboards (Stage 8)

The `/student`, `/faculty`, and `/admin` role pages provide attendance dashboards. Student metrics are derived only from the signed-in student's MySQL enrollments and finalized records. The student overview includes overall and per-course attendance, attended/missed counts, risk/recovery status, no-data courses, and a daily trend.

Faculty analytics are scoped on the server by MySQL `OfferingFaculty` assignments. Offering and term filters are intersected with those assigned offerings; a browser-supplied ID cannot broaden the scope. Date filters apply to the attendance trend. Attendance and risk summaries continue to use all finalized marks so the established attendance policy remains consistent. Admin entity and overall attendance totals use MySQL; course/offering comparisons and risk counts focus on active-term offerings. Recent finalized sessions are included as a compact activity table.

Relational analytics use Prisma counts/grouping and parameterized MySQL aggregates to summarize attendance by offering, student, and date. Percentages remain derived and use the shared attendance calculation; PRESENT and ABSENT count in the denominator while EXCUSED does not. Existing risk and recovery services remain authoritative. Accessible tables accompany the trend visualization. MongoDB continues to serve the distinct Stage 7 audit/event pages and does not supply attendance totals or dashboard percentages.

## Testing and documentation (Stage 9)

The test suite covers attendance calculations and validation, authentication/authorization, dashboards, MongoDB audit aggregation, and outbox retries. The optional MySQL integration test is restricted to a separate `*_test` database. Automated browser end-to-end tests are not configured; use the manual role/workflow smoke checklist in [docs/testing.md](docs/testing.md).

Project documentation includes [docs/architecture.md](docs/architecture.md), [docs/schema.md](docs/schema.md), [docs/er-diagram.md](docs/er-diagram.md), [docs/queries.sql](docs/queries.sql), [docs/testing.md](docs/testing.md), and [REQUIREMENTS.md](REQUIREMENTS.md). Run `npm test`, `npm run lint`, and `npm run build` before a release; see the testing guide for Windows and Linux/macOS commands.

## Project structure

```text
src/app/                  Next.js App Router pages and Route Handlers
src/auth/                 Auth.js configuration, sessions, and server authorization
src/dal/attendance/       Authorized attendance data access and transactions
src/dal/analytics/        MySQL aggregate queries for dashboards
src/dal/audit/            MongoDB audit aggregation and MySQL scope queries
src/features/attendance/ Student/faculty attendance workflows
src/features/analytics/  Role dashboards and shared visualization components
src/features/audit/      Admin/faculty audit UI
src/lib/db/              Prisma and MongoDB connection helpers
src/services/attendance/ Attendance validation, risk, recovery, and event logic
src/services/analytics/  Dashboard aggregation and filtering logic
src/services/audit/      Audit authorization and report composition
src/workers/              Standalone SQL outbox to MongoDB worker
prisma/schema.prisma      MySQL relational schema
prisma/migrations/        Checked-in MySQL migrations
prisma/seed.ts            Development/demo seed
docs/                     Schema, ER diagram, queries, architecture, and testing guides
tests/unit/               Unit tests
tests/integration/        Optional isolated MySQL integrity/transaction tests
```

## Implemented stages

The project includes the MySQL schema and seed foundation, Auth.js authentication and server-side roles, attendance management, risk/recovery analysis, MongoDB event foundation, transactional SQL outbox, standalone idempotent outbox worker, scoped MongoDB audit pages, failure/retry tests, and role-based attendance dashboards. Attendance records, risk calculations, and percentages remain MySQL-backed.
>>>>>>> origin/main
