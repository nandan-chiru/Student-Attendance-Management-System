import {
  emptyAuditHistory,
  emptyAuditSummary,
  AUDIT_PAGE_SIZE,
  type AuditHistory,
  type AuditSummary,
  type AuditScope,
} from "@/services/audit/aggregation";

export type AttendanceAuditReport = {
  summary: AuditSummary;
  history: AuditHistory;
  offeringLabels: Array<{
    id: string;
    sectionCode: string;
    course: { code: string; name: string };
    term: { name: string };
  }>;
};

export type AttendanceAuditServiceDependencies = {
  requireAdmin: () => Promise<unknown>;
  requireFaculty: () => Promise<{ facultyProfileId: string }>;
  listFacultyAuditOfferingIds: (facultyId: string) => Promise<string[]>;
  getAttendanceEventSummary: (scope: AuditScope) => Promise<AuditSummary>;
  getRecentAttendanceEvents: (scope: AuditScope, page: number) => Promise<AuditHistory>;
  getAuditOfferingLabels: (offeringIds: string[]) => Promise<AttendanceAuditReport["offeringLabels"]>;
};

export function createAttendanceAuditService(dependencies: AttendanceAuditServiceDependencies) {
  function emptyReport(page: number): AttendanceAuditReport {
    return {
      summary: emptyAuditSummary(),
      history: emptyAuditHistory(page, AUDIT_PAGE_SIZE),
      offeringLabels: [],
    };
  }

  async function buildReport(scope: AuditScope, page: number): Promise<AttendanceAuditReport> {
    if (scope.kind === "offerings" && scope.offeringIds.length === 0) return emptyReport(page);

    const [summary, history] = await Promise.all([
      dependencies.getAttendanceEventSummary(scope),
      dependencies.getRecentAttendanceEvents(scope, page),
    ]);
    const offeringIds = [...new Set([
      ...summary.eventsByOffering.map(({ offeringId }) => offeringId),
      ...history.events.map(({ offeringId }) => offeringId),
    ])];
    const offeringLabels = await dependencies.getAuditOfferingLabels(offeringIds);
    return { summary, history, offeringLabels };
  }

  return {
    /** Admin receives global aggregates after a server-side role check. */
    async getAdminAttendanceAuditReport(page = 1): Promise<AttendanceAuditReport> {
      await dependencies.requireAdmin();
      return buildReport({ kind: "all" }, page);
    },

    /** Faculty scope is resolved from MySQL; this API accepts no offering ID from the caller. */
    async getFacultyAttendanceAuditReport(page = 1): Promise<AttendanceAuditReport> {
      const faculty = await dependencies.requireFaculty();
      const offeringIds = await dependencies.listFacultyAuditOfferingIds(faculty.facultyProfileId);
      return buildReport({ kind: "offerings", offeringIds }, page);
    },
  };
}
