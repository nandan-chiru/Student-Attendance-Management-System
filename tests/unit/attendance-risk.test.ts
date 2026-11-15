import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeAttendanceRisk } from "@/services/attendance/risk";

test("attendance above the requirement is SAFE with no recovery needed", () => {
  const risk = analyzeAttendanceRisk({ attended: 8, held: 10 });
  assert.equal(risk.status, "SAFE");
  assert.equal(risk.currentPercent, 80);
  assert.equal(risk.recoveryClasses, 0);
  assert.equal(risk.recoveryPossible, true);
});

test("attendance exactly at 75 percent meets the requirement", () => {
  const risk = analyzeAttendanceRisk({ attended: 3, held: 4 });
  assert.equal(risk.status, "SAFE");
  assert.equal(risk.currentPercent, 75);
  assert.equal(risk.recoveryClasses, 0);
});

test("below-threshold attendance reports the minimum future classes to recover", () => {
  const risk = analyzeAttendanceRisk({ attended: 5, held: 10 });
  assert.equal(risk.status, "AT_RISK");
  assert.equal(risk.recoveryPossible, true);
  assert.equal(risk.recoveryClasses, 10);
});

test("a 64.29 percent case rounds for display but uses exact counts for recovery", () => {
  const risk = analyzeAttendanceRisk({ attended: 9, held: 14 });
  assert.equal(risk.currentPercent, 64.29);
  assert.equal(risk.status, "AT_RISK");
  assert.equal(risk.recoveryClasses, 6);
  assert.equal((9 + risk.recoveryClasses) / (14 + risk.recoveryClasses), 0.75);
  assert.ok((9 + risk.recoveryClasses - 1) / (14 + risk.recoveryClasses - 1) < 0.75);
});

test("threshold comparisons use exact counts rather than rounded display percent", () => {
  const risk = analyzeAttendanceRisk({ attended: 7499, held: 10_000, requiredPercent: 75 });
  assert.equal(risk.currentPercent, 74.99);
  assert.equal(risk.status, "AT_RISK");
  assert.equal(risk.recoveryClasses, 4);
});

test("attendance below a 100 percent requirement is unrecoverable", () => {
  const risk = analyzeAttendanceRisk({ attended: 9, held: 10, requiredPercent: 100 });
  assert.equal(risk.status, "CRITICAL");
  assert.equal(risk.recoveryPossible, false);
  assert.equal(risk.recoveryClasses, null);
});

test("zero finalized classes has a distinct no-data state", () => {
  const risk = analyzeAttendanceRisk({ attended: 0, held: 0 });
  assert.equal(risk.status, "NO_DATA");
  assert.equal(risk.currentPercent, 0);
  assert.equal(risk.recoveryPossible, true);
  assert.equal(risk.recoveryClasses, 0);
});

test("100 percent attendance meets a 100 percent requirement", () => {
  const risk = analyzeAttendanceRisk({ attended: 2, held: 2, requiredPercent: 100 });
  assert.equal(risk.status, "SAFE");
  assert.equal(risk.recoveryClasses, 0);
});

test("risk analysis rejects invalid counts and thresholds", () => {
  assert.throws(() => analyzeAttendanceRisk({ attended: -1, held: 2 }), RangeError);
  assert.throws(() => analyzeAttendanceRisk({ attended: 3, held: 2 }), RangeError);
  assert.throws(() => analyzeAttendanceRisk({ attended: 0, held: 0, requiredPercent: 100.01 }), RangeError);
  assert.throws(() => analyzeAttendanceRisk({ attended: 0, held: 0, requiredPercent: 75.001 }), RangeError);
});
