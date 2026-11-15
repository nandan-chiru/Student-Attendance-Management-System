import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATTENDANCE_EVENTS_COLLECTION,
  attendanceSessionFinalizedEventSchema,
} from "@/services/attendance/events";

const validEvent = {
  eventId: "f6f2bb58-f67f-4c5e-92ed-d8b757d81c66",
  eventType: "ATTENDANCE_SESSION_FINALIZED",
  occurredAt: new Date("2026-11-15T10:30:00.000Z"),
  sessionId: "a2c17dd0-a37c-4d02-a48f-e5ed0d81bc78",
  offeringId: "c334b574-9e60-4d60-b251-3c0c82659412",
  facultyId: "ce48eae5-7a4b-441b-b4dd-422f0ecba4f4",
  affectedStudentCount: 24,
  metadata: { schemaVersion: 1, sessionDate: "2026-11-15" },
} as const;

test("attendance event contract accepts the finalized-session event shape", () => {
  assert.equal(attendanceSessionFinalizedEventSchema.safeParse(validEvent).success, true);
  assert.equal(ATTENDANCE_EVENTS_COLLECTION, "attendance_events");
});

test("attendance event contract rejects unsupported types and invalid counts", () => {
  assert.equal(attendanceSessionFinalizedEventSchema.safeParse({
    ...validEvent,
    eventType: "ATTENDANCE_RECORD_CHANGED",
  }).success, false);
  assert.equal(attendanceSessionFinalizedEventSchema.safeParse({
    ...validEvent,
    affectedStudentCount: -1,
  }).success, false);
});

test("attendance event contract rejects extra personal data fields", () => {
  assert.equal(attendanceSessionFinalizedEventSchema.safeParse({
    ...validEvent,
    studentEmail: "student@example.test",
  }).success, false);
});
