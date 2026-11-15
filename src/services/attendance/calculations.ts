import type { AttendanceStatus } from "@/generated/prisma/enums";

export type AttendanceCounts = {
  held: number;
  attended: number;
  absent: number;
  excused: number;
  percentage: number;
};

/** EXCUSED marks remain visible in history but do not count as held or attended. */
export function calculateAttendance(
  statuses: readonly AttendanceStatus[],
): AttendanceCounts {
  const attended = statuses.filter((status) => status === "PRESENT").length;
  const absent = statuses.filter((status) => status === "ABSENT").length;
  const excused = statuses.filter((status) => status === "EXCUSED").length;
  return calculateAttendanceFromCounts({ attended, absent, excused });
}

/** Shared percentage calculation for status lists and SQL-aggregated dashboard counts. */
export function calculateAttendanceFromCounts(input: {
  attended: number;
  absent: number;
  excused?: number;
}): AttendanceCounts {
  const { attended, absent, excused = 0 } = input;
  if (![attended, absent, excused].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new RangeError("Attendance counts must be non-negative safe integers.");
  }
  const held = attended + absent;
  return {
    held,
    attended,
    absent,
    excused,
    percentage: held === 0 ? 0 : Math.round((attended / held) * 10_000) / 100,
  };
}
