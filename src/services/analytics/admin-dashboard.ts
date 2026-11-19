import "server-only";
import { requireAdmin } from "@/auth/authorization";
import {
  getActiveEnrollmentCounts,
  getAdminEntityCounts,
  getDailyAttendanceCounts,
  getFinalizedAttendanceStatusCounts,
  getFinalizedSessionCounts,
  getStudentOfferingAttendanceCounts,
  listAdminActiveDashboardOfferings,
  listRecentFinalizedActivity,
} from "@/dal/analytics/attendance-dashboard";
import { buildAttendanceTrend, buildOfferingAttendanceAnalytics } from "@/services/analytics/dashboard-metrics";
import { buildAdminDashboardSummary } from "@/services/analytics/admin-dashboard-metrics";

function countByOffering(rows: Array<{ offeringId: string; _count: { _all: number } }>) {
  return new Map(rows.map((row) => [row.offeringId, row._count._all]));
}

export async function getAdminAttendanceDashboard() {
  await requireAdmin();

  const [entityCounts, statusRows, offerings] = await Promise.all([
    getAdminEntityCounts(),
    getFinalizedAttendanceStatusCounts(),
    listAdminActiveDashboardOfferings(),
  ]);
  const offeringIds = offerings.map(({ id }) => id);
  const [enrollmentRows, sessionRows, studentCounts, trendRows, recentActivity] = await Promise.all([
    getActiveEnrollmentCounts(offeringIds),
    getFinalizedSessionCounts(offeringIds),
    getStudentOfferingAttendanceCounts(offeringIds),
    getDailyAttendanceCounts(offeringIds),
    listRecentFinalizedActivity(offeringIds),
  ]);
  const offeringAnalytics = buildOfferingAttendanceAnalytics({
    offerings,
    studentCounts,
    enrollmentCountByOffering: countByOffering(enrollmentRows),
    finalizedSessionCountByOffering: countByOffering(sessionRows),
  });
  const summary = buildAdminDashboardSummary(entityCounts, statusRows.map(({ status, _count }) => ({
    status,
    count: _count._all,
  })));

  return {
    ...summary,
    atRiskStudentCount: offeringAnalytics.totals.atRiskStudentCount,
    criticalStudentCount: offeringAnalytics.totals.criticalStudentCount,
    noDataStudentCount: offeringAnalytics.totals.noDataStudentCount,
    offerings: offeringAnalytics.offerings,
    trend: buildAttendanceTrend(trendRows),
    recentActivity,
  };
}
