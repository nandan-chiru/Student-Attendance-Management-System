import "server-only";
import { requireAdmin, requireFaculty } from "@/auth/authorization";
import { getAuditOfferingLabels, listFacultyAuditOfferingIds } from "@/dal/audit/mysql-audit-scope";
import { getAttendanceEventSummary, getRecentAttendanceEvents } from "@/dal/audit/attendance-events";
import { createAttendanceAuditService } from "@/services/audit/attendance-audit-core";

const attendanceAuditService = createAttendanceAuditService({
  requireAdmin,
  requireFaculty,
  listFacultyAuditOfferingIds,
  getAttendanceEventSummary,
  getRecentAttendanceEvents,
  getAuditOfferingLabels,
});

export type { AttendanceAuditReport } from "@/services/audit/attendance-audit-core";
export const getAdminAttendanceAuditReport = attendanceAuditService.getAdminAttendanceAuditReport;
export const getFacultyAttendanceAuditReport = attendanceAuditService.getFacultyAttendanceAuditReport;
