-- Representative MySQL queries for the DBMS report. Run against a disposable
-- development database. Names match prisma/schema.prisma table/column mappings.

-- SELECT: course catalog.
SELECT `id`, `code`, `name`, `credits`
FROM `courses`
ORDER BY `code`;

-- INSERT: add an offering for an existing course and term.
INSERT INTO `course_offerings`
    (`id`, `courseId`, `termId`, `sectionCode`, `attendanceThreshold`)
SELECT UUID(), c.`id`, t.`id`, 'B', 75.00
FROM `courses` AS c
JOIN `academic_terms` AS t ON t.`name` = 'Fall 2026 Demo Term'
WHERE c.`code` = 'DBMS301';

-- UPDATE: mark a demo enrollment as dropped without deleting its history.
UPDATE `enrollments` AS e
JOIN `course_offerings` AS o ON o.`id` = e.`offeringId`
JOIN `courses` AS c ON c.`id` = o.`courseId`
JOIN `student_profiles` AS sp ON sp.`id` = e.`studentId`
SET e.`status` = 'DROPPED'
WHERE c.`code` = 'DBMS301'
  AND sp.`registrationNumber` = 'DEMO-2026-005'
  AND e.`status` = 'ACTIVE';

-- DELETE: only remove a draft session that has neither attendance nor an
-- outbox reference. This is not a way to delete finalized attendance history.
DELETE s
FROM `attendance_sessions` AS s
WHERE s.`status` = 'DRAFT'
  AND s.`id` = '00000000-0000-4000-8000-000000000000'
  AND NOT EXISTS (
      SELECT 1 FROM `attendance_records` AS ar WHERE ar.`sessionId` = s.`id`
  )
  AND NOT EXISTS (
      SELECT 1 FROM `outbox_events` AS oe WHERE oe.`sessionId` = s.`id`
  );

-- JOIN: list a student's courses and offering section for the active term.
SELECT u.`name`, sp.`registrationNumber`, c.`code`, c.`name` AS `courseName`,
       o.`sectionCode`, e.`status` AS `enrollmentStatus`
FROM `student_profiles` AS sp
JOIN `users` AS u ON u.`id` = sp.`userId`
JOIN `enrollments` AS e ON e.`studentId` = sp.`id`
JOIN `course_offerings` AS o ON o.`id` = e.`offeringId`
JOIN `courses` AS c ON c.`id` = o.`courseId`
JOIN `academic_terms` AS t ON t.`id` = o.`termId`
WHERE sp.`registrationNumber` = 'DEMO-2026-001'
  AND t.`isActive` = TRUE
ORDER BY c.`code`;

-- Aggregate + GROUP BY + HAVING: enrolled roster and finalized session counts.
SELECT c.`code`, o.`sectionCode`,
       COUNT(DISTINCT e.`studentId`) AS `enrolledStudents`,
       COUNT(DISTINCT s.`id`) AS `finalizedSessions`,
       AVG(o.`attendanceThreshold`) AS `requiredAttendancePercent`
FROM `course_offerings` AS o
JOIN `courses` AS c ON c.`id` = o.`courseId`
LEFT JOIN `enrollments` AS e ON e.`offeringId` = o.`id` AND e.`status` = 'ACTIVE'
LEFT JOIN `attendance_sessions` AS s
       ON s.`offeringId` = o.`id` AND s.`status` = 'FINALIZED'
GROUP BY c.`code`, o.`sectionCode`
HAVING COUNT(DISTINCT e.`studentId`) > 0
ORDER BY `finalizedSessions` DESC, c.`code`;

-- Nested subquery: find courses with at least one student below its offering threshold.
SELECT c.`code`, c.`name`
FROM `courses` AS c
WHERE EXISTS (
    SELECT 1
    FROM `course_offerings` AS o
    WHERE o.`courseId` = c.`id`
      AND EXISTS (
          SELECT 1
          FROM `enrollments` AS e
          JOIN `attendance_records` AS ar ON ar.`studentId` = e.`studentId`
          JOIN `attendance_sessions` AS s
               ON s.`id` = ar.`sessionId`
              AND s.`offeringId` = o.`id`
              AND s.`status` = 'FINALIZED'
          WHERE e.`offeringId` = o.`id`
            AND e.`status` = 'ACTIVE'
          GROUP BY e.`studentId`
          HAVING 100.0 * SUM(ar.`status` = 'PRESENT') /
                 NULLIF(SUM(ar.`status` IN ('PRESENT', 'ABSENT')), 0)
                 < o.`attendanceThreshold`
      )
)
ORDER BY c.`code`;

