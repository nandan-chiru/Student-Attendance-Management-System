# Relational Schema

## Database choice

MySQL is the primary relational database and the canonical source of truth for users, academic structure, enrollment, sessions, and attendance records. It provides relational foreign keys, unique keys, enums, transactional operations, and SQL reporting. Prisma models the relations and generates the initial migration. Attendance percentages are derived from finalized MySQL attendance records.

MongoDB is intentionally deferred. A future stage may project outbox events to MongoDB for flexible audit/activity documents and event aggregation. MongoDB will not hold canonical attendance totals. There are no MongoDB collections, writes, or workers in this stage.

## Tables and fields

All IDs are UUID strings stored as `CHAR(36)`. Prisma supplies UUIDs for client-created rows; direct SQL examples supply `UUID()` explicitly.

| Table | Purpose and fields |
|---|---|
| `users` | Login identity: `id` PK, `name`, `email`, `passwordHash`, `role`, `createdAt`, `updatedAt`. Email is unique. `role` is `STUDENT`, `FACULTY`, or `ADMIN`. Password hashes only; never store plaintext passwords. |
| `student_profiles` | Student data: `id` PK, `userId` FK/unique, `registrationNumber` unique, `department`, `semester`. One profile per user. |
| `faculty_profiles` | Faculty data: `id` PK, `userId` FK/unique, `employeeId` unique, `department`. One profile per user. |
| `academic_terms` | Term dates: `id` PK, `name`, `startDate`, `endDate`, `isActive`. The migration checks that start is no later than end. |
| `courses` | Course catalog: `id` PK, unique `code`, `name`, positive `credits`. |
| `course_offerings` | A course in a term/section: `id` PK, `courseId` FK, `termId` FK, `sectionCode`, `attendanceThreshold`. `(courseId, termId, sectionCode)` is unique; threshold is constrained to 0–100. |
| `offering_faculty` | Join table: composite PK `(offeringId, facultyId)`, with FKs to an offering and faculty profile. |
| `enrollments` | Student registration for an offering: `id` PK, `offeringId` FK, `studentId` FK, `enrolledAt`, `status`. `(offeringId, studentId)` is unique. Status is `ACTIVE`, `DROPPED`, or `COMPLETED`. |
| `attendance_sessions` | Class meeting: `id` PK, `offeringId` FK, `sessionDate`, optional `topic`, `status`, `finalizedAt`, `createdBy` FK, timestamps. Status is `DRAFT`, `FINALIZED`, or `CANCELLED`. A database check requires `finalizedAt` exactly when status is `FINALIZED`. |
| `attendance_records` | Per-student result: `id` PK, `sessionId` FK, `studentId` FK, `status`, `markedAt`, `markedBy` FK, optional `remarks`. `(sessionId, studentId)` is unique. Status is `PRESENT`, `ABSENT`, or `EXCUSED`. |
| `outbox_events` | Future delivery queue: `id` PK, unique `eventId`, `eventType`, `occurredAt`, optional actor/student/offering/session/record FKs, JSON `payload`, optional `deliveredAt`, `createdAt`. It is only the SQL outbox model; there is no processor yet. |

The profile role and `User.role` must agree (for example, a `STUDENT` user has a student profile). That cross-table business rule is enforced by the future account-provisioning service; a simple FK cannot express it. The schema allows an `ADMIN` user to have neither profile.

## Relationships

- `User` to `StudentProfile`: one-to-zero-or-one; `StudentProfile.userId` is unique.
- `User` to `FacultyProfile`: one-to-zero-or-one; `FacultyProfile.userId` is unique.
- `AcademicTerm` to `CourseOffering`: one-to-many.
- `Course` to `CourseOffering`: one-to-many.
- `CourseOffering` to `FacultyProfile`: many-to-many through `OfferingFaculty`.
- `CourseOffering` to `StudentProfile`: many-to-many through `Enrollment`.
- `CourseOffering` to `AttendanceSession`: one-to-many.
- `AttendanceSession` to `AttendanceRecord`: one-to-many.
- `StudentProfile` to `AttendanceRecord`: one-to-many.
- `User` may create sessions and mark records; optional event references in `OutboxEvent` point to the actor, student, offering, session, and attendance record when applicable.

## Keys, constraints, and indexes

### Primary and unique keys

