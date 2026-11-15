# Student Attendance Management System

A DBMS Level 3 Student Attendance Management System built on Next.js App Router and TypeScript. Stage 6 adds server-calculated attendance risk and recovery guidance to the faculty and student attendance workflows.

## Technology stack

- Next.js App Router, React, TypeScript, and Tailwind CSS
- MySQL 8 with Prisma ORM
- Prisma's MariaDB driver adapter for Prisma Client
- MongoDB Node.js driver reserved for a later attendance event/audit stage
- Git and GitHub

Authentication uses Auth.js Credentials with JWT-backed sessions. Passwords are verified against the existing bcrypt hashes; plaintext passwords are never stored.

## Database architecture

MySQL is the primary and canonical relational source of truth for users and profiles, academic terms, courses and offerings, enrollments, attendance sessions, attendance records, and the SQL outbox. Attendance percentages will be calculated only from attendance records in finalized sessions.

MongoDB integration is intentionally deferred. Later, it may store flexible attendance activity/audit event documents and support event-based aggregation/reporting. It will not be a source of attendance totals. The current `OutboxEvent` model is only the SQL side of a future delivery workflow; no event processor or MongoDB collection is implemented.

## Local prerequisites

- Node.js and npm
- MySQL 8.0.16 or newer (the migration includes enforced `CHECK` constraints)
- Git

MongoDB is not required for this stage. Attendance state and percentages are stored/calculated from MySQL only.

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

`db:migrate` applies the checked-in initial migration and prompts for a migration name only when new schema changes need one. `db:seed` runs explicitly and requires a reachable MySQL database plus `DEMO_SEED_PASSWORD` in `.env`.

The migration source is `prisma/migrations/20261115120000_init_attendance_management_schema/migration.sql`. It was generated from the Prisma schema and includes four additional MySQL `CHECK` constraints. Stage 2 applied the initial migration to the configured local database. Stage 5 does not change the Prisma schema or create a migration.

## Demo seed accounts

The seed creates `admin@attendance-demo.test`, `faculty.one@attendance-demo.test`, `faculty.two@attendance-demo.test`, and `student.1@attendance-demo.test` through `student.5@attendance-demo.test`. They all use the local-only `DEMO_SEED_PASSWORD` value. The examples are fictional development data, not production accounts.

## Authentication foundation

The sign-in page is `/login`. Auth.js validates credentials against the existing MySQL `User` records and uses the stored bcrypt password hash. An eight-hour JWT session is held in an HTTP-only, same-site cookie managed by Auth.js; Auth.js enables the secure-cookie flag for HTTPS deployments. `AUTH_SECRET` is required in the local `.env`; generate a unique random value for each environment. The `.env` file is ignored by Git.

The database roles are `STUDENT`, `FACULTY`, and `ADMIN`. Successful sign-in routes users to `/student`, `/faculty`, or `/admin`. Student and faculty areas now provide the Stage 5 attendance workflow; the admin area remains a protected placeholder. Server-rendered pages and Server Actions use centralized role guards. Student profile access is derived from the authenticated user; a caller-provided profile ID is not trusted. Faculty offering access checks the `OfferingFaculty` relation in MySQL. Admin-only operations require the `ADMIN` role. Authorization is enforced on the server because browser-side hiding is not a security boundary and can be bypassed by direct requests.

`GET /api/auth/me` returns only the current user's `id`, `email`, and `role`, or `401` without a session. It never returns a password hash. No user-active flag exists in the current schema; account enabled/disabled state is therefore not currently represented.

For local development, configure `DATABASE_URL` and `AUTH_SECRET` in `.env`, then run `npm run dev` and open `/login`. The existing seeded development accounts can sign in with the local `DEMO_SEED_PASSWORD` used when seeding; do not put that value in source control or share it. Focused authorization tests run with `npm test`.

## Attendance workflow (Stage 5)