-- Below-threshold students: only FINALIZED sessions count. EXCUSED records
-- are excluded from both numerator and denominator.
SELECT sp.`registrationNumber`, u.`name`, c.`code`, c.`name` AS `courseName`,
       SUM(ar.`status` = 'PRESENT') AS `presentCount`,
       SUM(ar.`status` = 'ABSENT') AS `absentCount`,
       SUM(ar.`status` IN ('PRESENT', 'ABSENT')) AS `countedSessions`,
       ROUND(100.0 * SUM(ar.`status` = 'PRESENT') /
             NULLIF(SUM(ar.`status` IN ('PRESENT', 'ABSENT')), 0), 2) AS `attendancePercent`,
       o.`attendanceThreshold`
FROM `attendance_records` AS ar
JOIN `attendance_sessions` AS s
     ON s.`id` = ar.`sessionId` AND s.`status` = 'FINALIZED'
JOIN `student_profiles` AS sp ON sp.`id` = ar.`studentId`
JOIN `users` AS u ON u.`id` = sp.`userId`
JOIN `course_offerings` AS o ON o.`id` = s.`offeringId`
JOIN `courses` AS c ON c.`id` = o.`courseId`
GROUP BY sp.`id`, sp.`registrationNumber`, u.`name`, c.`code`, c.`name`,
         o.`id`, o.`attendanceThreshold`
HAVING SUM(ar.`status` IN ('PRESENT', 'ABSENT')) > 0
   AND 100.0 * SUM(ar.`status` = 'PRESENT') /
       NULLIF(SUM(ar.`status` IN ('PRESENT', 'ABSENT')), 0) < o.`attendanceThreshold`
ORDER BY `attendancePercent` ASC, sp.`registrationNumber`;

-- Course-wise attendance summary with aggregates and stable ordering.
SELECT t.`name` AS `termName`, c.`code`, c.`name`, o.`sectionCode`,
       COUNT(DISTINCT s.`id`) AS `finalizedSessions`,
       COUNT(DISTINCT e.`studentId`) AS `activeStudents`,
       SUM(ar.`status` = 'PRESENT') AS `presentMarks`,
       SUM(ar.`status` = 'ABSENT') AS `absentMarks`,
       AVG(CASE WHEN ar.`status` IN ('PRESENT', 'ABSENT')
                THEN (ar.`status` = 'PRESENT') * 100.0 END) AS `averageCountedAttendance`
FROM `course_offerings` AS o
JOIN `courses` AS c ON c.`id` = o.`courseId`
JOIN `academic_terms` AS t ON t.`id` = o.`termId`
LEFT JOIN `enrollments` AS e
       ON e.`offeringId` = o.`id` AND e.`status` = 'ACTIVE'
LEFT JOIN `attendance_sessions` AS s
       ON s.`offeringId` = o.`id` AND s.`status` = 'FINALIZED'
LEFT JOIN `attendance_records` AS ar
       ON ar.`sessionId` = s.`id` AND ar.`studentId` = e.`studentId`
GROUP BY t.`name`, c.`code`, c.`name`, o.`sectionCode`
ORDER BY t.`name`, c.`code`, o.`sectionCode`;

-- Attendance history for one student, newest finalized session first.
SELECT s.`sessionDate`, c.`code`, c.`name` AS `courseName`, o.`sectionCode`,
       ar.`status`, ar.`markedAt`, ar.`remarks`
FROM `attendance_records` AS ar
JOIN `attendance_sessions` AS s
     ON s.`id` = ar.`sessionId` AND s.`status` = 'FINALIZED'
JOIN `course_offerings` AS o ON o.`id` = s.`offeringId`
JOIN `courses` AS c ON c.`id` = o.`courseId`
JOIN `student_profiles` AS sp ON sp.`id` = ar.`studentId`
WHERE sp.`registrationNumber` = 'DEMO-2026-001'
ORDER BY s.`sessionDate` DESC, c.`code`;
