# Planned System Architecture

## Overview

The application uses modular Next.js App Router pages and Route Handlers. Server-rendered pages and Server Actions call services, which use a data access layer (DAL) to query MySQL. Authentication and authorization checks protect server entry points and sensitive data access.

```text
User
  ↓
Next.js UI
  ↓
API / Server Layer
  ↓
Service Layer
  ↓
Data Access Layer
  ↓
MySQL + MongoDB
```

## Database responsibilities

### MySQL

MySQL is the canonical relational database for users and profiles, academic terms, courses, course offerings, enrollments, attendance sessions, attendance records, and the SQL outbox. Relationships and integrity are represented by primary keys, foreign keys, unique constraints, enums, indexes, and MySQL checks in the initial migration.

Attendance percentages and shortage analysis are calculated from canonical MySQL attendance records. MongoDB does not store a competing attendance total.

### MongoDB (Stage 7A foundation)

MongoDB is the secondary NoSQL database intended for immutable attendance event/audit history and later event-based aggregation. MySQL remains the system of record for every user, course, enrollment, attendance session, attendance record, and attendance calculation. MongoDB will not duplicate relational attendance rows or hold attendance totals.

The official MongoDB Node.js driver is reused through `src/lib/db/mongodb.ts`, with a shared client promise cached on `globalThis` for Next.js development reloads. The database name is `student_attendance`; the connection is optional and reads `MONGODB_URI` only on the server. Missing configuration and connection failures are handled without logging connection details. `GET /api/health/mongodb` reports `not_configured`, `ok`, or `unavailable`; the existing `/api/health` and MySQL attendance flows do not depend on MongoDB.

The `attendance_events` collection is an append-only event projection with a unique index on `eventId`. The `ATTENDANCE_SESSION_FINALIZED` contract contains stable MySQL `sessionId`, `offeringId`, and `facultyId`, an event time, affected student count, and small schema-version/session-date metadata. It excludes names, emails, attendance rows, credentials, and other unnecessary personal data.

Stage 7B reuses the existing SQL `OutboxEvent` model. Its event row is written atomically with attendance finalization. Stage 7C delivers pending events to MongoDB through the standalone worker.

## Consistency boundary

MySQL remains authoritative for current attendance state. Attendance session finalization, its records, and its `OutboxEvent` are committed in one MySQL transaction. MongoDB is never written inside the transaction. A MongoDB outage therefore cannot roll back or block a successful MySQL attendance transaction; the outbox row remains pending (`deliveredAt = NULL`) for retry by the standalone Stage 7C worker.

## Transactional SQL outbox (Stage 7B)

```text
Faculty
  ↓
Attendance finalization request
  ↓
Single MySQL transaction
  ├── AttendanceSession
  ├── AttendanceRecords
  └── OutboxEvent (pending)
        ↓
      COMMIT
        ↓
Standalone Stage 7C worker
        ↓
MongoDB `attendance_events`
```

The server creates one `ATTENDANCE_SESSION_FINALIZED` event after inserting the finalized session and its complete attendance roster. The shared TypeScript event contract supplies the minimal payload; the same event ID is stored in the unique `OutboxEvent.eventId` column and payload. Relational columns record the actor, offering, session, event type, occurrence time, and delivery timestamp. The payload contains stable session/offering/faculty IDs, event time, affected student count, and minimal schema/date metadata. It excludes names, emails, attendance records, credentials, and tokens.

Any session, record, or outbox insert error rejects the transaction and rolls back all of its writes. The Server Action returns its existing generic save failure for unexpected persistence errors; database details are not sent to the browser. The attendance transaction imports no MongoDB client and performs no network call. A separate `npm run db:outbox-worker` process selects pending finalization events in creation order with a bounded batch, validates each payload against the shared event contract and SQL identity, and upserts it by `eventId` using `$setOnInsert`. The worker confirms stored content before acknowledging; conflicting content is never overwritten. A unique MongoDB `eventId` index makes concurrent duplicate delivery safe. Only after MongoDB confirms an identical event does the worker conditionally set `deliveredAt` where it remains null. MongoDB or SQL errors leave the row retryable; a Mongo document may remain after SQL acknowledgement failure and is recognized on retry.

