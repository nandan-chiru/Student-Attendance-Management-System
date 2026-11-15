import { z } from "zod";

/** Intended MongoDB collection for immutable attendance audit events. */
export const ATTENDANCE_EVENTS_COLLECTION = "attendance_events";

/**
 * Contract for the Stage 7B SQL outbox event and future Stage 7C publisher.
 * Attendance rows remain authoritative in MySQL and are never copied here.
 */
export const attendanceSessionFinalizedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("ATTENDANCE_SESSION_FINALIZED"),
  occurredAt: z.iso.datetime(),
  sessionId: z.string().uuid(),
  offeringId: z.string().uuid(),
  facultyId: z.string().uuid(),
  affectedStudentCount: z.number().int().nonnegative(),
  metadata: z.object({
    schemaVersion: z.literal(1),
    sessionDate: z.iso.date(),
  }).strict(),
}).strict();

export type AttendanceSessionFinalizedEvent = z.infer<typeof attendanceSessionFinalizedEventSchema>;

export function createAttendanceSessionFinalizedEvent(input: {
  eventId: string;
  occurredAt: Date;
  sessionId: string;
  offeringId: string;
  facultyId: string;
  affectedStudentCount: number;
  sessionDate: string;
}): AttendanceSessionFinalizedEvent {
  return attendanceSessionFinalizedEventSchema.parse({
    eventId: input.eventId,
    eventType: "ATTENDANCE_SESSION_FINALIZED",
    occurredAt: input.occurredAt.toISOString(),
    sessionId: input.sessionId,
    offeringId: input.offeringId,
    facultyId: input.facultyId,
    affectedStudentCount: input.affectedStudentCount,
    metadata: { schemaVersion: 1, sessionDate: input.sessionDate },
  });
}
