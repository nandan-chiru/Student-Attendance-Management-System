import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type DashboardDateRange = { fromDate?: string; toDate?: string };
export type StudentOfferingCounts = { offeringId: string; studentId: string; attended: number; absent: number; excused: number };
export type DailyAttendanceCounts = { date: string; attended: number; absent: number };

const offeringSelect = {
  id: true,
  termId: true,
  sectionCode: true,
  attendanceThreshold: true,
  course: { select: { code: true, name: true } },
  term: { select: { id: true, name: true, isActive: true } },
} as const;

export async function listFacultyDashboardOfferings(facultyId: string) {
  const assignments = await prisma.offeringFaculty.findMany({
    where: { facultyId },
    orderBy: { offering: { course: { code: "asc" } } },
    select: { offering: { select: offeringSelect } },
  });
  return assignments.map(({ offering }) => offering);
}

export async function listAdminActiveDashboardOfferings() {
  return prisma.courseOffering.findMany({
    where: { term: { isActive: true } },
    orderBy: [{ course: { code: "asc" } }, { sectionCode: "asc" }],
    select: offeringSelect,
  });
}

export async function listDashboardOfferingsByIds(offeringIds: string[]) {
  if (offeringIds.length === 0) return [];
  return prisma.courseOffering.findMany({
    where: { id: { in: offeringIds } },
    orderBy: [{ course: { code: "asc" } }, { sectionCode: "asc" }],
    select: offeringSelect,
  });
}

export async function getActiveEnrollmentCounts(offeringIds: string[]) {
  if (offeringIds.length === 0) return [];
  return prisma.enrollment.groupBy({
    by: ["offeringId"],
    where: { offeringId: { in: offeringIds }, status: "ACTIVE" },
    _count: { _all: true },
  });
}

export async function getFinalizedSessionCounts(offeringIds: string[], range: DashboardDateRange = {}) {
  if (offeringIds.length === 0) return [];
  return prisma.attendanceSession.groupBy({
    by: ["offeringId"],
    where: {
      offeringId: { in: offeringIds },
      status: "FINALIZED",
      ...(range.fromDate ? { sessionDate: { gte: new Date(`${range.fromDate}T00:00:00.000Z`) } } : {}),
      ...(range.toDate ? { sessionDate: { lte: new Date(`${range.toDate}T00:00:00.000Z`) } } : {}),
    },
    _count: { _all: true },
  });
}

function sessionDateConditions(range: DashboardDateRange): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [Prisma.sql`s.status = 'FINALIZED'`];
  if (range.fromDate) conditions.push(Prisma.sql`s.sessionDate >= ${new Date(`${range.fromDate}T00:00:00.000Z`)}`);
  if (range.toDate) conditions.push(Prisma.sql`s.sessionDate <= ${new Date(`${range.toDate}T00:00:00.000Z`)}`);
  return conditions;
}

/** Returns one aggregate row per active student/offering, not one row per attendance mark. */
export async function getStudentOfferingAttendanceCounts(
  offeringIds: string[],
  range: DashboardDateRange = {},
): Promise<StudentOfferingCounts[]> {
  if (offeringIds.length === 0) return [];
  const rows = await prisma.$queryRaw<Array<{
    offeringId: string;
    studentId: string;
    attended: number | bigint;
    absent: number | bigint;
    excused: number | bigint;
  }>>(Prisma.sql`
    SELECT e.offeringId AS offeringId,
           e.studentId AS studentId,
           CAST(SUM(CASE WHEN r.status = 'PRESENT' THEN 1 ELSE 0 END) AS UNSIGNED) AS attended,
           CAST(SUM(CASE WHEN r.status = 'ABSENT' THEN 1 ELSE 0 END) AS UNSIGNED) AS absent,
           CAST(SUM(CASE WHEN r.status = 'EXCUSED' THEN 1 ELSE 0 END) AS UNSIGNED) AS excused
    FROM enrollments e
    LEFT JOIN attendance_sessions s
      ON s.offeringId = e.offeringId AND ${Prisma.join(sessionDateConditions(range), " AND ")}
    LEFT JOIN attendance_records r ON r.sessionId = s.id AND r.studentId = e.studentId
    WHERE e.status = 'ACTIVE' AND e.offeringId IN (${Prisma.join(offeringIds)})
    GROUP BY e.offeringId, e.studentId
    ORDER BY e.offeringId ASC, e.studentId ASC
  `);
  return rows.map((row) => ({
    ...row,
    attended: Number(row.attended),
    absent: Number(row.absent),
    excused: Number(row.excused),
  }));
}

export async function getDailyAttendanceCounts(
  offeringIds: string[],
  range: DashboardDateRange = {},
): Promise<DailyAttendanceCounts[]> {
  if (offeringIds.length === 0) return [];
  const rows = await prisma.$queryRaw<Array<{
    date: string;
    attended: number | bigint;
    absent: number | bigint;
  }>>(Prisma.sql`
    SELECT DATE_FORMAT(s.sessionDate, '%Y-%m-%d') AS date,
           CAST(SUM(CASE WHEN r.status = 'PRESENT' THEN 1 ELSE 0 END) AS UNSIGNED) AS attended,
           CAST(SUM(CASE WHEN r.status = 'ABSENT' THEN 1 ELSE 0 END) AS UNSIGNED) AS absent
    FROM attendance_sessions s
    INNER JOIN attendance_records r ON r.sessionId = s.id
    INNER JOIN enrollments e ON e.offeringId = s.offeringId AND e.studentId = r.studentId AND e.status = 'ACTIVE'
    WHERE s.offeringId IN (${Prisma.join(offeringIds)})
      AND ${Prisma.join(sessionDateConditions(range), " AND ")}
    GROUP BY s.sessionDate
    ORDER BY s.sessionDate DESC
    LIMIT 12
  `);
  return rows.reverse().map((row) => ({ date: row.date, attended: Number(row.attended), absent: Number(row.absent) }));
}

export async function getFinalizedAttendanceStatusCounts() {
  return prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { session: { status: "FINALIZED" } },
    _count: { _all: true },
  });
}

export async function getAdminEntityCounts() {
  const [students, faculty, courses, activeOfferings, finalizedSessions] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.facultyProfile.count(),
    prisma.course.count(),
    prisma.courseOffering.count({ where: { term: { isActive: true } } }),
    prisma.attendanceSession.count({ where: { status: "FINALIZED" } }),
  ]);
  return { students, faculty, courses, activeOfferings, finalizedSessions };
}

export async function listRecentFinalizedActivity(offeringIds: string[], limit = 8) {
  if (offeringIds.length === 0) return [];
  return prisma.attendanceSession.findMany({
    where: { offeringId: { in: offeringIds }, status: "FINALIZED" },
    orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      sessionDate: true,
      topic: true,
      offering: {
        select: {
          id: true,
          sectionCode: true,
          course: { select: { code: true, name: true } },
          term: { select: { name: true } },
        },
      },
      _count: { select: { records: true } },
    },
  });
}