The worker polls outside the Next.js request lifecycle, sleeps when idle, backs off after errors, and closes database resources on SIGINT/SIGTERM. It logs event IDs and failure stage without logging payloads or credentials. MongoDB delivery is asynchronous and does not change the canonical MySQL attendance state.

## MongoDB aggregation and audit (Stage 7D)

The `attendance_events` collection is queried with MongoDB aggregation pipelines; the application does not load the entire collection to compute summaries in TypeScript. Aggregations return finalized event totals, the sum of event-level affected-student counts, event counts grouped by UTC date, and event counts grouped by offering. Recent event history is sorted and paginated in MongoDB. The collection retains its unique `eventId` index; descending `occurredAt` and `(offeringId, occurredAt)` indexes support global date/history and faculty offering-scope query patterns.

`/admin/audit` requires `ADMIN` and can query the global event collection. `/faculty/audit` requires `FACULTY`; the service resolves assigned offering IDs from MySQL `OfferingFaculty` before adding those IDs to the MongoDB `$match`. No client-supplied faculty or offering ID can broaden the query. Student audit UI is out of scope because MongoDB events do not contain student IDs. Adding student access later would require deriving eligible session IDs from the authenticated student's MySQL records first.

The dashboard labels the sum of `affectedStudentCount` as an affected-student event count. It is a sum of roster sizes across events, not a unique-student count or an attendance percentage. MySQL remains authoritative for identity, assignments, courses, attendance records, and percentages; MongoDB is used only for event history and event aggregation.

## Outbox failure and retry verification (Stage 7E)

The Stage 7E tests use in-memory MongoDB and SQL fakes; they do not require a live MongoDB service or worker timing. If MongoDB persistence fails, the dispatcher records a Mongo-stage failure and does not acknowledge the SQL row, so `deliveredAt` remains null. If MongoDB persistence succeeds but the SQL acknowledgement fails, the MongoDB event remains in place and the SQL event remains pending. A retry with the same `eventId` verifies the identical stored content, performs no second insert, and can then acknowledge SQL. Conflicting content for an existing event ID is rejected without replacing the stored document. Invalid payloads and SQL/payload identity mismatches stop before MongoDB persistence.

The delivery ordering is therefore: validate SQL payload → persist or confirm the identical MongoDB event → conditionally set MySQL `deliveredAt`. The tests call the dispatcher again to model retry deterministically; the standalone worker continues to provide polling, exponential backoff, and graceful shutdown.

## Application layers

- **Next.js UI:** Server-rendered student attendance summaries and faculty roster/session pages; a small Client Component handles form pending/result state.
- **API / server layer:** Route Handlers provide health and auth endpoints. Faculty session creation is a validated Server Action; reads are server-rendered.
- **Service layer:** `src/services/attendance/` validates date and roster rules, calculates percentages, and coordinates session creation.
- **Data access layer:** `src/dal/attendance/` contains scoped Prisma queries and transaction primitives. Faculty queries receive the authenticated faculty profile ID; student queries receive the profile derived from the session.
- **Validation:** Zod validates session IDs, calendar dates, statuses, and the submitted roster on the server. Client constraints are only usability aids.

## Role dashboards and attendance analytics (Stage 8)

`/student` uses the server-side student attendance service, which derives the student profile from the authenticated session and queries only that profile's enrollments and finalized attendance history. It presents overall/course counts, derived percentages, the existing risk/recovery classification, no-data courses, and a daily attendance trend. No student identifier is accepted from dashboard filters.

`/faculty` analytics resolve assignments through MySQL `OfferingFaculty` using the authenticated faculty profile. Optional offering and term filters are intersected with this assignment result before aggregate queries run. Date range filters affect the trend only; attendance rates and risk counts continue to use all finalized marks and the established risk service. The existing faculty attendance workspace and its per-offering authorization remain in place.

`/admin` shows institution-wide entity counts and the overall rate across all finalized MySQL marks, plus active-term offering comparisons and risk counts. Recent finalized sessions are read from MySQL. Per-offering student attendance and date trends are computed with parameterized SQL aggregates; entity/session totals use Prisma count/groupBy operations. Trend queries return a bounded, chronologically ordered set of the latest twelve dates. Percentage calculation remains derived: PRESENT / (PRESENT + ABSENT), with EXCUSED excluded; zero counted marks yield 0% and `NO_DATA` according to the existing risk rules.

