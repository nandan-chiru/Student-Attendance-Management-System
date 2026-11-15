# Student Attendance Management System ER Diagram

```mermaid
erDiagram
    USER ||--o| STUDENT_PROFILE : has
    USER ||--o| FACULTY_PROFILE : has
    COURSE ||--o{ COURSE_OFFERING : offered_as
    ACADEMIC_TERM ||--o{ COURSE_OFFERING : contains
    COURSE_OFFERING ||--o{ OFFERING_FACULTY : assigned
    FACULTY_PROFILE ||--o{ OFFERING_FACULTY : teaches
    COURSE_OFFERING ||--o{ ENROLLMENT : has
    STUDENT_PROFILE ||--o{ ENROLLMENT : enrolls
    COURSE_OFFERING ||--o{ ATTENDANCE_SESSION : schedules
    USER ||--o{ ATTENDANCE_SESSION : creates
    ATTENDANCE_SESSION ||--o{ ATTENDANCE_RECORD : records
    STUDENT_PROFILE ||--o{ ATTENDANCE_RECORD : receives
    USER ||--o{ ATTENDANCE_RECORD : marks
    USER o|--o{ OUTBOX_EVENT : actor
    STUDENT_PROFILE o|--o{ OUTBOX_EVENT : student
    COURSE_OFFERING o|--o{ OUTBOX_EVENT : offering
    ATTENDANCE_SESSION o|--o{ OUTBOX_EVENT : session
    ATTENDANCE_RECORD o|--o{ OUTBOX_EVENT : attendance_record

    USER {
        char id PK
        varchar name
        varchar email UK
        varchar passwordHash
        enum role
    }
    STUDENT_PROFILE {
        char id PK
        char userId FK,UK
        varchar registrationNumber UK
        varchar department
        int semester
    }
    FACULTY_PROFILE {
        char id PK
        char userId FK,UK
        varchar employeeId UK
        varchar department
    }
    ACADEMIC_TERM {
        char id PK
        varchar name
        date startDate
        date endDate
        boolean isActive
    }
    COURSE {
        char id PK
        varchar code UK
        varchar name
        int credits
    }
    COURSE_OFFERING {
        char id PK
        char courseId FK
        char termId FK
        varchar sectionCode
        decimal attendanceThreshold
    }
    OFFERING_FACULTY {
        char offeringId PK,FK
        char facultyId PK,FK
    }
    ENROLLMENT {
        char id PK
        char offeringId FK
        char studentId FK
        datetime enrolledAt
        enum status
    }
    ATTENDANCE_SESSION {
        char id PK
        char offeringId FK
        date sessionDate
        enum status
        datetime finalizedAt
        char createdBy FK
    }
    ATTENDANCE_RECORD {
        char id PK
        char sessionId FK
        char studentId FK
        enum status
        datetime markedAt
        char markedBy FK
    }
    OUTBOX_EVENT {
        char id PK
        char eventId UK
        varchar eventType
        datetime occurredAt
        json payload
        datetime deliveredAt
    }
```

The outbox's optional foreign keys to actor, student, offering, session, and attendance record are shown as optional references. Table and key names correspond to `prisma/schema.prisma` and `docs/schema.md`.
