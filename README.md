# Student Attendance Management System

A DBMS Level 3 project built on Next.js App Router and TypeScript. **Stage 2** establishes the MySQL relational schema, Prisma migration, development seed, and database documentation. Application features are not implemented yet.

## Technology stack

- Next.js App Router, React, TypeScript, and Tailwind CSS
- MySQL 8 with Prisma ORM
- Prisma's MariaDB driver adapter for Prisma Client
- MongoDB Node.js driver reserved for a later attendance event/audit stage
- Git and GitHub

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
AUTH_SECRET=
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

## Project structure

```text
src/app/                 Next.js pages and Route Handlers
src/lib/db/              Prisma and MongoDB connection helpers
src/auth/                 Reserved for later authentication
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
tests/                    Reserved for unit, integration, and E2E tests
```

## Current stage boundary

Stage 2 implements the relational database foundation only. Authentication, dashboards, attendance APIs/UI, analytics UI, the recovery planner, MongoDB event processing, and background workers are not implemented.
