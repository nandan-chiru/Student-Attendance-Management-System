import "server-only";
import { requireFaculty } from "@/auth/authorization";
import {
  getActiveEnrollmentCounts,
  getDailyAttendanceCounts,
  getFinalizedSessionCounts,
  getStudentOfferingAttendanceCounts,
  listFacultyDashboardOfferings,
  listRecentFinalizedActivity,
} from "@/dal/analytics/attendance-dashboard";
import { buildAttendanceTrend, buildOfferingAttendanceAnalytics, type DashboardOffering } from "@/services/analytics/dashboard-metrics";
import { parseFacultyDashboardFilters, selectFacultyDashboardOfferings } from "@/services/analytics/faculty-dashboard-filters";

function countByOffering(rows: Array<{ offeringId: string; _count: { _all: number } }>) {
  return new Map(rows.map((row) => [row.offeringId, row._count._all]));
}

export async function getFacultyAttendanceDashboard(input: Record<string, unknown> = {}) {
  const faculty = await requireFaculty();
  const filters = parseFacultyDashboardFilters(input);
  const assignedOfferings = await listFacultyDashboardOfferings(faculty.facultyProfileId);
  const selectedOfferings = selectFacultyDashboardOfferings(assignedOfferings, filters);
  const offeringIds = selectedOfferings.map(({ id }) => id);
  const [enrollmentRows, sessionRows, studentCounts, trendRows, recentActivity] = await Promise.all([
    getActiveEnrollmentCounts(offeringIds),
    getFinalizedSessionCounts(offeringIds),
    getStudentOfferingAttendanceCounts(offeringIds),
    getDailyAttendanceCounts(offeringIds, filters),
    listRecentFinalizedActivity(offeringIds),
  ]);
  const analytics = buildOfferingAttendanceAnalytics({
    offerings: selectedOfferings as DashboardOffering[],
    studentCounts,
    enrollmentCountByOffering: countByOffering(enrollmentRows),
    finalizedSessionCountByOffering: countByOffering(sessionRows),
  });
  const termOptions = [...new Map(assignedOfferings.map((offering) => [offering.termId, {
    id: offering.termId,
    name: offering.term.name,
  }])).values()].sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...analytics,
    uniqueStudentCount: analytics.totals.uniqueStudentCount,
    trend: buildAttendanceTrend(trendRows),
    recentActivity,
    filters,
    filterOptions: {
      offerings: assignedOfferings.map((offering) => ({
        id: offering.id,
        label: `${offering.course.code} · ${offering.course.name} · ${offering.sectionCode}`,
      })),
      terms: termOptions,
    },
  };
}