- Every entity has a primary key; `OfferingFaculty` uses the composite primary key `(offeringId, facultyId)`.
- Unique keys: `users.email`, `student_profiles.userId`, `student_profiles.registrationNumber`, `faculty_profiles.userId`, `faculty_profiles.employeeId`, `courses.code`, `(course_offerings.courseId, termId, sectionCode)`, `(enrollments.offeringId, studentId)`, `(attendance_records.sessionId, studentId)`, and `outbox_events.eventId`.
- Required scalar fields are non-null. Prisma enums restrict role, enrollment, session, and attendance status values.
- Foreign keys use MySQL/InnoDB relational integrity.
- The initial migration adds checks for term date order, positive course credits, an attendance threshold between 0 and 100, and finalized-session timestamp consistency.

### Referential actions

Academic records use `ON DELETE RESTRICT`: courses and terms cannot be deleted while offerings refer to them; offerings cannot be deleted while assignments, enrollments, or sessions refer to them; students cannot be deleted while enrollments or attendance records refer to them; sessions and attendance records cannot be deleted while historical records depend on them. User/profile and audit actor references are also restricted where removing the account would undermine attribution. Prefer status changes or account deactivation in later application logic over deleting historical rows.

Outbox foreign keys use `ON DELETE SET NULL` because a delivered event should remain even if a related source row is eventually removed. The event's JSON payload remains the immutable snapshot; the optional FK is only a navigable live reference.

### Indexes and intended query paths

| Index | Purpose |
|---|---|
| Unique `users.email` | Login lookup and duplicate prevention. Normalize email in the future auth service; MySQL's default collation is case-insensitive. |
| Unique profile `userId`, registration number, employee ID | One profile per user and exact identity lookup. |
| `student_profiles(department, semester)` | Filter the student directory by cohort. |
| `faculty_profiles(department)` | Filter the faculty directory. |
| `academic_terms(isActive, startDate)` | Select active/recent terms. |
| Unique course `code` | Course lookup and duplicate prevention. |
| Unique `course_offerings(courseId, termId, sectionCode)` | Prevent duplicate section offering; supports course/term lookup by its leftmost columns. |
| `course_offerings(termId, courseId)` | Term-first listing/filtering. |
| Composite PK `offering_faculty(offeringId, facultyId)` | Offering assignment checks; reverse index `(facultyId, offeringId)` supports a faculty dashboard. |
| Unique `enrollments(offeringId, studentId)` | Prevent duplicate enrollment and support offering roster lookup; `(studentId, status)` supports a student's active schedule. |
| `attendance_sessions(offeringId, sessionDate)` | Offering session history and date order. |
| Unique `attendance_records(sessionId, studentId)` | One result per student/session and roster lookup; `(studentId, sessionId)` supports student history and percentage aggregation. |
| Unique `outbox_events.eventId` | Idempotent event delivery identity. |
| `outbox_events(deliveredAt, createdAt)` | Poll undelivered events in creation order. |
| `outbox_events(eventType, occurredAt)` | Later event-type/time reporting. |

Indexes created by unique keys are not duplicated with identical ordinary indexes.

## Attendance calculation rules

Only records belonging to `FINALIZED` sessions are eligible for attendance calculations. `PRESENT` contributes to attended classes; `ABSENT` contributes to classes held and not attended. `EXCUSED` is excluded from both the numerator and denominator. Stage 5 creates each session and one record for every ACTIVE enrollee in the same transaction, then finalizes the session. Missing marks are rejected rather than interpreted as a status.

The database check ensures a finalized session has a `finalizedAt` timestamp and a draft/cancelled session does not. Query logic still filters on `AttendanceSession.status = 'FINALIZED'`. This stage treats finalized sessions as immutable: there is no attendance update action. A session with the same offering/date/topic is rejected by the service within a serializable transaction. The existing index is not a unique key because an offering can hold multiple distinct topics on the same date.

Attendance percentages are derived in the service layer from each student's marks in finalized sessions. The denominator is PRESENT + ABSENT marks; EXCUSED is shown in history but excluded. An empty denominator safely returns 0%. No percentage is persisted.

## Seed data

`prisma/seed.ts` creates fictional admin, faculty, and student accounts; a term; courses and offerings; faculty assignments; enrollments; and finalized sessions with present/absent records. It is idempotent by unique keys. Seed users share a bcrypt hash created from the local-only `DEMO_SEED_PASSWORD` environment variable. The plaintext password is not in source control.
