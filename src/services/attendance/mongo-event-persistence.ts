import { isDeepStrictEqual } from "node:util";
import type { AttendanceSessionFinalizedEvent } from "@/services/attendance/events";

export interface MongoAttendanceEventCollection {
  updateOne(
    filter: { eventId: string },
    update: { $setOnInsert: AttendanceSessionFinalizedEvent },
    options: { upsert: true },
  ): Promise<{ upsertedCount: number }>;
  findOne(filter: { eventId: string }): Promise<(AttendanceSessionFinalizedEvent & { _id?: unknown }) | null>;
}

function sameEventContent(
  document: AttendanceSessionFinalizedEvent & { _id?: unknown },
  event: AttendanceSessionFinalizedEvent,
): boolean {
  const content = { ...document };
  delete content._id;
  return isDeepStrictEqual(content, event);
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

/** Uses insert-only upsert semantics and verifies content after normal writes and unique-key races. */
export async function persistAttendanceEvent(
  collection: MongoAttendanceEventCollection,
  event: AttendanceSessionFinalizedEvent,
): Promise<"inserted" | "already_present"> {
  let inserted = false;
  try {
    const result = await collection.updateOne({ eventId: event.eventId }, { $setOnInsert: event }, { upsert: true });
    inserted = result.upsertedCount === 1;
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    // A concurrent publisher may have inserted the same event. Verify it below.
  }

  const stored = await collection.findOne({ eventId: event.eventId });
  if (!stored || !sameEventContent(stored, event)) {
    throw new Error("MongoDB contains conflicting content for this attendance event ID.");
  }
  return inserted ? "inserted" : "already_present";
}
