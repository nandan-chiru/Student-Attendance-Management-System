import assert from "node:assert/strict";
import { test } from "node:test";
import type { UserRole } from "@/generated/prisma/enums";
import { ForbiddenError } from "@/auth/policies";
import {
  buildAuditHistoryPipeline,
  buildAuditMatch,
  buildAuditSummaryPipeline,
  normalizeAuditPage,
  transformAuditHistory,
  transformAuditSummary,
  type AuditScope,
} from "@/services/audit/aggregation";
import { createAttendanceAuditService, type AttendanceAuditServiceDependencies } from "@/services/audit/attendance-audit-core";

const offeringA = "offer-allowed-a";
const offeringB = "offer-allowed-b";
const forbiddenOffering = "offer-not-assigned";

function emptyDependencies(overrides: Partial<AttendanceAuditServiceDependencies> = {}) {
  const calls: { order: string[]; scopes: AuditScope[]; labels: string[][]; facultyIds: string[] } = {
    order: [], scopes: [], labels: [], facultyIds: [],
  };
  const dependencies: AttendanceAuditServiceDependencies = {
    async requireAdmin() { calls.order.push("admin-auth"); return { id: "admin", email: "admin@example.test", role: "ADMIN" as UserRole, studentProfileId: null, facultyProfileId: null }; },
    async requireFaculty() { calls.order.push("faculty-auth"); return { id: "faculty-user", email: "faculty@example.test", role: "FACULTY" as UserRole, studentProfileId: null, facultyProfileId: "faculty-profile" }; },
    async listFacultyAuditOfferingIds(facultyId) { calls.order.push("scope"); calls.facultyIds.push(facultyId); return [offeringA, offeringB]; },
    async getAttendanceEventSummary(scope) { calls.order.push("mongo-summary"); calls.scopes.push(scope); return transformAuditSummary(); },
    async getRecentAttendanceEvents(scope, page) { calls.order.push("mongo-history"); calls.scopes.push(scope); return transformAuditHistory({}, page, 20); },
    async getAuditOfferingLabels(ids) { calls.labels.push(ids); return []; },
    ...overrides,
  };
  return { dependencies, calls };
}

test("summary aggregation groups events by UTC date and offering and sums event-level affected counts", () => {
  const pipeline = buildAuditSummaryPipeline({ kind: "all" });
  assert.deepEqual(pipeline[0], { $match: { eventType: "ATTENDANCE_SESSION_FINALIZED" } });
  const facets = pipeline[1]?.$facet as Record<string, Array<Record<string, unknown>>>;
  assert.ok(facets.eventsByDate.some((stage) => "$group" in stage));
  assert.ok(JSON.stringify(facets.eventsByDate).includes("$dateToString"));
  assert.ok(JSON.stringify(facets.totals).includes("affectedStudentCount"));
  assert.ok(JSON.stringify(facets.eventsByOffering).includes("$ifNull"));
});

test("faculty aggregation match contains only the MySQL-authorized offering IDs", () => {
  assert.deepEqual(buildAuditMatch({ kind: "offerings", offeringIds: [offeringA, offeringB] }), {
    eventType: "ATTENDANCE_SESSION_FINALIZED",
    offeringId: { $in: [offeringA, offeringB] },
  });
  assert.equal(JSON.stringify(buildAuditMatch({ kind: "offerings", offeringIds: [offeringA] })).includes(forbiddenOffering), false);
});

test("empty aggregation result transforms to zero counts and empty group lists", () => {
  assert.deepEqual(transformAuditSummary(), {
    totalEvents: 0,
    affectedStudentCount: 0,
    eventsByDate: [],
    eventsByOffering: [],
  });
  assert.deepEqual(transformAuditHistory({}, 1, 20), { events: [], totalEvents: 0, page: 1, pageSize: 20 });
});

test("aggregation results preserve date groups and affected-student event totals", () => {
  const summary = transformAuditSummary({
    totals: [{ totalEvents: 3, affectedStudentCount: 17 }],
    eventsByDate: [{ _id: "2026-11-15", eventCount: 2 }, { _id: "2026-11-14", eventCount: 1 }],
    eventsByOffering: [{ _id: offeringA, eventCount: 3, affectedStudentCount: 17 }],
  });
  assert.equal(summary.affectedStudentCount, 17);
  assert.deepEqual(summary.eventsByDate[0], { date: "2026-11-15", eventCount: 2 });
  assert.equal(summary.eventsByOffering[0]?.offeringId, offeringA);
});

test("history aggregation applies deterministic sorting, pagination, and a bounded page size", () => {
  const pipeline = buildAuditHistoryPipeline({ kind: "all" }, 3, 20);
  const facet = pipeline[1]?.$facet as { events: Array<Record<string, unknown>> };
  assert.deepEqual(facet.events[1], { $skip: 40 });
  assert.deepEqual(facet.events[2], { $limit: 20 });
  assert.equal(normalizeAuditPage(-1), 1);
  assert.equal(normalizeAuditPage(1.5), 1);
  assert.equal(normalizeAuditPage(99_999), 10_000);
});

test("admin authorization runs before any Mongo aggregation and uses global scope", async () => {
  const { dependencies, calls } = emptyDependencies();
  const service = createAttendanceAuditService(dependencies);
  await service.getAdminAttendanceAuditReport();
  assert.equal(calls.order[0], "admin-auth");
  assert.ok(calls.scopes.every((scope) => scope.kind === "all"));
});

test("unauthorized admin is rejected before MongoDB is accessed", async () => {
  const { dependencies, calls } = emptyDependencies({
    async requireAdmin() { calls.order.push("admin-auth"); throw new ForbiddenError(); },
  });
  const service = createAttendanceAuditService(dependencies);
  await assert.rejects(service.getAdminAttendanceAuditReport(), ForbiddenError);
  assert.equal(calls.order.includes("mongo-summary"), false);
  assert.equal(calls.order.includes("mongo-history"), false);
});

test("faculty report derives scope from its authenticated profile before querying MongoDB", async () => {
  const { dependencies, calls } = emptyDependencies();
  const service = createAttendanceAuditService(dependencies);
  await service.getFacultyAttendanceAuditReport(2);
  assert.deepEqual(calls.facultyIds, ["faculty-profile"]);
  assert.deepEqual(calls.order.slice(0, 2), ["faculty-auth", "scope"]);
  assert.ok(calls.scopes.every((scope) => scope.kind === "offerings" &&
    scope.offeringIds.length === 2 && scope.offeringIds.includes(offeringA) && scope.offeringIds.includes(offeringB)));
  assert.equal(calls.scopes.some((scope) => scope.kind === "offerings" && scope.offeringIds.includes(forbiddenOffering)), false);
});

test("unauthorized faculty is rejected before scope lookup or MongoDB access", async () => {
  const { dependencies, calls } = emptyDependencies({
    async requireFaculty() { calls.order.push("faculty-auth"); throw new ForbiddenError(); },
  });
  const service = createAttendanceAuditService(dependencies);
  await assert.rejects(service.getFacultyAttendanceAuditReport(), ForbiddenError);
  assert.deepEqual(calls.order, ["faculty-auth"]);
});

test("faculty with no assigned offerings gets an empty report without Mongo access", async () => {
  const { dependencies, calls } = emptyDependencies({ async listFacultyAuditOfferingIds() { return []; } });
  const service = createAttendanceAuditService(dependencies);
  const report = await service.getFacultyAttendanceAuditReport();
  assert.equal(report.summary.totalEvents, 0);
  assert.deepEqual(calls.scopes, []);
  assert.equal(calls.order.includes("mongo-summary"), false);
});
