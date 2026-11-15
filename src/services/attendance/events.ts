import { z } from "zod";

/** Intended MongoDB collection for immutable attendance audit events. */
export const ATTENDANCE_EVENTS_COLLECTION = "attendance_events";

/**
 * Contract for a later Stage 7B publisher. This records event context only;
 * attendance rows remain authoritative in MySQL and are never copied here.
 */
export const attendanceSessionFinalizedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("ATTENDANCE_SESSION_FINALIZED"),
  occurredAt: z.date(),
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
