import "server-only";
import type { Collection, Document } from "mongodb";
import { ATTENDANCE_EVENTS_COLLECTION } from "@/services/attendance/events";
import { mongoAttendanceEventStore } from "@/dal/attendance/mongo-attendance-event-store-core";
import { getMongoDatabase } from "@/lib/db/mongodb-client";
import {
  buildAuditHistoryPipeline,
  buildAuditSummaryPipeline,
  AUDIT_PAGE_SIZE,
  normalizeAuditPage,
  transformAuditHistory,
  transformAuditSummary,
  type AuditEventRecord,
  type AuditScope,
} from "@/services/audit/aggregation";

type EventDocument = Document & AuditEventRecord;
type SummaryDocument = Document & {
  totals: Array<{ totalEvents?: number; affectedStudentCount?: number }>;
  eventsByDate: Array<{ _id: string; eventCount: number }>;
  eventsByOffering: Array<{ _id: string; eventCount: number; affectedStudentCount: number }>;
};
type HistoryDocument = Document & {
  events: AuditEventRecord[];
  count: Array<{ totalEvents: number }>;
};

async function getEventCollection(): Promise<Collection<EventDocument>> {
  await mongoAttendanceEventStore.ensureIndexes();
  return (await getMongoDatabase()).collection<EventDocument>(ATTENDANCE_EVENTS_COLLECTION);
}

export async function getAttendanceEventSummary(scope: AuditScope) {
  if (scope.kind === "offerings" && scope.offeringIds.length === 0) {
    return transformAuditSummary();
  }
  const collection = await getEventCollection();
  const [result] = await collection.aggregate<SummaryDocument>(buildAuditSummaryPipeline(scope)).toArray();
  return transformAuditSummary(result);
}

export async function getRecentAttendanceEvents(scope: AuditScope, requestedPage: number) {
  const page = normalizeAuditPage(requestedPage);
  if (scope.kind === "offerings" && scope.offeringIds.length === 0) {
    return { events: [], totalEvents: 0, page, pageSize: AUDIT_PAGE_SIZE };
  }
  const collection = await getEventCollection();
  const [result] = await collection.aggregate<HistoryDocument>(
    buildAuditHistoryPipeline(scope, page, AUDIT_PAGE_SIZE),
  ).toArray();
  return transformAuditHistory(result ?? {}, page, AUDIT_PAGE_SIZE);
}
