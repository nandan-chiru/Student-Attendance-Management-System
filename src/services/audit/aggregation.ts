import type { Document } from "mongodb";

export type AuditScope =
  | { kind: "all" }
  | { kind: "offerings"; offeringIds: string[] };

export type AuditAggregateFilter = {
  eventType: "ATTENDANCE_SESSION_FINALIZED";
  offeringId?: { $in: string[] };
};

export type AuditSummary = {
  totalEvents: number;
  affectedStudentCount: number;
  eventsByDate: Array<{ date: string; eventCount: number }>;
  eventsByOffering: Array<{ offeringId: string; eventCount: number; affectedStudentCount: number }>;
};

export type AuditEventRecord = {
  eventId: string;
  eventType: "ATTENDANCE_SESSION_FINALIZED";
  occurredAt: string;
  sessionId: string;
  offeringId: string;
  facultyId: string;
  affectedStudentCount: number;
  metadata: { schemaVersion: 1; sessionDate: string };
};

export type AuditHistory = {
  events: AuditEventRecord[];
  totalEvents: number;
  page: number;
  pageSize: number;
};

export const AUDIT_PAGE_SIZE = 20;
const MAX_AUDIT_PAGE = 10_000;

export function normalizeAuditPage(page: number): number {
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, MAX_AUDIT_PAGE);
}

export function buildAuditMatch(scope: AuditScope): AuditAggregateFilter {
  return {
    eventType: "ATTENDANCE_SESSION_FINALIZED",
    ...(scope.kind === "offerings" ? { offeringId: { $in: [...scope.offeringIds] } } : {}),
  };
}

export function buildAuditSummaryPipeline(scope: AuditScope): Document[] {
  return [
    { $match: buildAuditMatch(scope) },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalEvents: { $sum: 1 },
              affectedStudentCount: { $sum: { $ifNull: ["$affectedStudentCount", 0] } },
            },
          },
        ],
        eventsByDate: [
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: { $toDate: "$occurredAt" },
                  timezone: "UTC",
                },
              },
              eventCount: { $sum: 1 },
            },
          },
          { $sort: { _id: -1 } },
        ],
        eventsByOffering: [
          {
            $group: {
              _id: "$offeringId",
              eventCount: { $sum: 1 },
              affectedStudentCount: { $sum: { $ifNull: ["$affectedStudentCount", 0] } },
            },
          },
          { $sort: { eventCount: -1, _id: 1 } },
        ],
      },
    },
  ];
}

export function transformAuditSummary(input?: {
  totals?: Array<{ totalEvents?: number; affectedStudentCount?: number }>;
  eventsByDate?: Array<{ _id: string; eventCount: number }>;
  eventsByOffering?: Array<{ _id: string; eventCount: number; affectedStudentCount: number }>;
}): AuditSummary {
  const totals = input?.totals?.[0];
  return {
    totalEvents: totals?.totalEvents ?? 0,
    affectedStudentCount: totals?.affectedStudentCount ?? 0,
    eventsByDate: (input?.eventsByDate ?? []).map(({ _id, eventCount }) => ({ date: _id, eventCount })),
    eventsByOffering: (input?.eventsByOffering ?? []).map(({ _id, eventCount, affectedStudentCount }) => ({
      offeringId: _id,
      eventCount,
      affectedStudentCount,
    })),
  };
}

export function buildAuditHistoryPipeline(scope: AuditScope, page: number, pageSize: number): Document[] {
  return [
    { $match: buildAuditMatch(scope) },
    {
      $facet: {
        events: [
          { $sort: { occurredAt: -1, eventId: 1 } },
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          {
            $project: {
              _id: 0,
              eventId: 1,
              eventType: 1,
              occurredAt: 1,
              sessionId: 1,
              offeringId: 1,
              facultyId: 1,
              affectedStudentCount: 1,
              metadata: 1,
            },
          },
        ],
        count: [{ $count: "totalEvents" }],
      },
    },
  ];
}

export function transformAuditHistory(input: {
  events?: AuditEventRecord[];
  count?: Array<{ totalEvents: number }>;
}, page: number, pageSize: number): AuditHistory {
  return {
    events: input.events ?? [],
    totalEvents: input.count?.[0]?.totalEvents ?? 0,
    page,
    pageSize,
  };
}

export function emptyAuditSummary(): AuditSummary {
  return { totalEvents: 0, affectedStudentCount: 0, eventsByDate: [], eventsByOffering: [] };
}

export function emptyAuditHistory(page: number, pageSize: number): AuditHistory {
  return { events: [], totalEvents: 0, page, pageSize };
}
