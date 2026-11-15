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

Attendance percentages and shortage analysis will be calculated from canonical MySQL attendance records. MongoDB will not store a competing attendance total.

### MongoDB (Stage 7A foundation)

MongoDB is the secondary NoSQL database intended for immutable attendance event/audit history and later event-based aggregation. MySQL remains the system of record for every user, course, enrollment, attendance session, attendance record, and attendance calculation. MongoDB will not duplicate relational attendance rows or hold attendance totals.

The official MongoDB Node.js driver is reused through `src/lib/db/mongodb.ts`, with a shared client promise cached on `globalThis` for Next.js development reloads. The database name is `student_attendance`; the connection is optional and reads `MONGODB_URI` only on the server. Missing configuration and connection failures are handled without logging connection details. `GET /api/health/mongodb` reports `not_configured`, `ok`, or `unavailable`; the existing `/api/health` and MySQL attendance flows do not depend on MongoDB.

The future `attendance_events` collection is append-only and will enforce a unique index on `eventId` for idempotent identity. The Stage 7A contract defines `ATTENDANCE_SESSION_FINALIZED` with stable MySQL `sessionId`, `offeringId`, and `facultyId`, an event time, affected student count, and small schema-version/session-date metadata. It intentionally excludes names, emails, attendance rows, credentials, and other unnecessary personal data. No collection or index is created in this stage, and no events are written.

The existing SQL `OutboxEvent` model is not used by Stage 7A. Future Stage 7B will implement the SQL outbox pattern: record an event in the same MySQL transaction as the canonical attendance change, then publish it to MongoDB with idempotent delivery. MongoDB failure must not roll back or block ordinary MySQL attendance operations.

## Consistency boundary

MySQL remains authoritative for current attendance state. In Stage 7B, attendance changes and an event-outbox record will be committed together in a MySQL transaction. A separate delivery process can copy outbox events to MongoDB and safely retry using a unique event identifier. This avoids treating two independent database writes as one atomic transaction.

## Application layers

- **Next.js UI:** Server-rendered student attendance summaries and faculty roster/session pages; a small Client Component handles form pending/result state.
- **API / server layer:** Route Handlers provide health and auth endpoints. Faculty session creation is a validated Server Action; reads are server-rendered.
- **Service layer:** `src/services/attendance/` validates date and roster rules, calculates percentages, and coordinates session creation.
- **Data access layer:** `src/dal/attendance/` contains scoped Prisma queries and transaction primitives. Faculty queries receive the authenticated faculty profile ID; student queries receive the profile derived from the session.
- **Validation:** Zod validates session IDs, calendar dates, statuses, and the submitted roster on the server. Client constraints are only usability aids.

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

Stage 5 faculty attendance creation performs a serializable MySQL transaction: recheck the offering assignment and term, load the active roster, reject incomplete or duplicate marks, create a FINALIZED session, and insert all records. Any failure rolls back both the session and its records. Finalized sessions are read-only in the UI and there is no update action. Student views derive only that student's marks from FINALIZED sessions; percentages are calculated at request time and are never stored.

The admin page remains a protected placeholder. A broader analytics dashboard, MongoDB event processing, and the outbox worker remain deferred. Integration tests only connect when `ATTENDANCE_TEST_DATABASE_URL` targets a separate database whose name ends in `_test`; they never use the application's `DATABASE_URL`.
