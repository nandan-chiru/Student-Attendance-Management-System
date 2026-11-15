import { calculateAttendanceFromCounts } from "@/services/attendance/calculations";

export function buildAdminDashboardSummary(
  entityCounts: { students: number; faculty: number; courses: number; activeOfferings: number; finalizedSessions: number },
  statusCounts: Array<{ status: string; count: number }>,
) {
  const counts = new Map(statusCounts.map(({ status, count }) => [status, count]));
  return {
    ...entityCounts,
    overallAttendance: calculateAttendanceFromCounts({
      attended: counts.get("PRESENT") ?? 0,
      absent: counts.get("ABSENT") ?? 0,
      excused: counts.get("EXCUSED") ?? 0,
    }),
  };
}
