import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateAttendance } from "@/services/attendance/calculations";
import { AttendanceValidationError } from "@/services/attendance/errors";
import {
  assertCompleteAttendanceRoster,
  createAttendanceSessionSchema,
} from "@/services/attendance/validation";

test("zero counted sessions produce a safe zero percentage", () => {
  assert.deepEqual(calculateAttendance([]), {
    held: 0,
    attended: 0,
    absent: 0,
    excused: 0,
    percentage: 0,
  });
});

test("5 of 10 classes is 50 percent", () => {
  assert.equal(calculateAttendance([
    "PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT",
    "ABSENT", "ABSENT", "ABSENT", "ABSENT", "ABSENT",
  ]).percentage, 50);
});

test("8 of 10 classes is 80 percent", () => {
  assert.equal(calculateAttendance([
    "PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT",
    "ABSENT", "ABSENT",
  ]).percentage, 80);
});

test("all present is 100 percent", () => {
  assert.equal(calculateAttendance(["PRESENT", "PRESENT", "PRESENT"]).percentage, 100);
});

test("all absent is 0 percent", () => {
  assert.equal(calculateAttendance(["ABSENT", "ABSENT"]).percentage, 0);
});

test("excused marks are excluded from the percentage denominator", () => {
  const result = calculateAttendance(["PRESENT", "ABSENT", "EXCUSED"]);
  assert.equal(result.held, 2);
  assert.equal(result.excused, 1);
  assert.equal(result.percentage, 50);
});

test("attendance input rejects impossible dates and unsupported statuses", () => {
  const validId = "00000000-0000-4000-8000-000000000001";
  const invalidDate = createAttendanceSessionSchema.safeParse({
    offeringId: validId,
    sessionDate: "2026-02-30",
    records: [{ studentId: validId, status: "PRESENT" }],
  });
  const invalidStatus = createAttendanceSessionSchema.safeParse({
    offeringId: validId,
    sessionDate: "2026-02-28",
    records: [{ studentId: validId, status: "LATE" }],
  });

  assert.equal(invalidDate.success, false);
  assert.equal(invalidStatus.success, false);
});

test("submitted roster must exactly match active enrollments", () => {
  assert.doesNotThrow(() => assertCompleteAttendanceRoster(
    [{ studentId: "student-a" }, { studentId: "student-b" }],
    ["student-b", "student-a"],
  ));
  assert.throws(() => assertCompleteAttendanceRoster(
    [{ studentId: "student-a" }],
    ["student-a", "student-b"],
  ), AttendanceValidationError);
  assert.throws(() => assertCompleteAttendanceRoster(
    [{ studentId: "student-a" }, { studentId: "student-a" }],
    ["student-a", "student-b"],
  ), AttendanceValidationError);
  assert.throws(() => assertCompleteAttendanceRoster(
    [{ studentId: "student-a" }, { studentId: "student-outsider" }],
    ["student-a", "student-b"],
  ), AttendanceValidationError);
});
