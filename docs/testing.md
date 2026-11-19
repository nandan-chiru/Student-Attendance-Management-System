# Testing Guide

This project uses Node.js's built-in test runner through `tsx`. The `npm test` script runs unit tests and the optional MySQL integration test. Automated browser end-to-end tests are not currently configured; use the manual smoke checklist below for UI flows.

## Test layers

### Unit tests

Unit tests are under `tests/unit/` and do not require a live MongoDB service. MongoDB and SQL outbox behavior is tested with fakes so retry and failure cases remain deterministic.

The current unit suite covers:

- Attendance input validation, roster validation, attendance percentages, excluded `EXCUSED` marks, and risk/recovery boundaries.
- Authentication policies, role checks, student profile isolation, faculty assignment policy, and safe auth response fields.
- Dashboard aggregation, no-data behavior, trend calculations, role-scoped faculty filters, and use of shared risk/recovery rules.
- MongoDB audit aggregation and authorization scope.
- Outbox payload validation, successful delivery, idempotent retry, conflicting events, MongoDB failure, and SQL acknowledgement failure.
- Optional MongoDB configuration behavior.

### MySQL integration test

`tests/integration/attendance.test.ts` uses `ATTENDANCE_TEST_DATABASE_URL`, not `DATABASE_URL`. The test refuses any target database whose name does not end in `_test`. When the variable is absent, the integration test is skipped and unit tests still run.

The isolated database must already be migrated and seeded. Integration cases verify seeded relationships, unique attendance records, faculty assignment scope, student scoping, transactional rollback, transactional outbox creation, and duplicate-session detection. Intentional failure cases roll back; successful temporary rows and sentinel records are removed in cleanup handlers so the seeded fixture remains available.

Do not point `ATTENDANCE_TEST_DATABASE_URL` at `student_attendance` or another database containing application data. Do not use `prisma migrate reset` to prepare tests.

### Manual browser smoke test

There is no automated Playwright/Cypress suite yet. For a release check, start MySQL, the Next.js application, and (for MongoDB audit verification) the outbox worker, then verify:

1. Sign in as each role and confirm redirects to `/student`, `/faculty`, and `/admin`.
2. Confirm logged-out users cannot access protected role pages and `/api/auth/me` returns only the safe identity fields when authenticated.
3. As a student, inspect the student's own overall/course summaries and attendance history. Confirm the UI takes no student ID from the browser for its scope.
4. As faculty, verify assigned offerings appear, an unassigned offering is not accessible, and finalizing a session records the enrolled roster.
5. Confirm a student sees the finalized attendance and derived risk/recovery analysis.
6. As admin, verify institution-level analytics and the audit page. As faculty, verify the audit is limited to assigned offerings. Confirm student access to audit pages is forbidden.
7. With the worker running, finalize a new session and verify a corresponding event appears in MongoDB `student_attendance.attendance_events` and its SQL `OutboxEvent.deliveredAt` is set.
8. Check `GET /api/health` and `GET /api/health/mongodb` separately; the first checks the Next.js API layer and the second checks MongoDB connectivity.

Use only the local development seed accounts. The password is the value of `DEMO_SEED_PASSWORD` used during the last seed; it is intentionally not documented as a real or shared secret.

## Commands

Run from the repository root after installing dependencies and configuring `.env`.

Windows PowerShell:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Linux/macOS:

```bash
npm test
npm run lint
npm run build
```

To run only unit tests, Windows PowerShell:

```powershell
npx.cmd tsx --test tests/unit/*.test.ts
```

Linux/macOS:

```bash
npx tsx --test tests/unit/*.test.ts
```

Prisma schema validation and client generation are separate checks. Windows PowerShell:

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
```

Linux/macOS:

```bash
npm run db:validate
npm run db:generate
```

These commands do not apply migrations. For an already-created database, check migration status and apply pending checked-in migrations with `npx prisma migrate deploy`; never reset the database as part of routine verification.
