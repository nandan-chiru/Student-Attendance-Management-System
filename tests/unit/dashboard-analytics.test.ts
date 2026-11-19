import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateAttendanceFromCounts } from "@/services/attendance/calculations";
import {
  buildAttendanceTrend,
  buildOfferingAttendanceAnalytics,
  buildStudentAttendanceTrend,
  summarizeStudentDashboard,
  type DashboardOffering,
} from "@/services/analytics/dashboard-metrics";
import { parseFacultyDashboardFilters, selectFacultyDashboardOfferings } from "@/services/analytics/faculty-dashboard-filters";
import { buildAdminDashboardSummary } from "@/services/analytics/admin-dashboard-metrics";

const offerings: DashboardOffering[] = [
  { id: "offering-a", termId: "term-a", sectionCode: "A", attendanceThreshold: 75, course: { code: "DB101", name: "Database Systems" }, term: { id: "term-a", name: "Fall", isActive: true } },
  { id: "offering-b", termId: "term-b", sectionCode: "B", attendanceThreshold: 100, course: { code: "NW201", name: "Networks" }, term: { id: "term-b", name: "Spring", isActive: true } },
];

test("student dashboard aggregation summarizes percentages, course risk and empty courses", () => {
  const courses = [
    { attendance: calculateAttendanceFromCounts({ attended: 8, absent: 2 }), risk: { status: "SAFE" as const } },
    { attendance: calculateAttendanceFromCounts({ attended: 5, absent: 5 }), risk: { status: "AT_RISK" as const } },
    { attendance: calculateAttendanceFromCounts({ attended: 0, absent: 0 }), risk: { status: "NO_DATA" as const } },
    { attendance: calculateAttendanceFromCounts({ attended: 9, absent: 1 }), risk: { status: "CRITICAL" as const } },
  ];
  const summary = summarizeStudentDashboard({
    overall: calculateAttendanceFromCounts({ attended: 22, absent: 8, excused: 2 }),
    courses,
  });
  assert.deepEqual(summary, {
    overallAttendancePercent: 73.33,
    attended: 22,
    missed: 8,
    coursesWithAttendanceData: 3,
    atRiskCourseCount: 1,
    criticalCourseCount: 1,
    noDataCourseCount: 1,
  });
});

test("attendance calculation safely handles zero denominator and excludes excused marks", () => {
  assert.deepEqual(calculateAttendanceFromCounts({ attended: 0, absent: 0, excused: 3 }), {
    attended: 0, absent: 0, excused: 3, held: 0, percentage: 0,
  });
  assert.equal(calculateAttendanceFromCounts({ attended: 3, absent: 1, excused: 9 }).percentage, 75);
});

test("offering aggregation uses authoritative risk and recovery rules and handles no-data offerings", () => {
  const result = buildOfferingAttendanceAnalytics({
    offerings,
    studentCounts: [
      { offeringId: "offering-a", studentId: "student-1", attended: 5, absent: 5, excused: 1 },
      { offeringId: "offering-a", studentId: "student-2", attended: 0, absent: 0, excused: 0 },
      { offeringId: "offering-b", studentId: "student-1", attended: 9, absent: 1, excused: 0 },
    ],
    enrollmentCountByOffering: new Map([["offering-a", 2], ["offering-b", 1]]),
    finalizedSessionCountByOffering: new Map([["offering-a", 6], ["offering-b", 10]]),
  });
  assert.equal(result.offerings[0].attendance.percentage, 50);
  assert.equal(result.offerings[0].atRiskStudentCount, 1);
  assert.equal(result.offerings[0].noDataStudentCount, 1);
  assert.equal(result.offerings[1].criticalStudentCount, 1);
  assert.equal(result.totals.atRiskStudentCount, 1);
  assert.equal(result.totals.criticalStudentCount, 1);
  assert.equal(result.totals.noDataStudentCount, 1);
  assert.equal(result.totals.uniqueStudentCount, 2);
});

test("student attendance trend groups sessions by date and ignores EXCUSED marks", () => {
  const trend = buildStudentAttendanceTrend([
    { history: [
      { sessionDate: new Date("2026-01-02T00:00:00Z"), status: "PRESENT" },
      { sessionDate: new Date("2026-01-02T00:00:00Z"), status: "ABSENT" },
      { sessionDate: new Date("2026-01-02T00:00:00Z"), status: "EXCUSED" },
    ] },
  ]);
  assert.deepEqual(trend, [{ date: "2026-01-02", attended: 1, absent: 1, percentage: 50 }]);
});

test("faculty filters cannot expand scope beyond assigned offerings", () => {
  const assigned = [{ id: "assigned-1", termId: "term-a" }, { id: "assigned-2", termId: "term-b" }];
  assert.deepEqual(selectFacultyDashboardOfferings(assigned, { offeringId: "foreign-offering", termId: "term-a" }), []);
  assert.deepEqual(selectFacultyDashboardOfferings(assigned, { offeringId: "assigned-2", termId: "term-a" }), []);
  assert.deepEqual(selectFacultyDashboardOfferings(assigned, { offeringId: "assigned-2" }), [assigned[1]]);
});

test("faculty dashboard filters reject invalid and reversed date ranges", () => {
  assert.deepEqual(parseFacultyDashboardFilters({ fromDate: "2026-02-31", toDate: "2026-03-01" }), { toDate: "2026-03-01" });
  assert.deepEqual(parseFacultyDashboardFilters({ fromDate: "2026-04-02", toDate: "2026-04-01" }), {});
  assert.deepEqual(parseFacultyDashboardFilters({ fromDate: "2026-04-01", toDate: "2026-04-02" }), { fromDate: "2026-04-01", toDate: "2026-04-02" });
});

test("admin dashboard aggregates database status counts using the same zero-data percentage rule", () => {
  const summary = buildAdminDashboardSummary(
    { students: 5, faculty: 2, courses: 3, activeOfferings: 4, finalizedSessions: 12 },
    [{ status: "EXCUSED", count: 4 }],
  );
  assert.equal(summary.students, 5);
  assert.equal(summary.overallAttendance.held, 0);
  assert.equal(summary.overallAttendance.percentage, 0);
  assert.deepEqual(buildAdminDashboardSummary(
    { students: 5, faculty: 2, courses: 3, activeOfferings: 4, finalizedSessions: 12 },
    [{ status: "PRESENT", count: 15 }, { status: "ABSENT", count: 5 }, { status: "EXCUSED", count: 2 }],
  ).overallAttendance, calculateAttendanceFromCounts({ attended: 15, absent: 5, excused: 2 }));
  const empty = buildAttendanceTrend([]);
  assert.deepEqual(empty, []);
  const trend = buildAttendanceTrend(Array.from({ length: 15 }, (_, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    attended: index,
    absent: 1,
  })));
  assert.equal(trend.length, 12);
  assert.equal(trend[0].date, "2026-01-04");
});
