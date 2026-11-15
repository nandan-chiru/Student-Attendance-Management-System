# Student Attendance Management System

A DBMS Level 3 Student Attendance Management System built on Next.js App Router and TypeScript, with MySQL-backed attendance workflows and MongoDB-backed event audit summaries.

## Technology stack

- Next.js App Router, React, TypeScript, and Tailwind CSS
- MySQL 8 with Prisma ORM
- Prisma's MariaDB driver adapter for Prisma Client
- MongoDB Node.js driver for the optional attendance event/audit foundation
- Git and GitHub

Authentication uses Auth.js Credentials with JWT-backed sessions. Passwords are verified against the existing bcrypt hashes; plaintext passwords are never stored.

## Database architecture

MySQL is the primary and canonical relational source of truth for users and profiles, academic terms, courses and offerings, enrollments, attendance sessions, attendance records, and the SQL outbox. Attendance percentages will be calculated only from attendance records in finalized sessions.

MySQL remains the system of record. MongoDB is the secondary NoSQL store for immutable attendance event/audit history and event-based aggregation/reporting. Attendance sessions, attendance records, and percentages are not duplicated there. Attendance finalization writes an event to the existing SQL `OutboxEvent` table in the same MySQL transaction as its session and records. A standalone worker validates pending outbox events, persists them idempotently to MongoDB, then conditionally marks them delivered in MySQL. Stage 7D uses MongoDB aggregation for scoped audit summaries and history.

## Local prerequisites

- Node.js and npm
- MySQL 8.0.16 or newer (the migration includes enforced `CHECK` constraints)
- Git

MongoDB is optional for normal attendance workflows. Configure `MONGODB_URI` to run the outbox worker, MongoDB health check, or audit pages. Attendance state and percentages are stored/calculated from MySQL only. The worker requires both database configurations and runs separately from Next.js.

## Environment configuration

Copy `.env.example` to `.env` and set local values. The file is ignored by Git.

```dotenv
DATABASE_URL="mysql://<user>:<password>@localhost:3306/student_attendance"
MONGODB_URI=
AUTH_SECRET=<generate-a-random-secret>
DEMO_SEED_PASSWORD=
ATTENDANCE_TEST_DATABASE_URL=
```

URL-encode reserved characters in the database username/password. `DEMO_SEED_PASSWORD` is only needed when running the development seed. Choose a throwaway local password; the script hashes it with bcrypt before storing it. All demo users receive that same hash. Never commit `.env` or share the seed password. No credentials are stored in source control.

## Database commands

```bash
npm install
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
```

Run the asynchronous outbox publisher in a separate terminal with `npm run db:outbox-worker`. It polls pending MySQL outbox rows in bounded batches, sleeps when idle, and retries failures with backoff. Stop it with Ctrl+C. MongoDB is contacted only by this worker, outside attendance transactions.

`db:migrate` applies the checked-in initial migration and prompts for a migration name only when new schema changes need one. `db:seed` runs explicitly and requires a reachable MySQL database plus `DEMO_SEED_PASSWORD` in `.env`.

The migration source is `prisma/migrations/20261115120000_init_attendance_management_schema/migration.sql`. It was generated from the Prisma schema and includes four additional MySQL `CHECK` constraints. Stage 2 applied the initial migration to the configured local database. Stage 5 does not change the Prisma schema or create a migration.

## Demo seed accounts

The seed creates `admin@attendance-demo.test`, `faculty.one@attendance-demo.test`, `faculty.two@attendance-demo.test`, and `student.1@attendance-demo.test` through `student.5@attendance-demo.test`. They all use the local-only `DEMO_SEED_PASSWORD` value. The examples are fictional development data, not production accounts.

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

## Project structure

```text
src/app/                 Next.js pages and Route Handlers
src/lib/db/              Prisma and MongoDB connection helpers
src/auth/                 Credentials auth, session and authorization helpers
src/dal/attendance/       Authorized attendance queries and transactional writes
src/services/attendance/  Session rules, validation, and attendance calculations
src/dal/audit/            MongoDB audit aggregation and MySQL scope queries
src/services/audit/       Audit authorization, aggregation pipeline builders, and report composition
src/features/audit/       Server-rendered audit tables and summaries
src/validation/           Shared validation utilities (attendance schemas live by their service)
src/features/attendance/ Faculty/student server workspaces and attendance form
prisma/schema.prisma      MySQL relational model
prisma/migrations/        Initial MySQL migration
prisma/seed.ts            Idempotent development/demo seed
docs/schema.md            Tables, keys, constraints, indexes, and rules
docs/er-diagram.md        Mermaid ER diagram source
docs/queries.sql          Representative DBMS SQL examples
tests/unit/               Authentication, authorization, attendance, event, and audit tests
tests/integration/        Optional isolated MySQL integrity/transaction tests
```

## Current stage boundary

Stage 7B adds the transactional SQL outbox record to attendance finalization. Stage 7C adds a standalone delivery worker that writes immutable event documents to MongoDB and retries safely using the unique event ID. Stage 7D adds MongoDB aggregation and server-side admin/faculty audit pages. Attendance records, risk calculations, and percentages remain MySQL-backed.
