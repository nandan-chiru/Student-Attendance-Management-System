import { z } from "zod";
import { AttendanceValidationError } from "@/services/attendance/errors";

const dateOnlySchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}, "Enter a valid calendar date.");

export const createAttendanceSessionSchema = z.object({
  offeringId: z.string().uuid(),
  sessionDate: dateOnlySchema,
  topic: z.string().trim().max(200).optional().transform((value) => value || null),
  records: z.array(z.object({
    studentId: z.string().uuid(),
    status: z.enum(["PRESENT", "ABSENT", "EXCUSED"]),
  })).min(1),
});

export type CreateAttendanceSessionInput = z.infer<typeof createAttendanceSessionSchema>;

/** Verifies the submitted roster is exactly the active enrollment set. */
export function assertCompleteAttendanceRoster(
  records: readonly { studentId: string }[],
  activeStudentIds: readonly string[],
): void {
  const recordIds = records.map(({ studentId }) => studentId);
  if (new Set(recordIds).size !== recordIds.length) {
    throw new AttendanceValidationError("Each enrolled student must appear exactly once.");
  }

  const activeStudentSet = new Set(activeStudentIds);
  if (
    recordIds.length !== activeStudentIds.length ||
    recordIds.some((studentId) => !activeStudentSet.has(studentId))
  ) {
    throw new AttendanceValidationError("Attendance must be submitted once for every currently enrolled student.");
  }
}
