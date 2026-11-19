# Project Requirements

This document lists the software prerequisites, configuration, and functional scope for the Student Attendance Management System. Platform-specific setup commands are in [README.md](README.md).

## Development environment

- Windows 10/11, a supported Linux distribution, or macOS.
- Node.js 20.9 or newer and npm. The exact application dependencies are managed by `package.json` and `package-lock.json`; do not install them with pip.
- MySQL 8.0.16 or newer. MySQL is required for all relational application data and attendance operations.
- Git for source control.
- A modern web browser.
- MongoDB Atlas or a reachable MongoDB server for event delivery and audit pages. MongoDB Compass is optional and is only a database GUI.

## Install application dependencies

This repository is a Node.js/TypeScript application and has no Python runtime dependencies. Its installable JavaScript dependencies are declared in `package.json` and pinned by `package-lock.json`.

- Windows PowerShell: `npm.cmd ci`
- Linux/macOS: `npm ci`

`pip install -r requirements.txt` does not install Next.js, MySQL Server, or MongoDB. Use the npm commands above for application packages and the README's platform setup instructions for database services.

## Environment configuration

Create a local `.env` from `.env.example` and configure these variables:

| Variable | Purpose | Required for |
|---|---|---|
| `DATABASE_URL` | MySQL connection URL for the `student_attendance` database | Application, Prisma, worker |
| `MONGODB_URI` | MongoDB connection URI; the application selects the `student_attendance` database | Outbox worker, MongoDB health check, audit pages |
| `AUTH_SECRET` | Auth.js session/signing secret | Authentication |
| `DEMO_SEED_PASSWORD` | Local-only password whose bcrypt hash is written for demo accounts by the seed script | Initial development seed only |
| `ATTENDANCE_TEST_DATABASE_URL` | Separate test database URL with a database name ending in `_test` | MySQL integration tests only |

Never commit `.env`, database credentials, seed passwords, or authentication secrets. Do not use the normal application database for integration tests.

## Functional scope

- Authentication with `STUDENT`, `FACULTY`, and `ADMIN` roles.
- Students view their own course attendance, history, risk status, and recovery guidance.
- Faculty view and manage attendance only for course offerings assigned to them.
- Administrators view institution-level attendance summaries and offering comparisons.
- Attendance sessions and records are finalized and stored in MySQL, with percentages derived from finalized records.
- MySQL outbox events are delivered asynchronously to MongoDB for audit/event history; MongoDB does not replace or duplicate the relational attendance source of truth.
- Server-side authorization and database integrity constraints are required; client-provided identifiers alone do not authorize access.

## Local workflow requirements

- Start/reach MySQL before applying migrations or running the application.
- Configure/reach MongoDB for the outbox worker and audit functionality; normal MySQL attendance operations remain independent of MongoDB availability.
- Apply pending checked-in migrations with `prisma migrate deploy`; do not reset an existing database.
- Seed only an empty development database. The seed upserts the demo accounts and updates their password hashes to the configured `DEMO_SEED_PASSWORD`, so rerunning it changes those demo passwords.
- Run Next.js and the outbox worker in separate terminals. See the Windows and Linux/macOS instructions in the README.