The dashboards are server-rendered, and their service methods enforce role checks before returning scoped data. Tables provide text equivalents for visual comparisons/trends. MongoDB remains limited to the separate Stage 7 audit/event history; it is not used for attendance percentages, risk classification, or relational dashboard totals.

## Security and configuration

Database URLs and the authentication secret are read from environment variables. The repository includes `.env.example` with variable names/placeholders only; actual credentials must remain in local or deployment secret configuration and must not be committed.

## Authentication and authorization (Stage 4)

- Auth.js Credentials verifies email/password against the existing MySQL `User` record and bcrypt hash. Password hashes are selected only during credential verification and are not put in the session or returned by APIs.
- Sessions use Auth.js JWT strategy with an eight-hour lifetime and Auth.js-managed HTTP-only, same-site cookies; Auth.js enables the secure-cookie flag for HTTPS deployments. `AUTH_SECRET` is required and remains server-only.
- The authenticated identity is re-resolved from MySQL on protected server requests. This supplies the current role and profile identifiers and avoids relying on a role supplied by the browser.
- Roles are `STUDENT`, `FACULTY`, and `ADMIN`. Role pages are `/student`, `/faculty`, and `/admin`; each page calls a server-side role guard. Unauthenticated requests redirect to `/login`; authenticated wrong-role requests go to `/forbidden`.
- Centralized server helpers expose authenticated-user, role, student, faculty, assigned-offering, and admin checks. Student access uses the profile ID linked to the session user's MySQL record. A requested student profile ID must match that derived profile. Faculty access to an offering is checked against the `OfferingFaculty` relation in MySQL. Admin operations require `ADMIN`.
- `GET /api/auth/me` returns only `id`, `email`, and `role`, or `401`. Future Route Handlers and services must enforce the same server-side checks; hiding UI elements alone is not authorization.
- The current schema has no enabled/disabled user attribute, so an account-status gate is not represented.

## Attendance risk and recovery planning (Stage 6)

Risk analysis is derived at request time in the server-side attendance service from the same finalized MySQL records used by Stage 5. No attendance percentage or risk state is persisted, and no MongoDB collection or pipeline is involved. Student data is still queried from the authenticated student's own profile; faculty risk rosters are queried only through `OfferingFaculty` assignments and ACTIVE enrollments.

Each offering uses its `attendanceThreshold` (MySQL `DECIMAL(5,2)`, default 75%). Overall attendance uses the centralized `DEFAULT_ATTENDANCE_THRESHOLD_PERCENT` value of 75%. `EXCUSED` marks remain excluded from the attended and held counts.

Classification is deterministic: `NO_DATA` when there are no counted finalized marks; `SAFE` when the exact count ratio meets or exceeds the required threshold; `AT_RISK` when below threshold and a threshold below 100% makes recovery possible; and `CRITICAL` when below a 100% threshold, which cannot be reached by future attendance alone. Display percentages are rounded to two decimals, but classification and recovery use unrounded counts. For a below-threshold student and threshold fraction `p < 1`, the minimum additional consecutive attended classes is `ceil((p * held - attended) / (1 - p))`. At 100%, recovery is marked impossible unless the student already meets the requirement. Invalid counts and thresholds are rejected.

This decision-support feature goes beyond CRUD by analyzing historical marks to classify risk and calculate the minimum future attendance needed to meet a policy threshold. A SQL view is not used: the existing Prisma queries already enforce role scope and provide finalized marks, while the calculation is small, reusable, and must handle per-offering thresholds.

## Current implementation boundary

Faculty attendance finalization performs a serializable MySQL transaction: recheck the offering assignment and term, load the active roster, reject incomplete or duplicate marks, create a FINALIZED session, insert all records, then insert exactly one pending `OutboxEvent`. Any failure rolls back the session, records, and event together. Finalized sessions are read-only in the UI and there is no update action. Student views derive only that student's marks from FINALIZED sessions; percentages are calculated at request time and are never stored.

Role-based student, faculty, and admin attendance dashboards are implemented in Stage 8 and documented in this architecture. Integration tests only connect when `ATTENDANCE_TEST_DATABASE_URL` targets a separate database whose name ends in `_test`; they never use the application's `DATABASE_URL`. See `docs/testing.md` for the current test coverage and manual verification checklist.
