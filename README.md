# Student Attendance Management System

A DBMS Level 3 Student Attendance Management System built on Next.js App Router and TypeScript. Stage 4 establishes credentials-based authentication and server-side role protection on top of the existing MySQL/Prisma foundation. Attendance workflows, analytics, and dashboards are not implemented yet.

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

MongoDB is not required for the current stage. The existing landing page and health endpoint do not require a database connection.

## Environment configuration

Copy `.env.example` to `.env` and set local values. The file is ignored by Git.

```dotenv
DATABASE_URL="mysql://<user>:<password>@localhost:3306/student_attendance"
MONGODB_URI=
AUTH_SECRET=<generate-a-random-secret>
DEMO_SEED_PASSWORD=
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

The migration source is `prisma/migrations/20261115120000_init_attendance_management_schema/migration.sql`. It was generated offline from the Prisma schema and includes four additional MySQL `CHECK` constraints. It has not been applied in this environment because no `.env` or database URL is configured. Applying it requires a configured `DATABASE_URL` and a reachable MySQL server.

## Demo seed accounts

The seed creates `admin@attendance-demo.test`, `faculty.one@attendance-demo.test`, `faculty.two@attendance-demo.test`, and `student.1@attendance-demo.test` through `student.5@attendance-demo.test`. They all use the local-only `DEMO_SEED_PASSWORD` value. The examples are fictional development data, not production accounts.

## Authentication foundation

The sign-in page is `/login`. Auth.js validates credentials against the existing MySQL `User` records and uses the stored bcrypt password hash. An eight-hour JWT session is held in an HTTP-only, same-site cookie managed by Auth.js; Auth.js enables the secure-cookie flag for HTTPS deployments. `AUTH_SECRET` is required in the local `.env`; generate a unique random value for each environment. The `.env` file is ignored by Git.

The database roles are `STUDENT`, `FACULTY`, and `ADMIN`. Successful sign-in routes users to `/student`, `/faculty`, or `/admin`. These are protected placeholder areas. Server-rendered pages use centralized role guards, and Route Handlers can use the same helpers. Student profile access is derived from the authenticated user; a caller-supplied profile ID must match. Faculty offering access checks the `OfferingFaculty` relation in MySQL. Admin-only operations require the `ADMIN` role. Authorization is enforced on the server because browser-side hiding is not a security boundary and can be bypassed by direct requests.

`GET /api/auth/me` returns only the current user's `id`, `email`, and `role`, or `401` without a session. It never returns a password hash. No user-active flag exists in the current schema; account enabled/disabled state is therefore not currently represented.

For local development, configure `DATABASE_URL` and `AUTH_SECRET` in `.env`, then run `npm run dev` and open `/login`. The existing seeded development accounts can sign in with the local `DEMO_SEED_PASSWORD` used when seeding; do not put that value in source control or share it. Focused authorization tests run with `npm test`.

## Project structure

```text
src/app/                 Next.js pages and Route Handlers
src/lib/db/              Prisma and MongoDB connection helpers
src/auth/                 Credentials auth, session and authorization helpers
src/dal/                  Reserved for data access modules
src/services/             Reserved for business services
src/validation/           Reserved for request validation
src/features/             Reserved for attendance and analytics logic
prisma/schema.prisma      MySQL relational model
prisma/migrations/        Initial MySQL migration
prisma/seed.ts            Idempotent development/demo seed
docs/schema.md            Tables, keys, constraints, indexes, and rules
docs/er-diagram.md        Mermaid ER diagram source
docs/queries.sql          Representative DBMS SQL examples
tests/unit/               Authentication and authorization policy tests
```

## Current stage boundary

Stage 4 implements authentication and the server-side authorization foundation on top of the Stage 2 relational database. Attendance entry, attendance dashboards, analytics UI, the recovery planner, MongoDB event processing, and background workers are not implemented.
