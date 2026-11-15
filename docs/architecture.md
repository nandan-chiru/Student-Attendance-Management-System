# Planned System Architecture

## Overview

The foundation uses a modular Next.js App Router application. Route Handlers and server-side page logic will call services, which use a data access layer (DAL) to access the appropriate database. Authentication and authorization checks will be added at protected server entry points and in the DAL before data is returned or changed.

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

### MongoDB

MongoDB will later hold flexible attendance activity and audit event documents, such as attendance changes and their actor, timestamp, source, and correction context. Its document model fits event records whose metadata may evolve independently of the relational attendance schema. MongoDB aggregation will support event-based audit and activity reports.

MongoDB is not connected to a collection or event pipeline. Its use is deferred to a later stage. The SQL `OutboxEvent` table is only the future delivery boundary; no MongoDB writes or workers exist yet.

## Consistency boundary

MySQL remains authoritative for current attendance state. When the event pipeline is implemented, attendance changes and an event-outbox record should be committed together in a MySQL transaction. A separate delivery process can copy outbox events to MongoDB and safely retry using a unique event identifier. This avoids treating two independent database writes as one atomic transaction.

## Application layers

- **Next.js UI:** Server-rendered pages and forms for students, faculty, and administrators will be added in later stages.
- **API / server layer:** Route Handlers expose validated HTTP operations. The current `GET /api/health` route only confirms the API layer is running.
- **Service layer:** Future attendance and analytics rules belong here rather than in page components or route handlers.
- **Data access layer:** Future SQL and Mongo queries will be centralized here, with authorization checks close to sensitive data access.
- **Validation:** Request and form validation will be added alongside the first implemented features.

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

## Current implementation boundary

The current implementation includes the Next.js foundation, health endpoint, Prisma MySQL relational schema and seed, and Stage 4 credentials authentication, protected role placeholders, and focused authorization tests. Attendance workflows, dashboards, analytics, and MongoDB event processing remain deferred.