Faculty see only offerings assigned through `OfferingFaculty`. For an offering, the active enrollment roster is loaded from MySQL. Faculty select a valid date within the offering term and mark every active enrollee PRESENT, ABSENT, or EXCUSED. One serializable MySQL transaction creates the session as `FINALIZED` and inserts the complete roster of attendance records. Duplicate date/topic sessions and roster mismatches are rejected. Finalized history is read-only in this stage.

Students see only their own ACTIVE or COMPLETED enrollments, finalized session history, and per-course/overall counts. The profile ID is derived from the authenticated server-side user. Attendance is calculated from finalized MySQL records: PRESENT counts attended, ABSENT counts held but not attended, and EXCUSED is excluded from both. With no counted marks the safe percentage is `0%`; values are rounded to two decimal places. No percentage is stored in the database.

Faculty pages use `/faculty`; session history details are at `/faculty/sessions/[sessionId]`. Student attendance is at `/student`. Session creation uses a validated Server Action; reads are server-side Prisma queries. The admin page remains a protected placeholder. No MongoDB event workflow is implemented.

## Attendance risk and recovery planner (Stage 6)

Risk is derived from finalized MySQL marks at request time; percentages and risk classifications are not persisted. Each course offering uses its configurable `attendanceThreshold` (default 75%), while the overall summary uses `DEFAULT_ATTENDANCE_THRESHOLD_PERCENT` (75%). `EXCUSED` marks do not count as held or attended. Percentages are rounded to two decimals for display; risk checks use exact attendance counts.

Statuses are: `NO_DATA` when no counted finalized marks exist; `SAFE` when the requirement is met; `AT_RISK` when below a recoverable requirement; and `CRITICAL` when below a 100% requirement, which future attendance alone cannot recover. For threshold fraction `p < 1`, attended count `a`, and held count `h`, the minimum future consecutive classes to attend is `ceil((p × h - a) / (1 - p))`. A student already meeting the threshold needs zero classes. The calculation handles zero sessions separately, uses integer arithmetic for the decision and recovery count, rejects invalid input, and does not confuse rounded display values with the underlying ratio.

The Student page shows overall and per-course status and recommendations. The Faculty page shows the same analysis for ACTIVE students in offerings assigned to the authenticated faculty profile. The feature provides a decision from historical data, rather than only create/read/update/delete operations. A database view was not added because per-offering thresholds and authorization-scoped Prisma reads are better kept in the existing service/DAL flow.

`npm test` runs unit tests plus an optional MySQL integration test. To enable the integration test, set `ATTENDANCE_TEST_DATABASE_URL` to a separately migrated and seeded database whose name ends in `_test`. The test transaction deliberately rolls back; it never targets `DATABASE_URL`.

## Project structure

```text
src/app/                 Next.js pages and Route Handlers
src/lib/db/              Prisma and MongoDB connection helpers
src/auth/                 Credentials auth, session and authorization helpers
src/dal/attendance/       Authorized attendance queries and transactional writes
src/services/attendance/  Session rules, validation, and attendance calculations
src/validation/           Shared validation utilities (attendance schemas live by their service)
src/features/attendance/ Faculty/student server workspaces and attendance form
prisma/schema.prisma      MySQL relational model
prisma/migrations/        Initial MySQL migration
prisma/seed.ts            Idempotent development/demo seed
docs/schema.md            Tables, keys, constraints, indexes, and rules
docs/er-diagram.md        Mermaid ER diagram source
docs/queries.sql          Representative DBMS SQL examples
tests/unit/               Authentication, authorization, validation, and calculation tests
tests/integration/        Optional isolated MySQL integrity/transaction tests
```

## Current stage boundary

Stage 6 implements attendance entry, finalized session history, student attendance summaries, server-side role-scoped attendance risk analysis, and recovery guidance. Broader analytics dashboards, MongoDB event processing, the outbox worker, and admin attendance tools remain out of scope.
