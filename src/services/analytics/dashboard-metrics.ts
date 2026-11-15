import { calculateAttendanceFromCounts } from "@/services/attendance/calculations";
import { analyzeAttendanceRisk, type AttendanceRiskStatus } from "@/services/attendance/risk";
import type { DailyAttendanceCounts, StudentOfferingCounts } from "@/dal/analytics/attendance-dashboard";

export type DashboardOffering = {
  id: string;
  termId: string;
  sectionCode: string;
  attendanceThreshold: number | { toString(): string };
  course: { code: string; name: string };
  term: { id: string; name: string; isActive: boolean };
};

export type OfferingAttendanceAnalytics = {
  offeringId: string;
  termId: string;
  sectionCode: string;
  course: { code: string; name: string };
  term: { name: string };
  enrollmentCount: number;
  finalizedSessionCount: number;
  attendance: ReturnType<typeof calculateAttendanceFromCounts>;
  atRiskStudentCount: number;
  criticalStudentCount: number;
  noDataStudentCount: number;
};

export type AttendanceTrendPoint = DailyAttendanceCounts & { percentage: number };

export function buildAttendanceTrend(rows: DailyAttendanceCounts[]): AttendanceTrendPoint[] {
  return rows.slice(-12).map((row) => ({
    ...row,
    percentage: calculateAttendanceFromCounts(row).percentage,
  }));
}

export function buildStudentAttendanceTrend(
  courses: Array<{ history: Array<{ sessionDate: Date; status: string }> }>,
): AttendanceTrendPoint[] {
  const daily = new Map<string, { attended: number; absent: number }>();
  for (const course of courses) {
    for (const record of course.history) {
      if (record.status !== "PRESENT" && record.status !== "ABSENT") continue;
      const date = record.sessionDate.toISOString().slice(0, 10);
      const counts = daily.get(date) ?? { attended: 0, absent: 0 };
      if (record.status === "PRESENT") counts.attended += 1;
      else counts.absent += 1;
      daily.set(date, counts);
    }
  }
  return buildAttendanceTrend([...daily.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([date, counts]) => ({ date, ...counts })));
}

export function buildOfferingAttendanceAnalytics(input: {
  offerings: DashboardOffering[];
  studentCounts: StudentOfferingCounts[];
  enrollmentCountByOffering: Map<string, number>;
  finalizedSessionCountByOffering: Map<string, number>;
}) {
  const rowsByOffering = new Map<string, StudentOfferingCounts[]>();
  for (const row of input.studentCounts) {
    const rows = rowsByOffering.get(row.offeringId) ?? [];
    rows.push(row);
    rowsByOffering.set(row.offeringId, rows);
  }

  const atRiskIds = new Set<string>();
  const criticalIds = new Set<string>();
  const noDataIds = new Set<string>();
  let attended = 0;
  let absent = 0;
  let totalEnrollmentCount = 0;
  let finalizedSessionCount = 0;
  const allStudentIds = new Set<string>();
  const offerings = input.offerings.map((offering): OfferingAttendanceAnalytics => {
    const studentRows = rowsByOffering.get(offering.id) ?? [];
    let offeringAttended = 0;
    let offeringAbsent = 0;
    let atRiskStudentCount = 0;
    let criticalStudentCount = 0;
    let noDataStudentCount = 0;
    const threshold = Number(offering.attendanceThreshold);

    for (const student of studentRows) {
      offeringAttended += student.attended;
      offeringAbsent += student.absent;
      allStudentIds.add(student.studentId);
      const risk = analyzeAttendanceRisk({
        attended: student.attended,
        held: student.attended + student.absent,
        requiredPercent: threshold,
      });
      if (risk.status === "AT_RISK") {
        atRiskStudentCount += 1;
        atRiskIds.add(student.studentId);
      } else if (risk.status === "CRITICAL") {
        criticalStudentCount += 1;
        criticalIds.add(student.studentId);
      } else if (risk.status === "NO_DATA") {
        noDataStudentCount += 1;
        noDataIds.add(student.studentId);
      }
    }

    const enrollmentCount = input.enrollmentCountByOffering.get(offering.id) ?? studentRows.length;
    const offeringSessionCount = input.finalizedSessionCountByOffering.get(offering.id) ?? 0;
    attended += offeringAttended;
    absent += offeringAbsent;
    totalEnrollmentCount += enrollmentCount;
    finalizedSessionCount += offeringSessionCount;

    return {
      offeringId: offering.id,
      termId: offering.termId,
      sectionCode: offering.sectionCode,
      course: offering.course,
      term: { name: offering.term.name },
      enrollmentCount,
      finalizedSessionCount: offeringSessionCount,
      attendance: calculateAttendanceFromCounts({
        attended: offeringAttended,
        absent: offeringAbsent,
        excused: studentRows.reduce((sum, student) => sum + student.excused, 0),
      }),
      atRiskStudentCount,
      criticalStudentCount,
      noDataStudentCount,
    };
  });

  return {
    offerings,
    totals: {
      offeringCount: offerings.length,
      enrollmentCount: totalEnrollmentCount,
      uniqueStudentCount: allStudentIds.size,
      finalizedSessionCount,
      attendance: calculateAttendanceFromCounts({
        attended,
        absent,
        excused: input.studentCounts.reduce((sum, student) => sum + student.excused, 0),
      }),
      atRiskStudentCount: atRiskIds.size,
      criticalStudentCount: criticalIds.size,
      noDataStudentCount: noDataIds.size,
    },
  };
}

export function summarizeStudentDashboard(input: {
  overall: ReturnType<typeof calculateAttendanceFromCounts>;
  courses: Array<{ attendance: ReturnType<typeof calculateAttendanceFromCounts>; risk: { status: AttendanceRiskStatus } }>;
}) {
  return {
    overallAttendancePercent: input.overall.percentage,
    attended: input.overall.attended,
    missed: input.overall.absent,
    coursesWithAttendanceData: input.courses.filter(({ attendance }) => attendance.held > 0).length,
    atRiskCourseCount: input.courses.filter(({ risk }) => risk.status === "AT_RISK").length,
    criticalCourseCount: input.courses.filter(({ risk }) => risk.status === "CRITICAL").length,
    noDataCourseCount: input.courses.filter(({ risk }) => risk.status === "NO_DATA").length,
  };
}
