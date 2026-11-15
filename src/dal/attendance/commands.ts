import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createAttendanceSessionFinalizedEvent } from "@/services/attendance/events";

/** Creates a finalized session, all roster marks, and its pending event through one transaction client. */
export async function insertFinalizedSessionWithOutbox(
  tx: Prisma.TransactionClient,
  input: {
    offeringId: string;
    sessionDate: Date;
    topic: string | null;
    createdBy: string;
    facultyId: string;
    records: Array<{ studentId: string; status: "PRESENT" | "ABSENT" | "EXCUSED" }>;
  },
  eventId = randomUUID(),
) {
  const finalizedAt = new Date();
  const session = await tx.attendanceSession.create({
    data: {
      offeringId: input.offeringId,
      sessionDate: input.sessionDate,
      topic: input.topic,
      status: "FINALIZED",
      finalizedAt,
      createdBy: input.createdBy,
    },
    select: { id: true },
  });

  await tx.attendanceRecord.createMany({
    data: input.records.map(({ studentId, status }) => ({
      sessionId: session.id,
      studentId,
      status,
      markedBy: input.createdBy,
    })),
  });

  const event = createAttendanceSessionFinalizedEvent({
    eventId,
    occurredAt: finalizedAt,
    sessionId: session.id,
    offeringId: input.offeringId,
    facultyId: input.facultyId,
    affectedStudentCount: input.records.length,
    sessionDate: input.sessionDate.toISOString().slice(0, 10),
  });

  await tx.outboxEvent.create({
    data: {
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: finalizedAt,
      actorUserId: input.createdBy,
      offeringId: input.offeringId,
      sessionId: session.id,
      payload: event,
    },
  });

  return session.id;
}
